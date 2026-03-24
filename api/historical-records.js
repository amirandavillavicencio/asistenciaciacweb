const { supabaseGet } = require('../lib/supabase');
const { buildAnalytics, getMonthLabel } = require('../lib/reporting');
const { buildPeriod, applyCommonFilters } = require('../lib/period');

const RECORD_SELECT = 'id,created_at,dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,estado,espacio';

function summarizeMonth(records, month) {
  const monthStr = String(month).padStart(2, '0');
  const monthRecords = records.filter((item) => String(item.dia || '').slice(5, 7) === monthStr);
  const analytics = buildAnalytics(monthRecords);
  return {
    month,
    monthLabel: getMonthLabel(month),
    total: analytics.executive.total,
    uniqueStudents: analytics.executive.uniqueStudents,
    topActivity: analytics.activity.top?.label || 'Sin datos',
    topTopic: analytics.topic.top?.label || 'Sin datos',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    const period = buildPeriod(req.query?.year, req.query?.month || 'all');
    const query = {
      select: RECORD_SELECT,
      order: 'hora_entrada.desc',
      and: `(dia.gte.${period.start},dia.lte.${period.end})`,
      limit: 10000,
    };
    const filters = applyCommonFilters(query, req.query);
    const records = await supabaseGet('attendance_records', query, { endpointName: 'api/historical-records.js' });
    const analytics = buildAnalytics(records);

    if (period.month === 'all') {
      const monthly = Array.from({ length: 12 }, (_, idx) => summarizeMonth(records, idx + 1));
      return res.status(200).json({ mode: 'year', period, filters, monthly, analytics });
    }

    return res.status(200).json({ mode: 'month', period, filters, records, analytics });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'No se pudo cargar histórico.' });
  }
};
