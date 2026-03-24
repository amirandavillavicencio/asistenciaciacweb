const XLSX = require('xlsx');
const { supabaseGet } = require('../lib/supabase');
const { buildAnalytics, getMonthLabel } = require('../lib/reporting');
const { buildPeriod, applyCommonFilters } = require('../lib/period');

const RECORD_SELECT = 'id,dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,estado,espacio';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    const format = String(req.query?.format || 'csv').toLowerCase();
    const period = buildPeriod(req.query?.year, req.query?.month || 'all');
    const query = {
      select: RECORD_SELECT,
      order: 'dia.asc',
      and: `(dia.gte.${period.start},dia.lte.${period.end})`,
      limit: 10000,
    };
    applyCommonFilters(query, req.query);
    const records = await supabaseGet('attendance_records', query, { endpointName: 'api/export-historical.js' });

    if (period.month === 'all') {
      const rows = Array.from({ length: 12 }, (_, idx) => {
        const month = idx + 1;
        const monthStr = String(month).padStart(2, '0');
        const list = records.filter((item) => String(item.dia || '').slice(5, 7) === monthStr);
        const stats = buildAnalytics(list);
        return {
          Mes: getMonthLabel(month),
          'Total atenciones': stats.executive.total,
          'Estudiantes únicos': stats.executive.uniqueStudents,
          'Actividad top': stats.activity.top?.label || 'Sin datos',
          'Temática top': stats.topic.top?.label || 'Sin datos',
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      const filename = `historico-anual-${period.year}.${format === 'pdf' ? 'csv' : 'csv'}`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    }

    const rows = records.map((record) => ({
      RUN: record.run,
      DV: record.dv,
      Carrera: record.carrera,
      'Año ingreso': record.anio_ingreso,
      Campus: record.sede,
      Actividad: record.actividad,
      Temática: record.tematica,
      Espacio: record.espacio,
      Entrada: record.hora_entrada,
      Salida: record.hora_salida,
      Estado: record.estado,
      Fecha: record.dia,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="historico-${period.start}-${period.end}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'No se pudo exportar histórico.' });
  }
};
