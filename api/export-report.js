const XLSX = require('xlsx');
const { supabaseGet } = require('../lib/supabase');

const CHILE_TIMEZONE = 'America/Santiago';
const RECORD_SELECT = 'dia,hora_entrada,hora_salida,sede,actividad,run,dv,nombre_completo,carrera,anio_ingreso,semestre_en_curso,tematica,espacio,observaciones';
const SUMMARY_HEADERS = ['Métrica', 'Valor'];
const DETAIL_HEADERS = [
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

function normalizeValue(value, fallback = 'No informado') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function getCurrentSemester(dateString) {
  const date = dateString ? new Date(`${dateString}T12:00:00`) : new Date();
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  return `${month <= 6 ? 1 : 2}-${year}`;
}

function parseDateTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getAverageDurationMinutes(records) {
  const durations = records
    .map((record) => {
      const start = parseDateTime(record.hora_entrada);
      const end = parseDateTime(record.hora_salida);

      if (!start || !end) {
        return null;
      }

      const diff = Math.round((end.getTime() - start.getTime()) / 60000);
      return diff >= 0 ? diff : null;
    })
    .filter((value) => Number.isFinite(value));

  if (!durations.length) {
    return 0;
  }

  return Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
}

function buildCountRows(records, key, labelKey) {
  const totals = records.reduce((accumulator, record) => {
    const label = normalizeValue(record[key]);
    accumulator.set(label, (accumulator.get(label) || 0) + 1);
    return accumulator;
  }, new Map());

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([label, count]) => ({ [labelKey]: label, Cantidad: count }));
}

function buildSummaryRows(records, reportDate) {
  if (!records.length) {
    return [
      { Métrica: 'Estado', Valor: 'Sin registros' },
      { Métrica: 'Fecha del informe', Valor: reportDate },
      { Métrica: 'Total registros', Valor: 0 },
      { Métrica: 'Total activos', Valor: 0 },
      { Métrica: 'Total cerrados', Valor: 0 },
      { Métrica: 'Promedio duración (minutos)', Valor: 0 },
    ];
  }

  const totalActivos = records.filter((record) => !record.hora_salida).length;
  const totalCerrados = records.filter((record) => Boolean(record.hora_salida)).length;

  return [
    { Métrica: 'Total registros', Valor: records.length },
    { Métrica: 'Total activos', Valor: totalActivos },
    { Métrica: 'Total cerrados', Valor: totalCerrados },
    { Métrica: 'Promedio duración (minutos)', Valor: getAverageDurationMinutes(records) },
    { Métrica: 'Fecha del informe', Valor: reportDate },
  ];
}

function buildDetailRows(records, reportDate) {
  return records.map((record) => ({
    fecha: record.dia || reportDate,
    hora_entrada: record.hora_entrada || '',
    hora_salida: record.hora_salida || '',
    campus: record.sede || '',
    actividad: record.actividad || '',
    run: record.run || '',
    dv: record.dv || '',
    nombre_completo: record.nombre_completo || '',
    carrera: record.carrera || '',
    anio_ingreso: record.anio_ingreso || '',
    semestre_en_curso: record.semestre_en_curso || getCurrentSemester(record.dia || reportDate),
    tematica: record.tematica || '',
    espacio: record.espacio || '',
    observaciones: record.observaciones || '',
  }));
}

function applyColumnWidths(sheet, headers) {
  sheet['!cols'] = headers.map((header) => ({
    wch: Math.max(
      String(header).length + 2,
      Math.min(
        40,
        (sheetToJson(sheet, headers).reduce((max, row) => {
          return Math.max(max, String(row[header] || '').length + 2);
        }, 0))
      )
    ),
  }));
}

function sheetToJson(sheet, headers) {
  return XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  }).map((row) => headers.reduce((acc, header) => {
    acc[header] = row[header] || '';
    return acc;
  }, {}));
}

function appendSheet(workbook, name, rows, headers) {
  const safeRows = rows.length
    ? rows
    : [headers.reduce((accumulator, header) => {
      accumulator[header] = '';
      return accumulator;
    }, {})];
  const sheet = XLSX.utils.json_to_sheet(safeRows, { header: headers });
  applyColumnWidths(sheet, headers);
  XLSX.utils.book_append_sheet(workbook, sheet, name);
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
    const workbook = XLSX.utils.book_new();

    appendSheet(workbook, 'Resumen', buildSummaryRows(rows, dia), SUMMARY_HEADERS);
    appendSheet(workbook, 'Actividad', buildCountRows(rows, 'actividad', 'Actividad'), ['Actividad', 'Cantidad']);
    appendSheet(workbook, 'Temática', buildCountRows(rows, 'tematica', 'Temática'), ['Temática', 'Cantidad']);
    appendSheet(workbook, 'Campus', buildCountRows(rows, 'sede', 'Campus'), ['Campus', 'Cantidad']);
    appendSheet(workbook, 'Registros', buildDetailRows(rows, dia), DETAIL_HEADERS);

    const buffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'buffer',
      compression: true,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=informe_uso_ciac.xlsx');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({
      error: 'No se pudo generar el informe de uso.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
