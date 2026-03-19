const reportBody = document.getElementById('report-records-body');
const reportMessage = document.getElementById('report-message');
const reportCount = document.getElementById('report-count');
const reportCampus = document.getElementById('report-campus');
const reportDate = document.getElementById('report-date');
const exportButton = document.getElementById('report-export-button');

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

function renderRecords(records) {
  const visibleRecords = getVisibleRecords(Array.isArray(records) ? records : []);
  reportCampus.textContent = `Campus: ${selectedCampus || 'Todos'}`;
  reportCount.textContent = `${visibleRecords.length} registro${visibleRecords.length === 1 ? '' : 's'}`;
  reportDate.textContent = `Fecha ${formatDateLabel()}`;

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

loadRecords().catch((error) => {
  showMessage(error.message || 'No se pudieron cargar los registros del informe.', 'error');
  reportBody.innerHTML = '<tr><td colspan="9" class="empty">No fue posible cargar el informe.</td></tr>';
  reportCount.textContent = '0 registros';
  reportCampus.textContent = `Campus: ${selectedCampus || 'Todos'}`;
  reportDate.textContent = `Fecha ${formatDateLabel()}`;
});
