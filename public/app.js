const CAMPUS_SPACES = {
  Vitacura: ['Espacio común'],
  'San Joaquín': ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6', 'Espacio común'],
};

const form = document.getElementById('registro-form');
const campusHeaderInput = document.getElementById('campus-header');
const runInput = document.getElementById('run');
const dvInput = document.getElementById('dv');
const carreraInput = document.getElementById('carrera');
const anioInput = document.getElementById('anio_ingreso');
const actividadInput = document.getElementById('actividad');
const tematicaInput = document.getElementById('tematica');
const observacionesInput = document.getElementById('observaciones');
const espacioInput = document.getElementById('espacio');
const exportButton = document.getElementById('export-button');
const exportReportButton = document.getElementById('export-report-button');
const messageBox = document.getElementById('message');
const autocompleteStatus = document.getElementById('autocomplete-status');
const submitButton = document.getElementById('submit-button');
const recordsBody = document.getElementById('records-body');
const recordsCount = document.getElementById('records-count');
const currentDate = document.getElementById('current-date');
const currentTime = document.getElementById('current-time');
const currentSemesterBadge = document.getElementById('current-semester');
const rutSalidaInput = document.getElementById('rut-salida-input');
const rutSalidaSearchButton = document.getElementById('rut-salida-search');
const rutSalidaResult = document.getElementById('rut-salida-result');
const rutSalidaMessage = document.getElementById('rut-salida-message');


let lookupTimer = null;
let activeCampusFilter = '';
let todayRecordsCache = [];
let rutSalidaLoading = false;

function sanitizeRun(value) {
  return String(value || '').replace(/\D/g, '');
}

function sanitizeDv(value) {
  return String(value || '').trim().toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);
}

function normalizarRut(valor) {
  return String(valor || '')
    .replace(/\./g, '')
    .replace('-', '')
    .trim()
    .toUpperCase();
}

function normalizarRutBusqueda(valor) {
  const raw = String(valor || '').trim().toUpperCase();
  const limpio = raw.replace(/\./g, '').replace(/\s+/g, '');

  if (!limpio) {
    return { run: '', dv: null };
  }

  if (limpio.includes('-')) {
    const [runPart, dvPart = ''] = limpio.split('-');
    const run = runPart.replace(/\D/g, '');
    const dv = dvPart.replace(/[^0-9K]/g, '').slice(0, 1) || null;
    return { run, dv };
  }

  const compactado = limpio.replace(/-/g, '');

  if (/^\d+$/.test(compactado)) {
    if (compactado.length >= 9) {
      return {
        run: compactado.slice(0, -1),
        dv: compactado.slice(-1),
      };
    }

    return { run: compactado, dv: null };
  }

  if (/^\d+[0-9K]$/.test(compactado)) {
    return {
      run: compactado.slice(0, -1),
      dv: compactado.slice(-1),
    };
  }

  return { run: '', dv: null };
}

function splitRut(valor) {
  const normalizado = normalizarRut(valor).replace(/[^0-9K]/g, '');

  if (normalizado.length < 2) {
    return null;
  }

  const run = normalizado.slice(0, -1).replace(/\D/g, '');
  const dv = normalizado.slice(-1).replace(/[^0-9K]/g, '');

  if (!run || !dv || run.length < 7 || run.length > 8) {
    return null;
  }

  return { run, dv, rut: `${run}-${dv}` };
}

