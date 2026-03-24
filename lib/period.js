const { CHILE_TIMEZONE } = require('./reporting');

function getChileDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')) };
}

function buildPeriod(yearInput, monthInput) {
  const now = getChileDateParts();
  const year = Number.parseInt(yearInput, 10) || now.year;
  const month = String(monthInput || now.month);

  if (month === 'all') {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    return { year, month: 'all', start, end, label: `${year} completo` };
  }

  const monthNumber = Math.min(12, Math.max(1, Number.parseInt(month, 10) || now.month));
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const start = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
  const end = `${year}-${String(monthNumber).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { year, month: monthNumber, start, end, label: `${start} a ${end}` };
}

function applyCommonFilters(query, reqQuery = {}) {
  const campus = String(reqQuery.campus || '').trim();
  const actividad = String(reqQuery.actividad || '').trim();
  const tematica = String(reqQuery.tematica || reqQuery.motivo || '').trim();

  if (campus) query.sede = `eq.${campus}`;
  if (actividad) query.actividad = `eq.${actividad}`;
  if (tematica) query.tematica = `eq.${tematica}`;
  return { campus, actividad, tematica };
}

module.exports = {
  buildPeriod,
  applyCommonFilters,
};
