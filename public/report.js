const statusNode = document.getElementById('report-status');
const contentNode = document.getElementById('report-content');
const reportDateNode = document.getElementById('report-date');
const reportCampusNode = document.getElementById('report-campus');
const backButton = document.getElementById('back-button');
const printButton = document.getElementById('print-button');

const metricNodes = {
  total_registros: document.getElementById('metric-total-registros'),
  total_activos: document.getElementById('metric-total-activos'),
  total_cerrados: document.getElementById('metric-total-cerrados'),
  promedio_duracion_minutos: document.getElementById('metric-promedio-duracion'),
};

const tableNodes = {
  actividad: document.getElementById('table-actividad'),
  tematica: document.getElementById('table-tematica'),
  campus: document.getElementById('table-campus'),
  espacio: document.getElementById('table-espacio'),
  recientes: document.getElementById('table-recientes'),
};

const charts = [];

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setStatus(message, type = 'loading') {
  statusNode.innerHTML = `<div class="status-card status-card--${type}">${escapeHtml(message)}</div>`;
  statusNode.hidden = false;
}

function hideStatus() {
  statusNode.hidden = true;
  statusNode.innerHTML = '';
}

function formatDateLabel(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Santiago',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Santiago',
  }).format(date);
}

function renderMetric(summary) {
  metricNodes.total_registros.textContent = summary.total_registros || 0;
  metricNodes.total_activos.textContent = summary.total_activos || 0;
  metricNodes.total_cerrados.textContent = summary.total_cerrados || 0;
  metricNodes.promedio_duracion_minutos.textContent = `${summary.promedio_duracion_minutos || 0} min`;
}

function buildSimpleRows(items, labelKey, emptyLabel) {
  if (!Array.isArray(items) || !items.length) {
    return `<tr class="empty-row"><td colspan="2">${escapeHtml(emptyLabel)}</td></tr>`;
  }

  return items.map((item) => `
    <tr>
      <td>${escapeHtml(item[labelKey])}</td>
      <td>${escapeHtml(item.cantidad)}</td>
    </tr>
  `).join('');
}

function renderTables(data) {
  tableNodes.actividad.innerHTML = buildSimpleRows(data.by_actividad, 'actividad', 'Sin datos por actividad.');
  tableNodes.tematica.innerHTML = buildSimpleRows(data.by_tematica, 'tematica', 'Sin datos por temática.');
  tableNodes.campus.innerHTML = buildSimpleRows(data.by_campus, 'campus', 'Sin datos por campus.');
  tableNodes.espacio.innerHTML = buildSimpleRows(data.by_espacio, 'espacio', 'Sin datos por espacio.');

  if (!Array.isArray(data.recent_records) || !data.recent_records.length) {
    tableNodes.recientes.innerHTML = '<tr class="empty-row"><td colspan="8">No hay registros recientes para mostrar.</td></tr>';
    return;
  }

  tableNodes.recientes.innerHTML = data.recent_records.map((record) => {
    const statusClass = record.estado === 'Activo' ? 'status-pill--activo' : 'status-pill--cerrado';
    return `
      <tr>
        <td>${escapeHtml(record.campus)}</td>
        <td>${escapeHtml(record.actividad)}</td>
        <td>${escapeHtml(record.tematica)}</td>
        <td>${escapeHtml(record.espacio)}</td>
        <td>${escapeHtml(record.carrera)}</td>
        <td>${escapeHtml(formatDateTime(record.hora_entrada))}</td>
        <td>${escapeHtml(formatDateTime(record.hora_salida))}</td>
        <td><span class="status-pill ${statusClass}">${escapeHtml(record.estado)}</span></td>
      </tr>
    `;
  }).join('');
}

function destroyCharts() {
  while (charts.length) {
    const chart = charts.pop();
    chart.destroy();
  }
}

function createChart(canvasId, config) {
  const element = document.getElementById(canvasId);
  if (!element || typeof Chart === 'undefined') {
    return;
  }

  charts.push(new Chart(element, config));
}

function createBarChart(canvasId, labels, values, color) {
  createChart(canvasId, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: color,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

function createDoughnutChart(canvasId, labels, values) {
  createChart(canvasId, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#003b71', '#4d7ea8', '#7fa6c4', '#a9c2d8', '#d0deea'],
        borderColor: '#ffffff',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 14, usePointStyle: true },
        },
      },
    },
  });
}

function renderCharts(data) {
  destroyCharts();

  createBarChart(
    'chart-actividad',
    (data.by_actividad || []).map((item) => item.actividad),
    (data.by_actividad || []).map((item) => item.cantidad),
    '#003b71'
  );

  createBarChart(
    'chart-tematica',
    (data.by_tematica || []).map((item) => item.tematica),
    (data.by_tematica || []).map((item) => item.cantidad),
    '#4d7ea8'
  );

  createDoughnutChart(
    'chart-campus',
    (data.by_campus || []).map((item) => item.campus),
    (data.by_campus || []).map((item) => item.cantidad)
  );
}

async function loadReport() {
  setStatus('Cargando informe de uso...', 'loading');
  contentNode.hidden = true;

  const params = new URLSearchParams(window.location.search);
  const campus = params.get('campus');
  const endpoint = campus
    ? `/api/report-data?campus=${encodeURIComponent(campus)}`
    : '/api/report-data';

  try {
    const response = await fetch(endpoint);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.detail || 'No fue posible cargar el informe.');
    }

    reportDateNode.textContent = formatDateLabel(data.date);
    reportCampusNode.textContent = data.campus || 'Todos los campus';
    renderMetric(data.summary || {});
    renderTables(data);

    if (!data.summary || !data.summary.total_registros) {
      setStatus('No hay registros para el período consultado. El informe se muestra en estado vacío.', 'empty');
    } else {
      hideStatus();
    }

    renderCharts(data);
    contentNode.hidden = false;
  } catch (error) {
    setStatus(error.message || 'No fue posible cargar el informe de uso.', 'error');
    contentNode.hidden = true;
  }
}

backButton.addEventListener('click', () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = '/';
});

printButton.addEventListener('click', () => {
  window.print();
});

loadReport();
