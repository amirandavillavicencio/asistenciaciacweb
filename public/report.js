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

const params = new URLSearchParams(window.location.search);
const selectedCampus = params.get('campus') || '';

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

function getVisibleRecords(records) {
  if (!selectedCampus) {
    return records;
  }

  return records.filter((record) => record.sede === selectedCampus);
}

function summarizeCounts(records, key, fallbackLabel) {
  return records.reduce((acc, record) => {
    const label = String(record[key] || fallbackLabel).trim() || fallbackLabel;
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

function renderRecords(records) {
  window.__REPORT_RECORDS__ = Array.isArray(records) ? records : [];
  const visibleRecords = getVisibleRecords(window.__REPORT_RECORDS__);
  const openRecords = visibleRecords.filter((record) => !record.hora_salida).length;
  const closedRecords = visibleRecords.length - openRecords;
  const averageDuration = getAverageDuration(visibleRecords);

  reportCampus.textContent = `Campus: ${selectedCampus || 'Todos'}`;
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
    reportBody.innerHTML = '<tr><td colspan="9" class="empty">No hay registros del día para el filtro seleccionado.</td></tr>';
    return;
  }

  reportBody.innerHTML = visibleRecords.map((record) => `
    <tr>
      <td>${escapeHtml(record.run || '—')}</td>
      <td>${escapeHtml(record.dv || '—')}</td>
      <td>${escapeHtml(record.carrera || '—')}</td>
      <td>${escapeHtml(record.sede || '—')}</td>
      <td>${escapeHtml(formatDateTime(record.hora_entrada))}</td>
      <td>${escapeHtml(formatDateTime(record.hora_salida))}</td>
      <td>${escapeHtml(record.actividad || '—')}</td>
      <td>${escapeHtml(record.tematica || '—')}</td>
      <td>${escapeHtml(normalizeState(record))}</td>
    </tr>
  `).join('');
}

async function loadRecords() {
  clearMessage();
  const response = await fetch('/api/registros-hoy');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(buildApiError(data, 'No se pudieron cargar los registros del informe.'));
  }

  renderRecords(data.registros || []);
}

async function exportReport() {
  clearMessage();
  exportButton.disabled = true;
  exportButton.textContent = 'Exportando...';

  try {
    const response = await fetch('/api/export-report');
    const contentType = response.headers.get('Content-Type') || '';
    const isJsonResponse = contentType.includes('application/json');

    if (!response.ok) {
      const data = isJsonResponse ? await response.json() : null;
      throw new Error(buildApiError(data, 'No se pudo exportar el informe.'));
    }

    if (isJsonResponse) {
      const data = await response.json();
      throw new Error(buildApiError(data, 'El endpoint no devolvió un archivo descargable.'));
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)"?/i);
    const filename = match ? decodeURIComponent(match[1]) : 'reporte.csv';
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
    exportButton.textContent = 'Exportar Excel';
  }
}

exportButton.addEventListener('click', exportReport);
window.addEventListener('resize', () => drawHourlyChart(getVisibleRecords(window.__REPORT_RECORDS__ || [])));

loadRecords().catch((error) => {
  showMessage(error.message || 'No se pudieron cargar los registros del informe.', 'error');
  reportBody.innerHTML = '<tr><td colspan="9" class="empty">No fue posible cargar el informe.</td></tr>';
  reportCount.textContent = '0';
  reportOpenCount.textContent = '0';
  reportClosedCount.textContent = '0';
  reportDurationAverage.textContent = '—';
  reportCampus.textContent = `Campus: ${selectedCampus || 'Todos'}`;
  reportDate.textContent = `Fecha ${formatDateLabel()}`;
  createBars(activityBars, {}, 'No hay actividades registradas.');
  createBars(campusBars, {}, 'No hay sedes registradas.');
  renderHighlights([]);
  drawHourlyChart([]);
});

