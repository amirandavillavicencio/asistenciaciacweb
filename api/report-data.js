const { supabaseGet } = require('../lib/supabase');
const { buildAnalytics, buildAttendanceRanking } = require('../lib/reporting');
const { buildPeriod, applyCommonFilters } = require('../lib/period');

const RECORD_SELECT = 'id,created_at,dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,estado,espacio';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const period = buildPeriod(req.query?.year, req.query?.month);
    const query = {
      select: RECORD_SELECT,
      order: 'hora_entrada.desc',
      and: `(dia.gte.${period.start},dia.lte.${period.end})`,
      limit: 5000,
    };
    const filters = applyCommonFilters(query, req.query);

    const registros = await supabaseGet('attendance_records', query, { endpointName: 'api/report-data.js' });

    return res.status(200).json({
      registros: Array.isArray(registros) ? registros : [],
      analytics: buildAnalytics(registros),
      ranking: buildAttendanceRanking(registros, 10),
      period,
      filters,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudo cargar el informe.',
      detail: error.message || 'Error desconocido.',
    });
  }
};
