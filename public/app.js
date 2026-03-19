const { supabaseGet } = require('../lib/supabase');

const CHILE_TIMEZONE = 'America/Santiago';

const RECORD_SELECT = [
  'id',
  'dia',
  'hora_entrada',
  'hora_salida',
  'sede',
  'actividad',
  'tematica',
  'espacio',
  'observaciones',
  'carrera',
  'anio_ingreso',
  'created_at',
].join(',');

function getChileDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function normalizeLabel(value, fallback = 'No informado') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function parseDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getAverageDurationMinutes(records) {
  const durations = records
    .map((record) => {
      const start = parseDateTime(record.hora_entrada);
      const end = parseDateTime(record.hora_salida);
      if (!start || !end) return null;
      const diff = Math.round((end.getTime() - start.getTime()) / 60000);
      return diff >= 0 ? diff : null;
    })
    .filter((value) => Number.isFinite(value));

  if (!durations.length) return 0;
  const total = durations.reduce((sum, value) => sum + value, 0);
  return Math.round(total / durations.length);
}

function groupByCount(records, key, label) {
  const grouped = records.reduce((accumulator, record) => {
    const currentLabel = normalizeLabel(record[key]);
    accumulator.set(currentLabel, (accumulator.get(currentLabel) || 0) + 1);
    return accumulator;
  }, new Map());

  return Array.from(grouped.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([name, count]) => ({ [label]: name, cantidad: count }));
}

function buildRecentRecords(records) {
  return records.slice(0, 8).map((record) => ({
    id: record.id,
    dia: record.dia || '',
    hora_entrada: record.hora_entrada || null,
    hora_salida: record.hora_salida || null,
    campus: normalizeLabel(record.sede),
    actividad: normalizeLabel(record.actividad),
    tematica: normalizeLabel(record.tematica),
    espacio: normalizeLabel(record.espacio),
    carrera: normalizeLabel(record.carrera),
    anio_ingreso: record.anio_ingreso || '',
    observaciones: String(record.observaciones || '').trim(),
    estado: record.hora_salida ? 'Cerrado' : 'Activo',
  }));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const dia = getChileDate();
    const campus = String(req.query.campus || '').trim();

    const query = {
      select: RECORD_SELECT,
      dia: `eq.${dia}`,
      order: 'hora_entrada.desc',
    };

    if (campus) {
      query.sede = `eq.${campus}`;
    }

    const registros = await supabaseGet('attendance_records', query);
    const rows = Array.isArray(registros) ? registros : [];

    const totalActivos = rows.filter((record) => !record.hora_salida).length;
    const totalCerrados = rows.length - totalActivos;

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      date: dia,
      campus: campus || null,
      summary: {
        total_registros: rows.length,
        total_activos: totalActivos,
        total_cerrados: totalCerrados,
        promedio_duracion_minutos: getAverageDurationMinutes(rows),
      },
      by_actividad: groupByCount(rows, 'actividad', 'actividad'),
      by_tematica: groupByCount(rows, 'tematica', 'tematica'),
      by_campus: groupByCount(rows, 'sede', 'campus'),
      by_espacio: groupByCount(rows, 'espacio', 'espacio'),
      recent_records: buildRecentRecords(rows),
    });
  } catch (error) {
    return res.status(500).json({
      error: 'No se pudo generar el informe de uso.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