function calculateDv(run) {
  let suma = 0;
  let multiplicador = 2;

  for (let i = run.length - 1; i >= 0; i -= 1) {
    suma += Number(run[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  if (resto === 11) return '0';
  if (resto === 10) return 'K';
  return String(resto);
}

function isValidRutInput(value) {
  const parts = splitRut(value);
  if (!parts) return false;
  return calculateDv(parts.run) === parts.dv;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showMessage(text, type) {
  if (!messageBox) return;
  messageBox.textContent = text;
  messageBox.className = `message is-visible message--${type}`;
}

function clearMessage() {
  if (!messageBox) return;
  messageBox.textContent = '';
  messageBox.className = 'message';
}

function buildApiError(data, fallback) {
  if (!data || typeof data !== 'object') {
    return fallback;
  }
  return data.error || fallback;
}

function getSelectedCampus() {
  return campusHeaderInput?.value || '';
}

function syncCampus(value) {
  if (!campusHeaderInput) return;
  campusHeaderInput.value = value;
  activeCampusFilter = value;
}

function updateEspacios() {
  if (!espacioInput) return;
  const selectedCampus = getSelectedCampus();
  const spaces = CAMPUS_SPACES[selectedCampus] || [];
  const previousValue = espacioInput.value;

  if (!spaces.length) {
    espacioInput.innerHTML = '<option value="">Selecciona primero el campus superior</option>';
    espacioInput.disabled = true;
    return;
  }

  espacioInput.innerHTML = ['<option value="">Selecciona espacio</option>']
    .concat(spaces.map((space) => `<option value="${escapeHtml(space)}">${escapeHtml(space)}</option>`))
    .join('');
  espacioInput.disabled = false;

  if (spaces.includes(previousValue)) {
    espacioInput.value = previousValue;
  }
}

function getCurrentSemester(date = new Date()) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${month <= 6 ? 1 : 2}-${year}`;
}

function formatDateTime(value) {
  if (!value) {
    return { date: '—', time: '' };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: String(value), time: '' };
  }

  const parts = new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Santiago',
  }).formatToParts(date);

  const getPart = (type) => parts.find((part) => part.type === type)?.value || '';

  return {
    date: `${getPart('day')}-${getPart('month')}-${getPart('year')}`,
    time: `${getPart('hour')}:${getPart('minute')}`,
  };
}

function renderDateTimeCell(value) {
  const formatted = formatDateTime(value);
  const timeMarkup = formatted.time
    ? `<span class="table-datetime__time">${escapeHtml(formatted.time)}</span>`
    : '';

  return `
    <div class="table-datetime">
      <span class="table-datetime__date">${escapeHtml(formatted.date)}</span>
      ${timeMarkup}
    </div>
  `;
}

function getStudentDetails(item) {
  return {
    career: item.carrera || 'Alumno CIAC',
    admission: item.anio_ingreso ? `Ingreso ${item.anio_ingreso}` : 'Ingreso no informado',
    notes: item.observaciones || 'Sin observaciones',
  };
}

function getCellValue(value) {
  return value || '—';
}

function getRunLabel(item) {
  return [item.run, item.dv].filter(Boolean).join('-') || '—';
}

function formatRut(run, dv) {
  const cleanRun = sanitizeRun(run);
  const cleanDv = sanitizeDv(dv);

  if (!cleanRun) {
    return '—';
  }

  const runConPuntos = cleanRun.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return cleanDv ? `${runConPuntos}-${cleanDv}` : runConPuntos;
}

function getVisibleRecords(records) {
  if (!activeCampusFilter) {
    return records;
  }
  return records.filter((item) => item.sede === activeCampusFilter);
}

function showRutSalidaMessage(text, type = '') {
  if (!rutSalidaMessage) return;
  rutSalidaMessage.textContent = text || '';
  rutSalidaMessage.className = `rut-salida-message${text ? ' is-visible' : ''}${type ? ` rut-salida-message--${type}` : ''}`;
}

function clearRutSalidaResult() {
  if (rutSalidaResult) {
    rutSalidaResult.innerHTML = '';
    rutSalidaResult.className = 'rut-salida-result';
  }
}

function renderResultadoBusquedaSalida(registro) {
  if (!rutSalidaResult) return;

  if (!registro) {
    clearRutSalidaResult();
    return;
  }

  const runNormalizado = formatRut(registro.run, registro.dv);
  const entrada = formatDateTime(registro.hora_entrada);

  rutSalidaResult.innerHTML = `
    <article class="rut-salida-result__card">
      <div class="rut-salida-result__meta">
        <strong>${escapeHtml(registro.carrera || 'Alumno CIAC')}</strong>
        <span><strong>RUN:</strong> ${escapeHtml(runNormalizado)}</span>
        <span><strong>Entrada:</strong> ${escapeHtml(entrada.time ? `${entrada.date} ${entrada.time}` : entrada.date)}</span>
        <span><strong>Estado:</strong> Entrada activa</span>
      </div>
      <div class="rut-salida-result__actions">
        <button type="button" class="table-action" data-action="salida-rut" data-id="${escapeHtml(registro.id)}">Registrar salida</button>
      </div>
    </article>
  `;
  rutSalidaResult.className = 'rut-salida-result is-visible';
}

async function buscarRegistroActivoPorRut(run) {
  const response = await fetch('/api/buscar-activo-rut', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(buildApiError(data, 'No se pudo buscar el ingreso activo.'));
  }

  return data;
}

function renderRecords(records) {
  if (!recordsBody || !recordsCount) return;
  todayRecordsCache = Array.isArray(records) ? records : [];
  const visibleRecords = getVisibleRecords(Array.isArray(records) ? records : []);

  if (visibleRecords.length === 0) {
    recordsBody.innerHTML = '<tr><td colspan="11" class="empty">No hay registros para el campus seleccionado hoy.</td></tr>';
    recordsCount.textContent = '0 registros';
    return;
  }

  recordsBody.innerHTML = visibleRecords.map((item) => {
    const isOpen = !item.hora_salida;
    const estadoClass = isOpen ? 'estado--activo' : 'estado--cerrado';
    const estadoText = isOpen ? 'Entrada activa' : 'Salida registrada';
    const semestre = getCurrentSemester(item.dia ? new Date(`${item.dia}T12:00:00`) : new Date());
    const student = getStudentDetails(item);
    const actionButton = isOpen
      ? `<button type="button" class="table-action" data-action="salida" data-id="${escapeHtml(item.id)}">Salida</button>`
      : '<span class="table-action table-action--muted">Completado</span>';

    return `
      <tr>
        <td class="cell-run col-run" data-label="RUN">${escapeHtml(getRunLabel(item))}</td>
        <td class="col-student" data-label="Estudiante">
          <div class="student-cell">
            <strong>${escapeHtml(student.career)}</strong>
            <span class="student-cell__meta">${escapeHtml(student.admission)}</span>
            <span class="student-cell__notes">${escapeHtml(student.notes)}</span>
          </div>
        </td>
        <td class="col-campus" data-label="Campus">${escapeHtml(getCellValue(item.sede))}</td>
        <td class="col-activity" data-label="Actividad">${escapeHtml(getCellValue(item.actividad))}</td>
        <td class="col-topic" data-label="Temática">${escapeHtml(getCellValue(item.tematica))}</td>
        <td class="col-space" data-label="Espacio">${escapeHtml(getCellValue(item.espacio))}</td>
        <td class="col-semester" data-label="Semestre">${escapeHtml(semestre)}</td>
        <td class="col-entry" data-label="Entrada">${renderDateTimeCell(item.hora_entrada)}</td>
        <td class="col-exit" data-label="Salida">${renderDateTimeCell(item.hora_salida)}</td>
        <td class="col-status" data-label="Estado"><span class="estado ${estadoClass}">${escapeHtml(estadoText)}</span></td>
        <td class="col-action" data-label="Acción">${actionButton}</td>
      </tr>
    `;
  }).join('');

  recordsCount.textContent = `${visibleRecords.length} registro${visibleRecords.length === 1 ? '' : 's'}`;
}

async function loadTodayRecords() {
  const response = await fetch('/api/registros-hoy');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(buildApiError(data, 'No se pudieron cargar los registros del día.'));
  }

  renderRecords(data.registros || []);
}

async function lookupStudent(runValue) {
  if (!autocompleteStatus || !dvInput || !carreraInput || !anioInput) return;
  const run = sanitizeRun(runValue);

  if (run.length < 3) {
    autocompleteStatus.textContent = 'Ingresa al menos 3 dígitos para consultar datos del estudiante.';
    dvInput.value = '';
    carreraInput.value = '';
    anioInput.value = '';
    return;
  }

  autocompleteStatus.textContent = 'Buscando estudiante...';

  try {
    const response = await fetch(`/api/buscar?run=${encodeURIComponent(run)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(buildApiError(data, 'No se pudo consultar el estudiante.'));
    }

    if (!data.alumno) {
      dvInput.value = '';
      carreraInput.value = '';
      anioInput.value = '';
      autocompleteStatus.textContent = 'No se encontró información para este RUN.';
      return;
    }

    dvInput.value = data.alumno.dv || '';
    carreraInput.value = data.alumno.carrera || '';
    anioInput.value = data.alumno.anio_ingreso || '';

    if (data.alumno.sede && !getSelectedCampus()) {
      syncCampus(data.alumno.sede);
      updateEspacios();
    }

    autocompleteStatus.textContent = 'Datos del estudiante completados correctamente.';
  } catch {
    autocompleteStatus.textContent = 'No fue posible consultar los datos del estudiante.';
  }
}

async function downloadExport() {
  if (!exportButton) return;
  clearMessage();
  exportButton.disabled = true;
  exportButton.textContent = 'Exportando CSV...';

  try {
    const response = await fetch('/api/exportar-registros');

    if (!response.ok) {
      const data = await response.json();
      throw new Error(buildApiError(data, 'No se pudo exportar el archivo CSV.'));
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)"?/i);
    const filename = match ? decodeURIComponent(match[1]) : 'ciac-registros.csv';
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    showMessage('El archivo CSV fue exportado correctamente.', 'success');
  } catch (error) {
    showMessage(error.message || 'No se pudo exportar el archivo CSV.', 'error');
  } finally {
    exportButton.disabled = false;
    exportButton.textContent = 'Exportar registros CSV';
  }
}

function validateExportKey() {
  const exportKey = window.prompt('Ingresa la clave para exportar:');

  if (exportKey !== 'Ciac.2011') {
    window.alert('Clave incorrecta');
    return false;
  }

  return true;
}

function openUsageReport() {
  clearMessage();
  const claveInforme = window.prompt('Ingresa la clave para abrir Informe:');

  if (claveInforme !== 'Ciac.2011') {
    window.alert('Clave incorrecta');
    return;
  }

  const selectedCampus = getSelectedCampus();
  const reportUrl = new URL('/report.html', window.location.origin);

  if (selectedCampus) {
    reportUrl.searchParams.set('campus', selectedCampus);
  }

  window.open(reportUrl.toString(), '_blank', 'noopener');
}

async function registerExit(id) {
  clearMessage();

  try {
    const response = await fetch('/api/registrar-salida', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(buildApiError(data, 'No se pudo registrar la salida.'));
    }

    renderRecords(data.registrosHoy || []);
    showMessage(data.message || 'Salida registrada correctamente.', 'success');
    return true;
  } catch (error) {
    showMessage(error.message || 'No se pudo registrar la salida.', 'error');
    return false;
  }
}

async function registrarSalidaDesdeBuscador(idRegistro, button) {
  if (!button) return;
  button.disabled = true;
  button.textContent = 'Registrando...';
  const ok = await registerExit(idRegistro);
  button.disabled = false;
  button.textContent = 'Registrar salida';

  if (ok) {
    if (rutSalidaInput) {
      rutSalidaInput.value = '';
      rutSalidaInput.focus();
    }
    clearRutSalidaResult();
    showRutSalidaMessage('Salida registrada correctamente.', 'success');
  } else {
    showRutSalidaMessage('No se pudo registrar la salida. Intenta nuevamente.', 'error');
  }
}

function updateClock() {
  if (!currentDate || !currentTime || !currentSemesterBadge) return;
  const now = new Date();
  currentDate.textContent = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Santiago',
  }).format(now);
  currentTime.textContent = new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Santiago',
  }).format(now);
  currentSemesterBadge.textContent = `Semestre ${getCurrentSemester(now)}`;
}

