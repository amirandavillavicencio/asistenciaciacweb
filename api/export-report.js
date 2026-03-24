const { supabaseGet } = require('../lib/supabase');
const { buildAnalytics } = require('../lib/reporting');
const { buildPeriod, applyCommonFilters } = require('../lib/period');

const RECORD_SELECT = 'created_at,dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,estado,espacio';

function pdfEscape(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimplePdf(lines) {
  const content = [];
  content.push('BT');
  content.push('/F1 18 Tf 50 800 Td (Informe de Uso CIAC - UTFSM) Tj');
  content.push('/F1 10 Tf 0 -20 Td');

  lines.forEach((line) => {
    content.push(`(${pdfEscape(line)}) Tj`);
    content.push('0 -14 Td');
  });
  content.push('ET');

  const stream = content.join('\n');
  const objects = [];
  const addObj = (body) => objects.push(body);

  addObj('<< /Type /Catalog /Pages 2 0 R >>');
  addObj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObj('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>');
  addObj(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
  addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, idx) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((off) => {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

function toLineRows(title, rows, formatter) {
  const output = [`${title}:`];
  if (!rows.length) return output.concat(['  Sin datos']);
  return output.concat(rows.map((row) => `  - ${formatter(row)}`));
}

function formatMinutes(minutes) {
  if (!minutes) return 'N/D';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    const period = buildPeriod(req.query?.year, req.query?.month);
    const query = {
      select: RECORD_SELECT,
      order: 'hora_entrada.asc',
      and: `(dia.gte.${period.start},dia.lte.${period.end})`,
      limit: 10000,
    };
    applyCommonFilters(query, req.query);

    const registros = await supabaseGet('attendance_records', query);
    const analytics = buildAnalytics(registros);

    const lines = [
      `Fecha de generación: ${new Date().toLocaleString('es-CL')}`,
      `Periodo cubierto: ${period.start} a ${period.end}`,
      '',
      'Resumen ejecutivo',
      `Total de atenciones: ${analytics.executive.total}`,
      `Estudiantes únicos: ${analytics.executive.uniqueStudents}`,
      `Promedio atenciones por día hábil: ${analytics.executive.averagePerBusinessDay}`,
      `Tiempo promedio de permanencia: ${formatMinutes(analytics.executive.averageDurationMinutes)}`,
      ...toLineRows('Distribución por campus', analytics.executive.campusDistribution, (row) => `${row.label}: ${row.count} (${row.percentage}%)`),
      ...toLineRows('Desglose por actividad', analytics.activity.rows, (row) => `${row.label}: ${row.count} (${row.percentage}%)`),
      `Actividad más demandada: ${analytics.activity.top?.label || 'Sin datos'}`,
      ...toLineRows('Desglose por temática', analytics.topic.rows, (row) => `${row.label}: ${row.count} (${row.percentage}%)`),
      `Temática más consultada: ${analytics.topic.top?.label || 'Sin datos'}`,
      ...toLineRows('Uso por espacio', analytics.spaces.rows, (row) => `${row.label}: ${row.count}`),
      ...toLineRows('Horas pico', analytics.spaces.peakHours, (row) => `${row.range}: ${row.count}`),
      ...toLineRows('Estudiantes recurrentes', analytics.students.recurrent, (row) => `${row.student}: ${row.visits} visitas`),
      ...toLineRows('Distribución por carrera', analytics.students.careers, (row) => `${row.label}: ${row.count}`),
      ...toLineRows('Distribución por año ingreso', analytics.students.admissionYears, (row) => `${row.label}: ${row.count}`),
      ...toLineRows('Atenciones por día de semana', analytics.temporal.weekday, (row) => `${row.day}: ${row.count}`),
      `Día con mayor asistencia: ${analytics.temporal.maxDay.day} (${analytics.temporal.maxDay.count})`,
      `Día con menor asistencia: ${analytics.temporal.minDay.day} (${analytics.temporal.minDay.count})`,
    ];

    const pdfBuffer = buildSimplePdf(lines);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="informe-uso-ciac-${period.start}-${period.end}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'No se pudo exportar el informe PDF.' });
  }
};
