const { supabaseGet } = require('../lib/supabase');

const CHILE_TIMEZONE = 'America/Santiago';
const RECORD_SELECT = 'dia,hora_entrada,hora_salida,sede,actividad,run,dv,carrera,anio_ingreso,tematica,espacio,observaciones';
const CSV_HEADERS = [
  'fecha',
  'hora_entrada',
  'hora_salida',
  'campus',
  'actividad',
  'run',
  'dv',
  'nombre_completo',
  'carrera',
  'anio_ingreso',
  'semestre_en_curso',
  'tematica',
  'espacio',
  'observaciones',
];

function getChileDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getCurrentSemester(dateString) {
  const date = dateString ? new Date(`${dateString}T12:00:00`) : new Date();
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  return `${month <= 6 ? 1 : 2}-${year}`;
}

function sanitizeCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function escapeCsvCell(value) {
  const normalized = sanitizeCell(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function formatRun(run) {
  const normalized = sanitizeCell(run);
  return normalized ? `'${normalized}` : '';
}

function buildCsvRow(record, exportDate) {
  return [
    record.dia || exportDate,
    record.hora_entrada || '',
    record.hora_salida || '',
    record.sede || '',
    record.actividad || '',
    formatRun(record.run),
    record.dv || '',
    '',
    record.carrera || '',
    record.anio_ingreso || '',
    getCurrentSemester(record.dia || exportDate),
    record.tematica || '',
    record.espacio || '',
    record.observaciones || '',
  ].map(escapeCsvCell).join(',');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const dia = getChileDate();
    const registros = await supabaseGet('attendance_records', {
      select: RECORD_SELECT,
      dia: `eq.${dia}`,
      order: 'hora_entrada.desc',
    });

    const rows = Array.isArray(registros) ? registros : [];
    const csvLines = [
      CSV_HEADERS.map(escapeCsvCell).join(','),
      ...rows.map((record) => buildCsvRow(record, dia)),
    ];
    const csvContent = `\uFEFF${csvLines.join('\r\n')}\r\n`;
    const buffer = Buffer.from(csvContent, 'utf8');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ciac-registros-${dia}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', buffer.length);

    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudo exportar el archivo CSV.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