campusHeaderInput?.addEventListener('change', () => {
  syncCampus(campusHeaderInput.value);
  updateEspacios();
  clearMessage();
  showRutSalidaMessage('');
  clearRutSalidaResult();
  loadTodayRecords().catch((error) => {
    showMessage(error.message || 'No se pudieron cargar los registros del día.', 'error');
  });
});

runInput?.addEventListener('input', () => {
  runInput.value = sanitizeRun(runInput.value);
  clearMessage();
  window.clearTimeout(lookupTimer);
  lookupTimer = window.setTimeout(() => lookupStudent(runInput.value), 300);
});

dvInput?.addEventListener('input', () => {
  dvInput.value = sanitizeDv(dvInput.value);
  clearMessage();
});

anioInput?.addEventListener('input', () => {
  anioInput.value = String(anioInput.value || '').replace(/\D/g, '').slice(0, 4);
});

exportButton?.addEventListener('click', () => {
  if (!validateExportKey()) {
    return;
  }

  downloadExport();
});
exportReportButton?.addEventListener('click', openUsageReport);

recordsBody?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="salida"]');

  if (!button) {
    return;
  }

  button.disabled = true;
  button.textContent = 'Guardando...';
  registerExit(button.dataset.id).finally(() => {
    button.disabled = false;
    button.textContent = 'Salida';
  });
});

