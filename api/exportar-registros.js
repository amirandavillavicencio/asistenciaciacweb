const { supabaseGet } = require('../lib/supabase');

const CHILE_TIMEZONE = 'America/Santiago';
const CSV_HEADERS = [
  'Día',
  'Hora Entrada',
  'Hora Salida',
  'RUN',
  'Dígito V',
  'Carrera',
  'Año Ingreso',
  'Campus',
  'Actividad',
  'Temática',
  'Espacio',
  'Estado',
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
  const normalized = sanitizeCell(run);
  if (!normalized) return '';
  return normalized.replace(/\./g, '').split('-')[0].replace(/\D/g, '');
}

function getDvValue(record) {
  const directDv = sanitizeCell(record?.dv ?? record?.digito_verificador ?? '');
  if (directDv) return directDv.toUpperCase();

  const runSource = sanitizeCell(record?.run ?? record?.rut ?? '');
  const runParts = runSource.split('-');
  return sanitizeCell(runParts[1] ?? '').toUpperCase();
}

function buildCsvRow(record) {
  const safeRecord = record ?? {};
  return [
    formatDateDDMMYYYY(getDateValue(safeRecord)),
    formatHourHHMM(safeRecord?.hora_entrada ?? safeRecord?.entrada ?? safeRecord?.check_in ?? ''),
    formatHourHHMM(safeRecord?.hora_salida ?? safeRecord?.salida ?? safeRecord?.check_out ?? ''),
    formatRunValue(safeRecord?.run ?? safeRecord?.rut ?? ''),
    getDvValue(safeRecord),
    sanitizeCell(safeRecord?.carrera ?? ''),
    sanitizeCell(safeRecord?.anio_ingreso ?? safeRecord?.año_ingreso ?? safeRecord?.year_ingreso ?? ''),
    sanitizeCell(safeRecord?.campus ?? safeRecord?.sede ?? ''),
    sanitizeCell(safeRecord?.actividad ?? ''),
    sanitizeCell(safeRecord?.tematica ?? safeRecord?.temática ?? ''),
    sanitizeCell(safeRecord?.espacio ?? ''),
    sanitizeCell(safeRecord?.estado ?? ''),
    sanitizeCell(safeRecord?.observaciones ?? ''),
  ].map(escapeCsvCell).join(';');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const today = getChileDate();
    let registros;
    try {
      const campusSeleccionado = sanitizeCell(req.query?.campus || '');
      const query = {
        select: '*',
        dia: `eq.${today}`,
        order: 'created_at.asc',
      };

      if (campusSeleccionado) {
        query.sede = `eq.${campusSeleccionado}`;
      }

      registros = await supabaseGet('attendance_records', {
        ...query,
      });
    } catch (error) {
      throw new Error(error?.message || 'Error consultando registros para exportación CSV.');
    }

    const rows = Array.isArray(registros) ? registros : [];
    console.log('Primer registro:', JSON.stringify(rows?.[0] ?? null, null, 2));
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
