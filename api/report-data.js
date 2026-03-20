const { supabaseGet } = require('../lib/supabase');

const TABLE_PATH = 'attendance_records';
const TABLE_SCHEMA = 'public';
const RECORD_SELECT = '*';
const RECORD_LIMIT = 20;

function buildEnvDiagnostic() {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const projectRefMatch = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/i);

  return {
    NEXT_PUBLIC_SUPABASE_URL_present: Boolean(supabaseUrl),
    NEXT_PUBLIC_SUPABASE_URL_host: supabaseUrl ? new URL(supabaseUrl).host : null,
    SUPABASE_PROJECT_REF: projectRefMatch ? projectRefMatch[1] : null,
    SUPABASE_SERVICE_ROLE_KEY_present: Boolean(String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()),
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.', detail: 'Usa GET para consultar el reporte.' });
  }

  const envDiagnostic = buildEnvDiagnostic();
  console.log('[report-data] endpoint ejecutado', JSON.stringify({
    endpoint: '/api/report-data',
    hasUrl: envDiagnostic.NEXT_PUBLIC_SUPABASE_URL_present,
    hasServiceRoleKey: envDiagnostic.SUPABASE_SERVICE_ROLE_KEY_present,
  }));

  try {
    const campus = String(req.query?.campus || '').trim();
    const motivo = String(req.query?.motivo || req.query?.tematica || '').trim();
    const actividad = String(req.query?.actividad || '').trim();
    const query = {
      select: RECORD_SELECT,
      order: 'created_at.desc',
      limit: RECORD_LIMIT,
    };
    const diagnostic = {
      endpoint: 'api/report-data.js',
      table: TABLE_PATH,
      schema: TABLE_SCHEMA,
      filters: {
        campus: campus || null,
        motivo: motivo || null,
        actividad: actividad || null,
      },
      query,
      env: envDiagnostic,
    };

    const registros = await supabaseGet(TABLE_PATH, query);
    const rowCount = Array.isArray(registros) ? registros.length : 0;

    console.log('[report-data] respuesta OK', JSON.stringify({ rowCount }));

    return res.status(200).json({
      registros: Array.isArray(registros) ? registros : [],
      debug: diagnostic,
      rowCount,
    });
  } catch (error) {
    console.error('[report-data] error exacto', JSON.stringify({
      message: error.message || 'No se pudo cargar el informe.',
      status: error.status || 500,
      details: error.details || null,
    }));

    return res.status(error.status || 500).json({
      error: 'Error al obtener reporte',
      detail: error.message || 'No se pudo cargar el informe.',
      supabase: error.details || null,
    });
  }
};