rutSalidaInput?.addEventListener('input', () => {
  showRutSalidaMessage('');
  clearRutSalidaResult();
});

rutSalidaInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  rutSalidaSearchButton?.click();
});

rutSalidaSearchButton?.addEventListener('click', async () => {
  if (rutSalidaLoading) {
    return;
  }

  clearMessage();
  showRutSalidaMessage('');
  clearRutSalidaResult();
  const rawRut = rutSalidaInput?.value || '';

  if (!rawRut.trim()) {
    showRutSalidaMessage('Ingresa un RUT para buscar.', 'error');
    return;
  }

  const parsedRut = normalizarRutBusqueda(rawRut);
  const runBusqueda = sanitizeRun(parsedRut.run);

  if (!/^\d{7,8}$/.test(runBusqueda)) {
    showRutSalidaMessage('Ingresa un RUT válido para buscar.', 'error');
    return;
  }

  rutSalidaLoading = true;
  if (rutSalidaSearchButton) {
    rutSalidaSearchButton.disabled = true;
    rutSalidaSearchButton.textContent = 'Buscando...';
  }

  try {
    const data = await buscarRegistroActivoPorRut(runBusqueda);

    if (!data?.found) {
      showRutSalidaMessage('No hay un ingreso activo para este RUT hoy.');
      return;
    }

    renderResultadoBusquedaSalida(data.record);
  } catch (error) {
    showRutSalidaMessage(error.message || 'No se pudo buscar el ingreso activo.', 'error');
  } finally {
    rutSalidaLoading = false;
    if (rutSalidaSearchButton) {
      rutSalidaSearchButton.disabled = false;
      rutSalidaSearchButton.textContent = 'Buscar';
    }
  }
});

