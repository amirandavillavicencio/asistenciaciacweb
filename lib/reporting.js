const CHILE_TIMEZONE = 'America/Santiago';
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function normalizeLabel(value, fallback = 'Sin información') {
  return String(value || '').trim() || fallback;
}

function parseDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function getMinutes(record) {
  const start = parseDate(record.hora_entrada)?.getTime();
  const end = parseDate(record.hora_salida)?.getTime();
  if (!start || !end || end <= start) {
    return null;
  }
  return (end - start) / 60000;
}

function countBy(records, key, fallback) {
  return records.reduce((acc, row) => {
    const label = normalizeLabel(row[key], fallback);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function toPctMap(countMap, total) {
  return Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      percentage: total ? Number(((count / total) * 100).toFixed(1)) : 0,
    }));
}

function getChileWeekdayLabel(date) {
  const weekday = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    timeZone: CHILE_TIMEZONE,
  }).format(date).toLowerCase();

  if (weekday.includes('lunes')) return 'Lunes';
  if (weekday.includes('martes')) return 'Martes';
  if (weekday.includes('miércoles') || weekday.includes('miercoles')) return 'Miércoles';
  if (weekday.includes('jueves')) return 'Jueves';
  if (weekday.includes('viernes')) return 'Viernes';
  return null;
}

function getHourRangeLabel(dateValue) {
  const date = parseDate(dateValue);
  if (!date) return 'Sin hora';
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    timeZone: CHILE_TIMEZONE,
  }).format(date));
  const end = (hour + 1) % 24;
  return `${String(hour).padStart(2, '0')}:00-${String(end).padStart(2, '0')}:00`;
}

function getDateOnly(dateValue) {
  const date = parseDate(dateValue);
  if (!date) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function businessDayAverage(records) {
  const set = new Set(records.map((r) => getDateOnly(r.hora_entrada || r.created_at)).filter(Boolean));
  const days = set.size;
  return {
    days,
    average: days ? Number((records.length / days).toFixed(2)) : 0,
  };
}

function buildAnalytics(records) {
  const safeRecords = Array.isArray(records) ? records : [];
  const total = safeRecords.length;
  const uniqueStudents = new Set(safeRecords.map((r) => `${r.run || ''}-${r.dv || ''}`)).size;
  const durations = safeRecords.map(getMinutes).filter((n) => Number.isFinite(n));
  const averageDurationMinutes = durations.length
    ? Number((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2))
    : 0;

  const campusCounts = countBy(safeRecords, 'sede', 'Sin sede');
  const activityCounts = countBy(safeRecords, 'actividad', 'Sin actividad');
  const topicCounts = countBy(safeRecords, 'tematica', 'Sin temática');
  const spaceCounts = countBy(safeRecords, 'espacio', 'Sin espacio');
  const careerCounts = countBy(safeRecords, 'carrera', 'Sin carrera');
  const yearCounts = countBy(safeRecords, 'anio_ingreso', 'Sin año');

  const recurrentStudents = Object.entries(
    safeRecords.reduce((acc, row) => {
      const key = `${row.run || ''}-${row.dv || ''}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  )
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([student, count]) => ({ student, visits: count }));

  const weekdayBase = WEEKDAYS.reduce((acc, day) => ({ ...acc, [day]: 0 }), {});
  safeRecords.forEach((row) => {
    const label = getChileWeekdayLabel(parseDate(row.hora_entrada || row.created_at));
    if (label && weekdayBase[label] !== undefined) weekdayBase[label] += 1;
  });

  const hourlyCounts = safeRecords.reduce((acc, row) => {
    const range = getHourRangeLabel(row.hora_entrada || row.created_at);
    acc[range] = (acc[range] || 0) + 1;
    return acc;
  }, {});

  const perDay = businessDayAverage(safeRecords);
  const activityList = toPctMap(activityCounts, total);
  const topicList = toPctMap(topicCounts, total);

  const topDay = Object.entries(weekdayBase).sort((a, b) => b[1] - a[1])[0] || ['Sin datos', 0];
  const lowDay = Object.entries(weekdayBase).sort((a, b) => a[1] - b[1])[0] || ['Sin datos', 0];

  return {
    executive: {
      total,
      uniqueStudents,
      averagePerBusinessDay: perDay.average,
      businessDays: perDay.days,
      averageDurationMinutes,
      campusDistribution: toPctMap(campusCounts, total),
    },
    activity: {
      rows: activityList,
      top: activityList[0] || null,
    },
    topic: {
      rows: topicList,
      top: topicList[0] || null,
    },
    spaces: {
      rows: Object.entries(spaceCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
      peakHours: Object.entries(hourlyCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([range, count]) => ({ range, count })),
    },
    students: {
      recurrent: recurrentStudents,
      careers: Object.entries(careerCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
      admissionYears: Object.entries(yearCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
    },
    temporal: {
      weekday: WEEKDAYS.map((day) => ({ day, count: weekdayBase[day] || 0 })),
      maxDay: { day: topDay[0], count: topDay[1] },
      minDay: { day: lowDay[0], count: lowDay[1] },
    },
  };
}

function getMonthLabel(monthIndex) {
  return MONTHS[monthIndex - 1] || `Mes ${monthIndex}`;
}

module.exports = {
  CHILE_TIMEZONE,
  MONTHS,
  WEEKDAYS,
  buildAnalytics,
  getMonthLabel,
};
