const { supabaseGet, getSupabaseConfig } = require('../lib/supabase');

const TABLE_PATH = 'attendance_records';
const TABLE_SCHEMA = 'public';
const CHILE_TIMEZONE = 'America/Santiago';
const RECORD_SELECT = '*';
const RECORD_LIMIT = 20;
const ENDPOINT_NAME = 'api/report-data.js';

function getChileDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function buildEnvDiagnostic() {
  const { url, hasUrl, hasAnonKey, hasServiceRoleKey } = getSupabaseConfig();
  const projectRefMatch = url.match(/^https:\/\/([^.]+)\.supabase\.co/i);

  return {
    NEXT_PUBLIC_SUPABASE_URL_present: hasUrl,
    NEXT_PUBLIC_SUPABASE_URL_host: hasUrl ? new URL(url).host : null,
    SUPABASE_PROJECT_REF: projectRefMatch ? projectRefMatch[1] : null,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_present: hasAnonKey,
    SUPABASE_SERVICE_ROLE_KEY_present: hasServiceRoleKey,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const dia = getChileDate();
    const campus = String(req.query?.campus || '').trim();
    const motivo = String(req.query?.motivo || req.query?.tematica || '').trim();
    const actividad = String(req.query?.actividad || '').trim();
    const query = {
      select: RECORD_SELECT,
      order: 'created_at.desc',
      limit: RECORD_LIMIT,
    };
    const diagnostic = {
      endpoint: ENDPOINT_NAME,
      table: TABLE_PATH,
      schema: TABLE_SCHEMA,
      intended_filters: {
        dia_current_date_chile: dia,
        estado: null,
        sede: campus || null,
        tematica: motivo || null,
        actividad: actividad || null,
        other_filters: [],
      },
      applied_filters: Object.fromEntries(
        Object.entries(query).filter(([key]) => !['select', 'order', 'limit'].includes(key))
      ),
      query,
      env: buildEnvDiagnostic(),
      notes: [
        'Se desactivaron temporalmente los filtros de dia, sede, tematica y actividad para verificar si el problema es un filtro innecesario.',
        'El path usado hacia Supabase REST sigue siendo attendance_records, que corresponde a /rest/v1/attendance_records (schema public por defecto).',
      ],
    };

    console.log('[report-data] endpoint start', JSON.stringify({
      endpoint: ENDPOINT_NAME,
      hasUrl: diagnostic.env.NEXT_PUBLIC_SUPABASE_URL_present,
      hasServiceRoleKey: diagnostic.env.SUPABASE_SERVICE_ROLE_KEY_present,
    }));
    console.log('[report-data] Supabase diagnostic', JSON.stringify(diagnostic));

    const registros = await supabaseGet(TABLE_PATH, query, { endpointName: ENDPOINT_NAME });
    const rowCount = Array.isArray(registros) ? registros.length : 0;

    console.log('[report-data] Supabase rows returned', JSON.stringify({ endpoint: ENDPOINT_NAME, rowCount }));

    return res.status(200).json({
      registros: Array.isArray(registros) ? registros : [],
      debug: diagnostic,
      rowCount,
    });
  } catch (error) {
    console.error('[report-data] catch', JSON.stringify({
      endpoint: ENDPOINT_NAME,
      message: error.message || 'No se pudo cargar el informe.',
      status: error.status || 500,
      details: error.details || null,
    }));

    return res.status(error.status || 500).json({
      error: 'No se pudo cargar el informe.',
      detail: error.message || 'Error desconocido.',
      endpoint: ENDPOINT_NAME,
      supabase: error.details || null,
    });
  }
};