rutSalidaResult?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="salida-rut"]');

  if (!button) {
    return;
  }

  registrarSalidaDesdeBuscador(button.dataset.id, button);
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  const payload = {
    campus: getSelectedCampus(),
    run: sanitizeRun(runInput.value),
    dv: sanitizeDv(dvInput.value),
    carrera: carreraInput.value.trim(),
    anio_ingreso: anioInput.value.trim(),
    actividad: actividadInput.value,
    tematica: tematicaInput.value,
    observaciones: observacionesInput.value.trim(),
    espacio: espacioInput.value,
  };

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Registrando...';
  }

  try {
    const response = await fetch('/api/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(buildApiError(data, 'No se pudo registrar la asistencia.'));
    }

    showMessage(data.message || 'Entrada registrada correctamente.', 'success');
    renderRecords(data.registrosHoy || []);

    const selectedCampus = getSelectedCampus();
    const selectedActividad = actividadInput.value;

    form.reset();
    syncCampus(selectedCampus);
    actividadInput.value = selectedActividad;
    updateEspacios();
    if (autocompleteStatus) {
      autocompleteStatus.textContent = 'Ingresa al menos 3 dígitos para consultar datos del estudiante.';
    }
    runInput?.focus();
  } catch (error) {
    showMessage(error.message || 'No se pudo registrar la asistencia.', 'error');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Registrar entrada';
    }
  }
});

if (campusHeaderInput) {
  syncCampus(getSelectedCampus());
}
updateEspacios();
updateClock();
loadTodayRecords().catch((error) => {
  showMessage(error.message || 'No se pudieron cargar los registros del día.', 'error');
});
window.setInterval(updateClock, 1000);

const historicalYear = document.getElementById('historical-year');
const historicalMonth = document.getElementById('historical-month');
const historicalCampus = document.getElementById('historical-campus');
const historicalActivity = document.getElementById('historical-activity');
const historicalTopic = document.getElementById('historical-topic');
const historicalViewButton = document.getElementById('historical-view');
const historicalHead = document.getElementById('historical-head');
const historicalBody = document.getElementById('historical-body');
const historicalCards = document.getElementById('historical-cards');
const historicalExportCsv = document.getElementById('historical-export-csv');
const historicalExportPdf = document.getElementById('historical-export-pdf');

function getHistoricalQuery() {
  const q = new URLSearchParams({
    year: historicalYear?.value || String(new Date().getFullYear()),
    month: historicalMonth?.value || 'all',
  });
  if (historicalCampus?.value) q.set('campus', historicalCampus.value);
  if (historicalActivity?.value) q.set('actividad', historicalActivity.value);
  if (historicalTopic?.value) q.set('tematica', historicalTopic.value);
  return q.toString();
}

