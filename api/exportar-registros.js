const { supabaseGet } = require('../lib/supabase');

const CHILE_TIMEZONE = 'America/Santiago';
const RECORD_SELECT = 'created_at,dia,hora_entrada,hora_salida,run,dv,carrera,jornada,anio_ingreso,actividad,tematica,observaciones';
const CSV_HEADERS = [
  'Día',
  'Hora Entrada',
  'Hora Salida',
  'RUN',
  'Dígito V',
  'Carrera',
  'Jornada',
  'Año Ingreso',
  'Actividad',
  'Temática',
  'Observaciones',
];

function getChileDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
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

function toDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function getDateValue(record) {
  if (record?.dia) {
    return sanitizeCell(record.dia);
  }

  const createdAt = toDate(record?.created_at);
  if (!createdAt) {
    return '';
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(createdAt);
}

function formatDateDDMMYYYY(dateInput) {
  const normalized = sanitizeCell(dateInput);
  if (!normalized) return '';

  const direct = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (direct) {
    return `${direct[3]}/${direct[2]}/${direct[1]}`;
  }

  const parsed = toDate(normalized);
  if (!parsed) return normalized;

  return new Intl.DateTimeFormat('es-CL', {
    timeZone: CHILE_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

function formatHourHHMM(value) {
  const parsed = toDate(value);
  if (!parsed) {
    const normalized = sanitizeCell(value);
    if (!normalized) return '';
    const match = normalized.match(/(\d{2}:\d{2})/);
    return match ? match[1] : normalized;
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CHILE_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(parsed);

  const get = (type) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('hour')}:${get('minute')}`;
}

function escapeCsvCell(value) {
  const normalized = sanitizeCell(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function formatRunValue(run) {
  return sanitizeCell(run).replace(/\D/g, '');
}

function buildCsvRow(record) {
  return [
    formatDateDDMMYYYY(getDateValue(record)),
    formatHourHHMM(record.hora_entrada),
    formatHourHHMM(record.hora_salida),
    formatRunValue(record.run),
    sanitizeCell(record.dv).toUpperCase(),
    record.carrera || '',
    record.jornada || '',
    record.anio_ingreso || '',
    record.actividad || '',
    record.tematica || '',
    record.observaciones || '',
  ].map(escapeCsvCell).join(';');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const today = getChileDate();
    const registros = await supabaseGet('attendance_records', {
      select: RECORD_SELECT,
      dia: `eq.${today}`,
      order: 'hora_entrada.desc',
    });

    const rows = Array.isArray(registros) ? registros : [];
    const csvLines = [
      CSV_HEADERS.map(escapeCsvCell).join(';'),
      ...rows.map((record) => buildCsvRow(record)),
    ];
    const csvContent = `\uFEFF${csvLines.join('\r\n')}\r\n`;
    const buffer = Buffer.from(csvContent, 'utf8');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="registros_CIAC_${today}.csv"`);
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
