const reportBody = document.getElementById('report-records-body');
const reportMessage = document.getElementById('report-message');
const reportCount = document.getElementById('report-count');
const reportOpenCount = document.getElementById('report-open-count');
const reportClosedCount = document.getElementById('report-closed-count');
const reportDurationAverage = document.getElementById('report-duration-average');
const reportCampus = document.getElementById('report-campus');
const reportDate = document.getElementById('report-date');
const exportButton = document.getElementById('report-export-button');
const activityBars = document.getElementById('activity-bars');
const campusBars = document.getElementById('campus-bars');
const activityTotal = document.getElementById('activity-total');
const campusTotal = document.getElementById('campus-total');
const reportHighlights = document.getElementById('report-highlights');
const hourlyChart = document.getElementById('hourly-chart');
const campusFilter = document.getElementById('report-filter-campus');
const topicFilter = document.getElementById('report-filter-topic');
const activityFilter = document.getElementById('report-filter-activity');
const clearFiltersButton = document.getElementById('report-clear-filters');
const yearFilter = document.getElementById('report-filter-year');
const monthFilter = document.getElementById('report-filter-month');
const rutFilter = document.getElementById('report-filter-rut');
const rankingBody = document.getElementById('report-ranking-body');

const params = new URLSearchParams(window.location.search);
const DEFAULT_FILTERS = {
  campus: params.get('campus') || '',
  topic: params.get('motivo') || params.get('tematica') || '',
  activity: params.get('actividad') || '',
  rut: params.get('rut') || params.get('run') || '',
  year: params.get('year') || String(new Date().getFullYear()),
  month: params.get('month') || 'all',
};

window.__REPORT_RECORDS__ = [];
window.__REPORT_RANKING__ = [];
let activeFilters = { ...DEFAULT_FILTERS };

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showMessage(text, type) {
  reportMessage.textContent = text;
  reportMessage.className = `message is-visible message--${type}`;
}

function clearMessage() {
  reportMessage.textContent = '';
  reportMessage.className = 'message';
}

function buildApiError(data, fallback) {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  return data.error || fallback;
}

function formatDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Santiago',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Santiago',
  }).format(parsed);
}

function getHourLabel(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'America/Santiago',
  }).format(parsed);
}

function normalizeState(record) {
  if (record.estado) {
    return record.estado;
  }

  return record.hora_salida ? 'salida' : 'entrada';
}

function normalizeRunFromInput(value) {
  const compact = String(value || '')
    .replaceAll('.', '')
    .replace(/\s+/g, '');
  const [runPart = ''] = compact.split('-');
  return runPart.replace(/\D/g, '');
}

function formatRut(run, dv) {
  const cleanRun = String(run || '').replace(/\D/g, '');
  const cleanDv = String(dv || '').trim().toUpperCase();

  if (!cleanRun) return '—';
  const withDots = cleanRun.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return cleanDv ? `${withDots}-${cleanDv}` : withDots;
}

function normalizeLabel(value, fallback) {
  return String(value || fallback).trim() || fallback;
}

function getUniqueValues(records, key, fallbackLabel) {
  return [...new Set(records.map((record) => normalizeLabel(record[key], fallbackLabel)))].sort((a, b) => a.localeCompare(b, 'es-CL'));
}