function renderHistoricalCards(analytics) {
  if (!historicalCards) return;
  historicalCards.innerHTML = `
    <article class="report-kpi"><span class="report-kpi__label">Total atenciones</span><strong class="report-kpi__value">${analytics.executive.total}</strong></article>
    <article class="report-kpi"><span class="report-kpi__label">Estudiantes únicos</span><strong class="report-kpi__value">${analytics.executive.uniqueStudents}</strong></article>
    <article class="report-kpi"><span class="report-kpi__label">Actividad top</span><strong class="report-kpi__value">${escapeHtml(analytics.activity.top?.label || 'Sin datos')}</strong></article>
    <article class="report-kpi"><span class="report-kpi__label">Temática top</span><strong class="report-kpi__value">${escapeHtml(analytics.topic.top?.label || 'Sin datos')}</strong></article>
  `;
}

function renderHistoricalMonth(records) {
  if (!historicalHead || !historicalBody) return;
  historicalHead.innerHTML = '<tr><th>Fecha</th><th>RUN</th><th>Campus</th><th>Actividad</th><th>Temática</th><th>Espacio</th><th>Entrada</th><th>Salida</th></tr>';
  if (!records.length) {
    historicalBody.innerHTML = '<tr><td colspan="8" class="empty">Sin registros para este período.</td></tr>';
    return;
  }

  historicalBody.innerHTML = records.map((row) => `
    <tr>
      <td>${escapeHtml(row.dia || '—')}</td>
      <td>${escapeHtml(getRunLabel(row))}</td>
      <td>${escapeHtml(getCellValue(row.sede))}</td>
      <td>${escapeHtml(getCellValue(row.actividad))}</td>
      <td>${escapeHtml(getCellValue(row.tematica))}</td>
      <td>${escapeHtml(getCellValue(row.espacio))}</td>
      <td>${escapeHtml(formatDateTime(row.hora_entrada).date)} ${escapeHtml(formatDateTime(row.hora_entrada).time)}</td>
      <td>${escapeHtml(formatDateTime(row.hora_salida).date)} ${escapeHtml(formatDateTime(row.hora_salida).time)}</td>
    </tr>`).join('');
}

function renderHistoricalYear(monthly) {
  if (!historicalHead || !historicalBody) return;
  historicalHead.innerHTML = '<tr><th>Mes</th><th>Total atenciones</th><th>Estudiantes únicos</th><th>Actividad top</th><th>Temática top</th></tr>';
  historicalBody.innerHTML = monthly.map((row) => `
    <tr>
      <td>${escapeHtml(row.monthLabel)}</td>
      <td>${row.total}</td>
      <td>${row.uniqueStudents}</td>
      <td>${escapeHtml(row.topActivity)}</td>
      <td>${escapeHtml(row.topTopic)}</td>
    </tr>`).join('');
}

async function loadHistoricalRecords() {
  const response = await fetch(`/api/historical-records?${getHistoricalQuery()}`);
  const data = await response.json();
  if (!response.ok) throw new Error(buildApiError(data, 'No se pudo cargar histórico.'));
  renderHistoricalCards(data.analytics);
  if (data.mode === 'year') {
    renderHistoricalYear(data.monthly || []);
  } else {
    renderHistoricalMonth(data.records || []);
  }
}

function downloadByUrl(url, fallback) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fallback;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

historicalViewButton?.addEventListener('click', () => {
  loadHistoricalRecords().catch((error) => showMessage(error.message, 'error'));
});

historicalExportCsv?.addEventListener('click', () => {
  if (!validateExportKey()) {
    return;
  }

  downloadByUrl(`/api/export-historical?${getHistoricalQuery()}&format=csv`, 'historico.csv');
});

historicalExportPdf?.addEventListener('click', () => {
  downloadByUrl(`/api/export-report?${getHistoricalQuery()}`, 'historico.pdf');
});

(function initHistorical() {
  if (!historicalYear) return;
  const nowYear = new Date().getFullYear();
  historicalYear.innerHTML = [nowYear - 2, nowYear - 1, nowYear, nowYear + 1]
    .map((year) => `<option value="${year}">${year}</option>`).join('');
  historicalYear.value = String(nowYear);
})();
