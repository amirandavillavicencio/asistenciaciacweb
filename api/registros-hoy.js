const { supabaseGet } = require('../lib/supabase');

const TABLE_PATH = 'attendance_records';
const TABLE_SCHEMA = 'public';
const CHILE_TIMEZONE = 'America/Santiago';
const RECORD_SELECT = '*';
const RECORD_LIMIT = 20;

function getChileDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function buildEnvDiagnostic() {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
  const projectRefMatch = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/i);

  return {
    SUPABASE_URL_present: Boolean(supabaseUrl),
    SUPABASE_URL_host: supabaseUrl ? new URL(supabaseUrl).host : null,
    SUPABASE_PROJECT_REF: projectRefMatch ? projectRefMatch[1] : null,
    SUPABASE_ANON_KEY_present: Boolean(String(process.env.SUPABASE_ANON_KEY || '').trim()),
    SUPABASE_SERVICE_ROLE_KEY_present: Boolean(String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()),
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const dia = getChileDate();
    const query = {
      select: RECORD_SELECT,
      order: 'created_at.desc',
      limit: RECORD_LIMIT,
    };
    const diagnostic = {
      endpoint: 'api/registros-hoy.js',
      table: TABLE_PATH,
      schema: TABLE_SCHEMA,
      intended_filters: {
        dia_current_date_chile: dia,
        estado: null,
        sede: null,
        other_filters: [],
      },
      applied_filters: Object.fromEntries(
        Object.entries(query).filter(([key]) => !['select', 'order', 'limit'].includes(key))
      ),
      query,
      env: buildEnvDiagnostic(),
      notes: [
        'Consulta temporalmente reducida a select *, order by created_at desc, limit 20 para descartar filtros problemáticos.',
        'El path usado hacia Supabase REST sigue siendo attendance_records, que corresponde a /rest/v1/attendance_records (schema public por defecto).',
      ],
    };

    console.log('[registros-hoy] Supabase diagnostic', JSON.stringify(diagnostic));

    const registros = await supabaseGet(TABLE_PATH, query);
    const rowCount = Array.isArray(registros) ? registros.length : 0;

    console.log('[registros-hoy] Supabase rows returned', JSON.stringify({ rowCount }));

    return res.status(200).json({
      registros: Array.isArray(registros) ? registros : [],
      debug: diagnostic,
      rowCount,
    });
  } catch (error) {
    console.error('[registros-hoy] Supabase error', JSON.stringify({
      message: error.message,
      status: error.status || 500,
      details: error.details || null,
    }));

    return res.status(error.status || 500).json({
      error: 'No se pudieron cargar los registros del día.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