function fillSelectOptions(select, values, placeholder) {
  if (!select) {
    return;
  }

  const currentValue = select.value;
  const options = [`<option value="">${escapeHtml(placeholder)}</option>`]
    .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`));

  select.innerHTML = options.join('');
  select.value = values.includes(currentValue) ? currentValue : '';
}

function syncFilterControls() {
  if (campusFilter) {
    campusFilter.value = activeFilters.campus;
  }
  if (topicFilter) {
    topicFilter.value = activeFilters.topic;
  }
  if (activityFilter) {
    activityFilter.value = activeFilters.activity;
  }
  if (rutFilter) {
    rutFilter.value = activeFilters.rut;
  }
  if (yearFilter) {
    yearFilter.value = activeFilters.year;
  }
  if (monthFilter) {
    monthFilter.value = activeFilters.month;
  }
}

function updateFilterOptions(records) {
  fillSelectOptions(campusFilter, getUniqueValues(records, 'sede', 'Sin sede'), 'Todos los campus');
  fillSelectOptions(topicFilter, getUniqueValues(records, 'tematica', 'Sin motivo'), 'Todos los motivos');
  fillSelectOptions(activityFilter, getUniqueValues(records, 'actividad', 'Sin actividad'), 'Todas las actividades');
  syncFilterControls();
}

function initPeriodFilters() {
  if (!yearFilter) return;
  const nowYear = new Date().getFullYear();
  const years = [nowYear - 2, nowYear - 1, nowYear, nowYear + 1];
  yearFilter.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join('');
}

function updateUrlFilters() {
  const nextParams = new URLSearchParams(window.location.search);
  const mappings = [
    ['campus', activeFilters.campus],
    ['motivo', activeFilters.topic],
    ['actividad', activeFilters.activity],
    ['rut', activeFilters.rut],
    ['year', activeFilters.year],
    ['month', activeFilters.month],
  ];

  mappings.forEach(([key, value]) => {
    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
  });
  nextParams.delete('tematica');

  const nextQuery = nextParams.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

function getVisibleRecords(records) {
  const runFilter = normalizeRunFromInput(activeFilters.rut);
  return records.filter((record) => {
    const campusLabel = normalizeLabel(record.sede, 'Sin sede');
    const topicLabel = normalizeLabel(record.tematica, 'Sin motivo');
    const activityLabel = normalizeLabel(record.actividad, 'Sin actividad');
    const run = String(record.run || '').replace(/\D/g, '');

    return (!activeFilters.campus || campusLabel === activeFilters.campus)
      && (!activeFilters.topic || topicLabel === activeFilters.topic)
      && (!activeFilters.activity || activityLabel === activeFilters.activity)
      && (!runFilter || run === runFilter);
  });
}

function summarizeCounts(records, key, fallbackLabel) {
  return records.reduce((acc, record) => {
    const label = normalizeLabel(record[key], fallbackLabel);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '—';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  if (hours <= 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainingMinutes} min`;
}

function getMonthLabel(monthValue) {
  const month = Number.parseInt(monthValue, 10);
  const date = new Date(2024, month - 1, 1);

  if (!Number.isInteger(month) || month < 1 || month > 12 || Number.isNaN(date.getTime())) {
    return 'Todos los meses';
  }

  const label = new Intl.DateTimeFormat('es-CL', { month: 'long', timeZone: 'America/Santiago' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getAverageDuration(records) {
  const durations = records
    .map((record) => {
      if (!record.hora_entrada || !record.hora_salida) {
        return null;
      }

      const start = new Date(record.hora_entrada).getTime();
      const end = new Date(record.hora_salida).getTime();

      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return null;
      }

      return (end - start) / 60000;
    })
    .filter((value) => Number.isFinite(value));

  if (!durations.length) {
    return null;
  }

  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
}

function createBars(container, counts, emptyText) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    container.innerHTML = `<p class="report-empty">${escapeHtml(emptyText)}</p>`;
    return;
  }

  const max = Math.max(...entries.map(([, total]) => total), 1);
  const totalRecords = entries.reduce((sum, [, total]) => sum + total, 0);

  container.innerHTML = entries.map(([label, total]) => {
    const width = Math.max((total / max) * 100, 6);
    const percentage = Math.round((total / totalRecords) * 100);

    return `
      <div class="report-bar-row">
        <div class="report-bar-row__header">
          <span>${escapeHtml(label)}</span>
          <strong>${total} · ${percentage}%</strong>
        </div>
        <div class="report-bar-track">
          <span class="report-bar-fill" style="width: ${width}%"></span>
        </div>
      </div>
    `;
  }).join('');
}

function drawHourlyChart(records) {
  if (!hourlyChart) {
    return;
  }

  const context = hourlyChart.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = hourlyChart.clientWidth || 720;
  const cssHeight = 280;
  hourlyChart.width = cssWidth * dpr;
  hourlyChart.height = cssHeight * dpr;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  const hourCounts = Array.from({ length: 13 }, (_, index) => ({
    label: `${String(index + 8).padStart(2, '0')}:00`,
    total: 0,
  }));

  records.forEach((record) => {
    const hourLabel = getHourLabel(record.hora_entrada);
    const hour = Number.parseInt(hourLabel, 10);

    if (Number.isInteger(hour) && hour >= 8 && hour <= 20) {
      hourCounts[hour - 8].total += 1;
    }
  });

  const maxValue = Math.max(...hourCounts.map((item) => item.total), 1);
  const padding = { top: 24, right: 12, bottom: 48, left: 38 };
  const plotWidth = cssWidth - padding.left - padding.right;
  const plotHeight = cssHeight - padding.top - padding.bottom;
  const stepX = plotWidth / Math.max(hourCounts.length - 1, 1);

  context.strokeStyle = '#d5dee7';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(padding.left, padding.top);
  context.lineTo(padding.left, padding.top + plotHeight);
  context.lineTo(padding.left + plotWidth, padding.top + plotHeight);
  context.stroke();

  context.fillStyle = '#6b7c8c';
  context.font = '12px "Source Sans 3", sans-serif';

  for (let index = 0; index <= 4; index += 1) {
    const y = padding.top + (plotHeight / 4) * index;
    const value = Math.round(maxValue - (maxValue / 4) * index);

    context.strokeStyle = '#edf2f6';
    context.beginPath();
    context.moveTo(padding.left, y);
    context.lineTo(padding.left + plotWidth, y);
    context.stroke();

    context.fillText(String(value), 10, y + 4);
  }

  context.strokeStyle = '#0a4c86';
  context.lineWidth = 3;
  context.beginPath();

  hourCounts.forEach((item, index) => {
    const x = padding.left + stepX * index;
    const y = padding.top + plotHeight - (item.total / maxValue) * plotHeight;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();

  hourCounts.forEach((item, index) => {
    const x = padding.left + stepX * index;
    const y = padding.top + plotHeight - (item.total / maxValue) * plotHeight;

    context.fillStyle = '#0a4c86';
    context.beginPath();
    context.arc(x, y, 4, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#3f5163';
    context.fillText(item.label, x - 14, cssHeight - 18);
    context.fillText(String(item.total), x - 4, y - 10);
  });
}

function renderHighlights(records) {
  if (!records.length) {
    reportHighlights.innerHTML = '<li class="report-empty">No hay datos suficientes para generar hallazgos.</li>';
    return;
  }

  const activityCounts = summarizeCounts(records, 'actividad', 'Sin actividad');
  const campusCounts = summarizeCounts(records, 'sede', 'Sin sede');
  const topActivity = Object.entries(activityCounts).sort((a, b) => b[1] - a[1])[0];
  const topCampus = Object.entries(campusCounts).sort((a, b) => b[1] - a[1])[0];
  const openCount = records.filter((record) => !record.hora_salida).length;
  const averageDuration = getAverageDuration(records);

  const items = [
    `La actividad con mayor demanda es ${topActivity ? `${topActivity[0]} (${topActivity[1]})` : 'sin información'}.`,
    `La sede con más movimiento es ${topCampus ? `${topCampus[0]} (${topCampus[1]})` : 'sin información'}.`,
    `Actualmente hay ${openCount} registro${openCount === 1 ? '' : 's'} activo${openCount === 1 ? '' : 's'} sin salida.`,
    averageDuration
      ? `La permanencia promedio del día alcanza ${formatDuration(averageDuration)}.`
      : 'Aún no hay suficientes salidas registradas para calcular permanencia promedio.',
  ];

  reportHighlights.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function getActiveFilterSummary() {
  const labels = [];

  if (activeFilters.campus) {
    labels.push(activeFilters.campus);
  }
  if (activeFilters.topic) {
    labels.push(`Motivo: ${activeFilters.topic}`);
  }
  if (activeFilters.activity) {
    labels.push(`Actividad: ${activeFilters.activity}`);
  }
  if (activeFilters.rut) {
    labels.push(`RUT: ${formatRut(normalizeRunFromInput(activeFilters.rut), '')}`);
  }

  return labels.length ? labels.join(' · ') : 'Todos';
}

function renderRanking(rankingRows = []) {
  const rows = Array.isArray(rankingRows) ? rankingRows : [];
  window.__REPORT_RANKING__ = rows;

  if (!rankingBody) {
    return;
  }

  if (!rows.length) {
    rankingBody.innerHTML = '<tr><td colspan="4" class="empty">Sin datos para ranking con los filtros actuales.</td></tr>';
    return;
  }

  rankingBody.innerHTML = rows.map((row, index) => `
    <tr>
      <td>${escapeHtml(row.position || index + 1)}</td>
      <td>
        <div class="student-cell">
          <strong>${escapeHtml(row.student || 'Sin nombre')}</strong>
          <span class="student-cell__meta">${escapeHtml(row.rut || formatRut(row.run, row.dv))}</span>
        </div>
      </td>
      <td>${escapeHtml(row.carrera || 'Sin carrera')}</td>
      <td>${escapeHtml(row.totalAsistencias || 0)}</td>
    </tr>
  `).join('');
}

function renderRecords(records, rankingRows = []) {
  window.__REPORT_RECORDS__ = Array.isArray(records) ? records : [];
  renderRanking(rankingRows);
  updateFilterOptions(window.__REPORT_RECORDS__);
  const visibleRecords = getVisibleRecords(window.__REPORT_RECORDS__);
  const openRecords = visibleRecords.filter((record) => !record.hora_salida).length;
  const closedRecords = visibleRecords.length - openRecords;
  const averageDuration = getAverageDuration(visibleRecords);

  reportCampus.textContent = `Filtros: ${getActiveFilterSummary()}`;
  reportCount.textContent = String(visibleRecords.length);
  reportOpenCount.textContent = String(openRecords);
  reportClosedCount.textContent = String(closedRecords);
  reportDurationAverage.textContent = formatDuration(averageDuration);
  reportDate.textContent = `Fecha ${formatDateLabel()}`;

  createBars(activityBars, summarizeCounts(visibleRecords, 'actividad', 'Sin actividad'), 'No hay actividades registradas.');
  createBars(campusBars, summarizeCounts(visibleRecords, 'sede', 'Sin sede'), 'No hay sedes registradas.');
  activityTotal.textContent = `${Object.keys(summarizeCounts(visibleRecords, 'actividad', 'Sin actividad')).length} categorías`;
  campusTotal.textContent = `${Object.keys(summarizeCounts(visibleRecords, 'sede', 'Sin sede')).length} sedes`;
  renderHighlights(visibleRecords);
  drawHourlyChart(visibleRecords);

  if (!visibleRecords.length) {
    reportBody.innerHTML = '<tr><td colspan="9" class="empty">No hay registros del día para los filtros seleccionados.</td></tr>';
    return;
  }

  reportBody.innerHTML = visibleRecords.map((record) => `
    <tr>
      <td>${escapeHtml(record.run || '—')}</td>
      <td>${escapeHtml(record.dv || '—')}</td>
      <td>${escapeHtml(record.carrera || '—')}</td>
      <td>${escapeHtml(record.sede || '—')}</td>
      <td>${escapeHtml(record.anio_ingreso || '—')}</td>
      <td>${escapeHtml(record.tematica || '—')}</td>
      <td>${escapeHtml(normalizeState(record))}</td>
      <td>${escapeHtml(formatDateTime(record.hora_entrada))}</td>
      <td>${escapeHtml(formatDateTime(record.hora_salida))}</td>
    </tr>
  `).join('');
}

function getReportSnapshot() {
  const visibleRecords = getVisibleRecords(window.__REPORT_RECORDS__ || []);
  const openRecords = visibleRecords.filter((record) => !record.hora_salida).length;
  const closedRecords = visibleRecords.length - openRecords;
  const averageDuration = getAverageDuration(visibleRecords);
  const periodLabel = activeFilters.month === 'all'
    ? 'Todos los meses'
    : `${getMonthLabel(activeFilters.month)} ${activeFilters.year}`;

  return {
    filters: {
      campus: activeFilters.campus || '',
      topic: activeFilters.topic || '',
      activity: activeFilters.activity || '',
      rut: activeFilters.rut || '',
      year: activeFilters.year || '',
      month: activeFilters.month || 'all',
      periodLabel,
    },
    metrics: {
      totalRecords: visibleRecords.length,
      activeEntries: openRecords,
      completedExits: closedRecords,
      averageDuration: formatDuration(averageDuration),
    },
    ranking: window.__REPORT_RANKING__ || [],
    records: visibleRecords,
  };
}

function applyFilters() {
  updateUrlFilters();
  renderRecords(window.__REPORT_RECORDS__ || [], window.__REPORT_RANKING__ || []);
}

function buildReportQuery() {
  const query = new URLSearchParams();

  if (activeFilters.campus) {
    query.set('campus', activeFilters.campus);
  }
  if (activeFilters.topic) {
    query.set('motivo', activeFilters.topic);
  }
  if (activeFilters.activity) {
    query.set('actividad', activeFilters.activity);
  }
  if (activeFilters.rut) {
    query.set('rut', activeFilters.rut);
  }
  query.set('year', activeFilters.year);
  query.set('month', activeFilters.month);

  return query.toString();
}

async function loadRecords() {
  clearMessage();
  reportBody.innerHTML = '<tr><td colspan="9" class="empty">Cargando registros...</td></tr>';

  const query = buildReportQuery();
  const response = await fetch(`/api/report-data${query ? `?${query}` : ''}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(buildApiError(data, 'No se pudieron cargar los registros del informe.'));
  }

  renderRecords(data.registros || [], data.ranking || []);
}

async function exportReport() {
  clearMessage();
  exportButton.disabled = true;
  exportButton.textContent = 'Exportando...';

  try {
    const snapshot = getReportSnapshot();
    const response = await fetch('/api/export-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snapshot),
    });
    const contentType = response.headers.get('Content-Type') || '';
    const isJsonResponse = contentType.includes('application/json');

    if (!response.ok) {
      const data = isJsonResponse ? await response.json() : null;
      throw new Error(buildApiError(data, 'No se pudo exportar el informe.'));
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)"?/i);
    const filename = match ? decodeURIComponent(match[1]) : 'informe-uso-ciac.pdf';
    const link = document.createElement('a');
    const objectUrl = window.URL.createObjectURL(blob);

    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
    showMessage('El informe se exportó correctamente.', 'success');
  } catch (error) {
    showMessage(error.message || 'No se pudo exportar el informe.', 'error');
  } finally {
    exportButton.disabled = false;
    exportButton.textContent = 'Exportar informe PDF';
  }
}

[campusFilter, topicFilter, activityFilter, rutFilter, yearFilter, monthFilter].forEach((element) => {
  element?.addEventListener('change', () => {
    activeFilters = {
      campus: campusFilter?.value || '',
      topic: topicFilter?.value || '',
      activity: activityFilter?.value || '',
      rut: rutFilter?.value || '',
      year: yearFilter?.value || String(new Date().getFullYear()),
      month: monthFilter?.value || 'all',
    };
    loadRecords().catch((error) => {
      showMessage(error.message || 'No se pudieron cargar los registros del informe.', 'error');
    });
  });
});

clearFiltersButton?.addEventListener('click', () => {
  activeFilters = { campus: '', topic: '', activity: '', rut: '', year: String(new Date().getFullYear()), month: 'all' };
  syncFilterControls();
  applyFilters();
  loadRecords().catch((error) => {
    showMessage(error.message || 'No se pudieron cargar los registros del informe.', 'error');
  });
});

exportButton.addEventListener('click', exportReport);
window.addEventListener('resize', () => drawHourlyChart(getVisibleRecords(window.__REPORT_RECORDS__ || [])));

initPeriodFilters();
syncFilterControls();
loadRecords().catch((error) => {
  showMessage(error.message || 'No se pudieron cargar los registros del informe.', 'error');
});
