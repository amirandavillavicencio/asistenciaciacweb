const CAMPUS_SPACES = {
  Vitacura: ['Espacio común'],
  'San Joaquín': ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6', 'Espacio común'],
};

const MIN_LOOKUP_LENGTH = 3;
const LOOKUP_DEBOUNCE_MS = 400;
const AUTH_STORAGE_KEY = 'ciac_auth';
const ACCESS_PASSWORD = 'Suna.2011';
const MIN_RUN_LENGTH = 7;
const MAX_RUN_LENGTH = 8;
const MIN_YEAR = 1990;
const ROWS_PER_PAGE = 15;

const authGate = document.getElementById('auth-gate');
const authForm = document.getElementById('auth-form');
const authPasswordInput = document.getElementById('auth-password');
const authSubmitButton = document.getElementById('auth-submit');
const authError = document.getElementById('auth-error');
const appShell = document.getElementById('app-shell');
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
const runStatusText = document.getElementById('run-status-text');
const suggestionsList = document.getElementById('run-suggestions');
const runClearButton = document.getElementById('run-clear');
const submitButton = document.getElementById('submit-button');
const recordsBody = document.getElementById('records-body');
const recordsCount = document.getElementById('records-count');
const currentDate = document.getElementById('current-date');
const currentTime = document.getElementById('current-time');
const currentSemesterBadge = document.getElementById('current-semester');
const searchInput = document.getElementById('records-search');
const paginationPrevButton = document.getElementById('pagination-prev');
const paginationNextButton = document.getElementById('pagination-next');
const paginationStatus = document.getElementById('pagination-status');
const formLiveRegion = document.getElementById('form-live-region');

const fieldDefinitions = {
  campus: { input: campusHeaderInput, errorNode: null },
  run: { input: runInput, errorNode: document.getElementById('run-error') },
  dv: { input: dvInput, errorNode: document.getElementById('dv-error') },
  carrera: { input: carreraInput, errorNode: document.getElementById('carrera-error') },
  anio_ingreso: { input: anioInput, errorNode: document.getElementById('anio_ingreso-error') },
  actividad: { input: actividadInput, errorNode: document.getElementById('actividad-error') },
  tematica: { input: tematicaInput, errorNode: document.getElementById('tematica-error') },
  espacio: { input: espacioInput, errorNode: document.getElementById('espacio-error') },
};

let lookupTimer = null;
let activeCampusFilter = '';
let currentSuggestions = [];
let highlightedSuggestionIndex = -1;
let latestLookupToken = 0;
let currentRecords = [];
let searchTerm = '';
let currentPage = 1;

function isAuthenticated() {
  return window.sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
}

function setAuthenticated(isAuth) {
  if (isAuth) {
    window.sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
    return;
  }

  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

function applyAuthState(isAuth) {
  authGate.hidden = isAuth;
  appShell.setAttribute('aria-hidden', String(!isAuth));
  document.body.classList.toggle('auth-locked', !isAuth);

  if (isAuth) {
    authError.textContent = '';
    authPasswordInput.classList.remove('is-shaking');
    runInput.focus();
    return;
  }

  window.setTimeout(() => {
    authPasswordInput.focus();
  }, 0);
}

function failAuthentication() {
  authError.textContent = 'Contraseña incorrecta';
  authPasswordInput.value = '';
  authPasswordInput.classList.remove('is-shaking');
  void authPasswordInput.offsetWidth;
  authPasswordInput.classList.add('is-shaking');
  authPasswordInput.focus();
}

function handleAuthSubmit(event) {
  event.preventDefault();
  authSubmitButton.disabled = true;

  if (authPasswordInput.value === ACCESS_PASSWORD) {
    setAuthenticated(true);
    applyAuthState(true);
    authSubmitButton.disabled = false;
    return;
  }

  setAuthenticated(false);
  failAuthentication();
  authSubmitButton.disabled = false;
}

function sanitizeRun(value) {
  return String(value || '').replace(/\D/g, '').slice(0, MAX_RUN_LENGTH);
}

function sanitizeDv(value) {
  return String(value || '').trim().toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);
}

function formatRun(value) {
  const digits = sanitizeRun(value);
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
}

function calculateDv(runValue) {
  const run = sanitizeRun(runValue);

  if (!run) {
    return '';
  }

  let sum = 0;
  let multiplier = 2;

  for (let index = run.length - 1; index >= 0; index -= 1) {
    sum += Number(run[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);

  if (remainder === 11) {
    return '0';
  }

  if (remainder === 10) {
    return 'K';
  }

  return String(remainder);
}

function isValidRun(runValue, dvValue) {
  const run = sanitizeRun(runValue);
  const dv = sanitizeDv(dvValue);

  if (!run || run.length < MIN_RUN_LENGTH || run.length > MAX_RUN_LENGTH || !dv) {
    return false;
  }

  return calculateDv(run) === dv;
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
  messageBox.textContent = text;
  messageBox.className = `message is-visible message--${type}`;
  messageBox.setAttribute('role', type === 'error' ? 'alert' : 'status');
}

function clearMessage() {
  messageBox.textContent = '';
  messageBox.className = 'message';
  messageBox.setAttribute('role', 'status');
}

function buildApiError(data, fallback) {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  return data.error || fallback;
}

function getSelectedCampus() {
  return campusHeaderInput.value;
}

function syncCampus(value) {
  campusHeaderInput.value = value;
  activeCampusFilter = value;
}

function getCurrentYear() {
  return new Date().getUTCFullYear();
}

function updateEspacios() {
  const selectedCampus = getSelectedCampus();
  const spaces = CAMPUS_SPACES[selectedCampus] || [];
  const previousValue = espacioInput.value;

  clearFieldError('espacio');

  if (!spaces.length) {
    espacioInput.innerHTML = '<option value="">Selecciona primero el campus superior</option>';
    espacioInput.disabled = true;
    espacioInput.setAttribute('aria-disabled', 'true');
    return;
  }

  espacioInput.innerHTML = ['<option value="">Selecciona espacio</option>']
    .concat(spaces.map((space) => `<option value="${escapeHtml(space)}">${escapeHtml(space)}</option>`))
    .join('');
  espacioInput.disabled = false;
  espacioInput.setAttribute('aria-disabled', 'false');

  if (spaces.includes(previousValue)) {
    espacioInput.value = previousValue;
  }
}

function getCurrentSemester(date = new Date()) {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
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
  return [formatRun(item.run), item.dv].filter(Boolean).join('-') || '—';
}

function getVisibleRecords(records) {
  const campusFiltered = activeCampusFilter
    ? records.filter((item) => item.sede === activeCampusFilter)
    : records;

  if (!searchTerm) {
    return campusFiltered;
  }

  const normalizedQuery = searchTerm.toLocaleLowerCase('es-CL');

  return campusFiltered.filter((item) => {
    const runLabel = [sanitizeRun(item.run), item.dv || ''].join('-').toLocaleLowerCase('es-CL');
    const formattedRun = getRunLabel(item).toLocaleLowerCase('es-CL');
    const career = String(item.carrera || '').toLocaleLowerCase('es-CL');
    return runLabel.includes(normalizedQuery) || formattedRun.includes(normalizedQuery) || career.includes(normalizedQuery);
  });
}

function updatePagination(totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / ROWS_PER_PAGE));

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  paginationStatus.textContent = `Página ${currentPage} de ${totalPages}`;
  paginationPrevButton.disabled = currentPage <= 1;
  paginationNextButton.disabled = currentPage >= totalPages;
}

function renderRecords(records) {
  currentRecords = Array.isArray(records) ? records : [];
  const visibleRecords = getVisibleRecords(currentRecords);
  updatePagination(visibleRecords.length);

  const totalPages = Math.max(1, Math.ceil(visibleRecords.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * ROWS_PER_PAGE;
  const paginatedRecords = visibleRecords.slice(pageStart, pageStart + ROWS_PER_PAGE);

  if (visibleRecords.length === 0) {
    recordsBody.innerHTML = `<tr><td colspan="11" class="empty">${searchTerm ? 'No hay resultados para la búsqueda aplicada.' : 'No hay registros para el campus seleccionado hoy.'}</td></tr>`;
    recordsCount.textContent = '0 registros';
    return;
  }

  recordsBody.innerHTML = paginatedRecords.map((item) => {
    const isOpen = !item.hora_salida;
    const estadoClass = isOpen ? 'estado--activo' : 'estado--cerrado';
    const estadoText = isOpen ? 'Entrada activa' : 'Salida registrada';
    const semestre = getCurrentSemester(item.dia ? new Date(`${item.dia}T12:00:00Z`) : new Date());
    const student = getStudentDetails(item);
    const actionButton = isOpen
      ? `<button type="button" class="table-action" data-action="salida" data-id="${escapeHtml(item.id)}">Salida</button>`
      : '<span class="table-action table-action--muted">Completado</span>';

    return `
      <tr>
        <td class="cell-run">${escapeHtml(getRunLabel(item))}</td>
        <td>
          <div class="student-cell">
            <strong>${escapeHtml(student.career)}</strong>
            <span class="student-cell__meta">${escapeHtml(student.admission)}</span>
            <span class="student-cell__notes">${escapeHtml(student.notes)}</span>
          </div>
        </td>
        <td>${escapeHtml(getCellValue(item.sede))}</td>
        <td>${escapeHtml(getCellValue(item.actividad))}</td>
        <td>${escapeHtml(getCellValue(item.tematica))}</td>
        <td>${escapeHtml(getCellValue(item.espacio))}</td>
        <td>${escapeHtml(semestre)}</td>
        <td>${renderDateTimeCell(item.hora_entrada)}</td>
        <td>${renderDateTimeCell(item.hora_salida)}</td>
        <td><span class="estado ${estadoClass}">${escapeHtml(estadoText)}</span></td>
        <td>${actionButton}</td>
      </tr>
    `;
  }).join('');

  recordsCount.textContent = `${visibleRecords.length} registro${visibleRecords.length === 1 ? '' : 's'}`;
}

function setLookupLoading(isLoading) {
  autocompleteStatus.classList.toggle('hint--loading', isLoading);
}

function clearStudentFields(options = {}) {
  const { preserveStatus = false, preserveRun = false } = options;

  if (!preserveRun) {
    runInput.value = '';
  }

  dvInput.value = '';
  carreraInput.value = '';
  anioInput.value = '';
  runStatusText.textContent = '';
  runStatusText.className = 'field-status';

  if (!preserveStatus) {
    autocompleteStatus.textContent = 'Ingresa al menos 3 dígitos para consultar datos del estudiante.';
    autocompleteStatus.className = 'hint';
  }

  clearFieldError('run');
  clearFieldError('dv');
  clearFieldError('carrera');
  clearFieldError('anio_ingreso');
}

function syncRunFieldState() {
  runClearButton.hidden = !runInput.value;
}

function closeSuggestions() {
  currentSuggestions = [];
  highlightedSuggestionIndex = -1;
  suggestionsList.hidden = true;
  suggestionsList.innerHTML = '';
  runInput.setAttribute('aria-expanded', 'false');
  runInput.removeAttribute('aria-activedescendant');
}

function renderSuggestions(items) {
  currentSuggestions = Array.isArray(items) ? items : [];
  highlightedSuggestionIndex = currentSuggestions.length ? 0 : -1;

  if (!currentSuggestions.length) {
    closeSuggestions();
    return;
  }

  suggestionsList.innerHTML = currentSuggestions.map((item, index) => {
    const formatted = [formatRun(item.run), item.dv].filter(Boolean).join('-');
    return `
      <li
        id="run-suggestion-${index}"
        class="autocomplete__option${index === highlightedSuggestionIndex ? ' is-active' : ''}"
        role="option"
        aria-selected="${index === highlightedSuggestionIndex ? 'true' : 'false'}"
        data-index="${index}"
      >
        <span class="autocomplete__option-run">${escapeHtml(formatted || 'RUN sin formato')}</span>
        <span class="autocomplete__option-name">${escapeHtml(item.nombre || item.carrera || 'Estudiante')}</span>
      </li>
    `;
  }).join('');

  suggestionsList.hidden = false;
  runInput.setAttribute('aria-expanded', 'true');
  runInput.setAttribute('aria-activedescendant', `run-suggestion-${highlightedSuggestionIndex}`);
}

function updateHighlightedSuggestion(index) {
  if (!currentSuggestions.length) {
    highlightedSuggestionIndex = -1;
    runInput.removeAttribute('aria-activedescendant');
    return;
  }

  highlightedSuggestionIndex = (index + currentSuggestions.length) % currentSuggestions.length;

  Array.from(suggestionsList.children).forEach((option, optionIndex) => {
    const isActive = optionIndex === highlightedSuggestionIndex;
    option.classList.toggle('is-active', isActive);
    option.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  const activeOption = suggestionsList.children[highlightedSuggestionIndex];

  if (activeOption) {
    runInput.setAttribute('aria-activedescendant', activeOption.id);
    activeOption.scrollIntoView({ block: 'nearest' });
  }
}

function setFieldError(fieldName, message) {
  const field = fieldDefinitions[fieldName];

  if (!field || !field.input) {
    return;
  }

  field.input.classList.add('field-invalid');
  field.input.setAttribute('aria-invalid', 'true');

  if (field.errorNode) {
    field.errorNode.textContent = message;
    field.errorNode.hidden = false;
  }
}

function clearFieldError(fieldName) {
  const field = fieldDefinitions[fieldName];

  if (!field || !field.input) {
    return;
  }

  field.input.classList.remove('field-invalid');
  field.input.setAttribute('aria-invalid', 'false');

  if (field.errorNode) {
    field.errorNode.textContent = '';
    field.errorNode.hidden = true;
  }
}

function clearAllFieldErrors() {
  Object.keys(fieldDefinitions).forEach(clearFieldError);
}

function updateRunValidationFeedback() {
  const run = sanitizeRun(runInput.value);
  const dv = sanitizeDv(dvInput.value);

  if (!run && !dv) {
    runStatusText.textContent = '';
    runStatusText.className = 'field-status';
    clearFieldError('run');
    clearFieldError('dv');
    return;
  }

  if (run.length < MIN_RUN_LENGTH || run.length > MAX_RUN_LENGTH) {
    runStatusText.textContent = 'El RUN debe tener entre 7 y 8 dígitos.';
    runStatusText.className = 'field-status field-status--error';
    if (run) {
      setFieldError('run', 'Ingresa un RUN válido de 7 u 8 dígitos.');
    }
    return;
  }

  if (!dv) {
    runStatusText.textContent = 'Ingresa el dígito verificador para validar el RUN.';
    runStatusText.className = 'field-status';
    clearFieldError('run');
    clearFieldError('dv');
    return;
  }

  if (!isValidRun(run, dv)) {
    const expectedDv = calculateDv(run);
    runStatusText.textContent = 'RUN inválido. Verifica el dígito verificador.';
    runStatusText.className = 'field-status field-status--error';
    setFieldError('run', `El RUN ingresado no coincide con el dígito verificador esperado (${expectedDv}).`);
    setFieldError('dv', 'El dígito verificador no corresponde al RUN ingresado.');
    return;
  }

  runStatusText.textContent = 'RUN válido.';
  runStatusText.className = 'field-status field-status--success';
  clearFieldError('run');
  clearFieldError('dv');
}

function fillStudentFields(student, statusMessage = 'Datos del estudiante completados correctamente.') {
  if (!student) {
    return;
  }

  runInput.value = formatRun(student.run || runInput.value);
  dvInput.value = sanitizeDv(student.dv || (sanitizeRun(student.run).length >= MIN_RUN_LENGTH ? calculateDv(student.run) : ''));
  carreraInput.value = student.carrera || '';
  anioInput.value = student.anio_ingreso || '';

  if (student.sede && !getSelectedCampus()) {
    syncCampus(student.sede);
    updateEspacios();
  }

  autocompleteStatus.textContent = statusMessage;
  autocompleteStatus.className = 'hint hint--success';
  updateRunValidationFeedback();
  clearFieldError('carrera');
  clearFieldError('anio_ingreso');
  syncRunFieldState();
}

function applySuggestion(index) {
  const student = currentSuggestions[index];

  if (!student) {
    return;
  }

  fillStudentFields(student, 'Estudiante seleccionado desde las sugerencias.');
  closeSuggestions();
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
  const run = sanitizeRun(runValue);
  const lookupToken = latestLookupToken + 1;
  latestLookupToken = lookupToken;

  if (run.length < MIN_LOOKUP_LENGTH) {
    setLookupLoading(false);
    closeSuggestions();
    clearStudentFields({ preserveRun: true, preserveStatus: false });
    updateRunValidationFeedback();
    syncRunFieldState();
    return;
  }

  if (run.length >= MIN_RUN_LENGTH) {
    dvInput.value = calculateDv(run);
    updateRunValidationFeedback();
  } else {
    dvInput.value = '';
  }

  setLookupLoading(true);
  autocompleteStatus.textContent = 'Buscando estudiante...';
  autocompleteStatus.className = 'hint hint--loading';

  try {
    const response = await fetch(`/api/buscar?run=${encodeURIComponent(run)}`);
    const data = await response.json();

    if (lookupToken !== latestLookupToken) {
      return;
    }

    if (!response.ok) {
      throw new Error(buildApiError(data, 'No se pudo consultar al estudiante.'));
    }

    const matches = Array.isArray(data.coincidencias) ? data.coincidencias : [];

    if (!data.alumno && !matches.length) {
      carreraInput.value = '';
      anioInput.value = '';
      closeSuggestions();
      autocompleteStatus.textContent = 'No se encontraron datos del estudiante.';
      autocompleteStatus.className = 'hint hint--error';
      return;
    }

    if (data.alumno) {
      fillStudentFields(data.alumno);
    } else {
      carreraInput.value = '';
      anioInput.value = '';
      autocompleteStatus.textContent = 'Selecciona un estudiante de la lista.';
      autocompleteStatus.className = 'hint';
    }

    const suggestionItems = data.alumno
      ? matches.filter((item) => !(item.run === data.alumno.run && item.dv === data.alumno.dv))
      : matches;

    if (suggestionItems.length) {
      renderSuggestions(suggestionItems);
    } else {
      closeSuggestions();
    }
  } catch {
    if (lookupToken !== latestLookupToken) {
      return;
    }

    closeSuggestions();
    autocompleteStatus.textContent = 'No fue posible consultar los datos del estudiante.';
    autocompleteStatus.className = 'hint hint--error';
  } finally {
    if (lookupToken === latestLookupToken) {
      setLookupLoading(false);
      syncRunFieldState();
    }
  }
}

async function downloadExport() {
  clearMessage();
  exportButton.disabled = true;
  exportButton.textContent = 'Exportando CSV...';

  try {
    const response = await fetch('/api/exportar-registros');

    if (!response.ok) {
      const data = await response.json();
      throw new Error(buildApiError(data, 'No fue posible exportar el archivo CSV.'));
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
    showMessage(error.message || 'No fue posible exportar el archivo CSV.', 'error');
  } finally {
    exportButton.disabled = false;
    exportButton.textContent = 'Exportar registros CSV';
  }
}

function openUsageReport() {
  clearMessage();

  const selectedCampus = getSelectedCampus();
  const reportUrl = selectedCampus
    ? `/report.html?campus=${encodeURIComponent(selectedCampus)}`
    : '/report.html';

  window.open(reportUrl, '_blank', 'noopener');
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
      throw new Error(buildApiError(data, 'No fue posible registrar la salida.'));
    }

    renderRecords(data.registrosHoy || []);
    showMessage(data.message || 'Salida registrada correctamente.', 'success');
  } catch (error) {
    showMessage(error.message || 'No fue posible registrar la salida.', 'error');
  }
}

function updateClock() {
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

function validateYear() {
  const yearValue = String(anioInput.value || '').trim();
  const currentYear = getCurrentYear();

  if (!yearValue) {
    setFieldError('anio_ingreso', 'Debes ingresar el año de ingreso.');
    return false;
  }

  if (!/^\d{4}$/.test(yearValue)) {
    setFieldError('anio_ingreso', 'Ingresa un año con cuatro dígitos.');
    return false;
  }

  const year = Number(yearValue);

  if (year < MIN_YEAR || year > currentYear) {
    setFieldError('anio_ingreso', `Ingresa un año entre ${MIN_YEAR} y ${currentYear}.`);
    return false;
  }

  clearFieldError('anio_ingreso');
  return true;
}

function validateForm() {
  clearAllFieldErrors();
  const errors = [];

  if (!getSelectedCampus()) {
    errors.push({ field: 'campus', message: 'Debes seleccionar el campus superior.' });
  }

  const run = sanitizeRun(runInput.value);
  const dv = sanitizeDv(dvInput.value);

  if (!run) {
    errors.push({ field: 'run', message: 'Debes ingresar el RUN.' });
  } else if (run.length < MIN_RUN_LENGTH || run.length > MAX_RUN_LENGTH) {
    errors.push({ field: 'run', message: 'Ingresa un RUN válido de 7 u 8 dígitos.' });
  }

  if (!dv) {
    errors.push({ field: 'dv', message: 'Debes ingresar el dígito verificador.' });
  }

  if (run && dv && !isValidRun(run, dv)) {
    errors.push({ field: 'run', message: 'El RUN y el dígito verificador no son válidos.' });
    errors.push({ field: 'dv', message: 'El dígito verificador no corresponde al RUN ingresado.' });
  }

  if (!carreraInput.value.trim()) {
    errors.push({ field: 'carrera', message: 'Debes ingresar la carrera.' });
  }

  if (!validateYear()) {
    errors.push({ field: 'anio_ingreso', message: fieldDefinitions.anio_ingreso.errorNode.textContent || 'Debes ingresar un año válido.' });
  }

  if (!actividadInput.value) {
    errors.push({ field: 'actividad', message: 'Debes seleccionar una actividad.' });
  }

  if (!tematicaInput.value) {
    errors.push({ field: 'tematica', message: 'Debes seleccionar una temática.' });
  }

  if (!getSelectedCampus()) {
    espacioInput.disabled = true;
  }

  if (!espacioInput.value) {
    errors.push({ field: 'espacio', message: 'Debes seleccionar un espacio.' });
  }

  const handled = new Set();
  errors.forEach(({ field, message }) => {
    if (handled.has(field)) {
      return;
    }

    handled.add(field);
    setFieldError(field, message);
  });

  if (errors.length) {
    const firstField = errors.find(({ field }) => fieldDefinitions[field]?.input)?.field;
    if (firstField && fieldDefinitions[firstField]) {
      fieldDefinitions[firstField].input.focus();
    }

    const summaryMessage = errors[0].field === 'campus'
      ? 'Revisa el formulario antes de registrar la entrada. Debes seleccionar el campus y completar los campos obligatorios.'
      : 'Revisa el formulario antes de registrar la entrada. Hay campos obligatorios pendientes o inválidos.';

    formLiveRegion.textContent = summaryMessage;
    showMessage(summaryMessage, 'error');
    return false;
  }

  formLiveRegion.textContent = '';
  return true;
}

campusHeaderInput.addEventListener('change', () => {
  syncCampus(campusHeaderInput.value);
  updateEspacios();
  clearMessage();
  renderRecords(currentRecords);
  loadTodayRecords().catch((error) => {
    showMessage(error.message || 'No se pudieron cargar los registros del día.', 'error');
  });
});

runInput.addEventListener('input', () => {
  runInput.value = formatRun(runInput.value);
  clearMessage();
  syncRunFieldState();
  closeSuggestions();
  clearFieldError('run');
  clearFieldError('dv');
  window.clearTimeout(lookupTimer);
  updateRunValidationFeedback();
  lookupTimer = window.setTimeout(() => lookupStudent(runInput.value), LOOKUP_DEBOUNCE_MS);
});

runInput.addEventListener('keydown', (event) => {
  if (!currentSuggestions.length || suggestionsList.hidden) {
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    updateHighlightedSuggestion(highlightedSuggestionIndex + 1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    updateHighlightedSuggestion(highlightedSuggestionIndex - 1);
    return;
  }

  if (event.key === 'Enter' && highlightedSuggestionIndex >= 0) {
    event.preventDefault();
    applySuggestion(highlightedSuggestionIndex);
  }

  if (event.key === 'Escape') {
    closeSuggestions();
  }
});

runInput.addEventListener('blur', () => {
  window.setTimeout(() => {
    closeSuggestions();
  }, 120);
});

runClearButton.addEventListener('click', () => {
  window.clearTimeout(lookupTimer);
  latestLookupToken += 1;
  setLookupLoading(false);
  closeSuggestions();
  clearStudentFields();
  syncRunFieldState();
  clearMessage();
  runInput.focus();
});

suggestionsList.addEventListener('mousedown', (event) => {
  const option = event.target.closest('[data-index]');

  if (!option) {
    return;
  }

  event.preventDefault();
  applySuggestion(Number(option.dataset.index));
  runInput.focus();
});

authForm.addEventListener('submit', handleAuthSubmit);
authPasswordInput.addEventListener('input', () => {
  if (authError.textContent) {
    authError.textContent = '';
  }

  authPasswordInput.classList.remove('is-shaking');
});

dvInput.addEventListener('input', () => {
  dvInput.value = sanitizeDv(dvInput.value);
  clearMessage();
  updateRunValidationFeedback();
});

carreraInput.addEventListener('input', () => {
  clearFieldError('carrera');
  clearMessage();
});

anioInput.addEventListener('input', () => {
  anioInput.value = String(anioInput.value || '').replace(/\D/g, '').slice(0, 4);
  clearFieldError('anio_ingreso');
  clearMessage();
});

actividadInput.addEventListener('change', () => {
  clearFieldError('actividad');
  clearMessage();
});

tematicaInput.addEventListener('change', () => {
  clearFieldError('tematica');
  clearMessage();
});

espacioInput.addEventListener('change', () => {
  clearFieldError('espacio');
  clearMessage();
});

searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value.trim();
  currentPage = 1;
  renderRecords(currentRecords);
});

paginationPrevButton.addEventListener('click', () => {
  if (currentPage <= 1) {
    return;
  }

  currentPage -= 1;
  renderRecords(currentRecords);
});

paginationNextButton.addEventListener('click', () => {
  const visibleRecords = getVisibleRecords(currentRecords);
  const totalPages = Math.max(1, Math.ceil(visibleRecords.length / ROWS_PER_PAGE));

  if (currentPage >= totalPages) {
    return;
  }

  currentPage += 1;
  renderRecords(currentRecords);
});

exportButton.addEventListener('click', downloadExport);
exportReportButton.addEventListener('click', openUsageReport);

recordsBody.addEventListener('click', (event) => {
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();
  updateRunValidationFeedback();

  if (!validateForm()) {
    return;
  }

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

  submitButton.disabled = true;
  submitButton.textContent = 'Registrando...';

  try {
    const response = await fetch('/api/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(buildApiError(data, 'No fue posible registrar la entrada.'));
    }

    showMessage(data.message || 'Entrada registrada correctamente.', 'success');
    renderRecords(data.registrosHoy || []);

    const selectedCampus = getSelectedCampus();
    const selectedActividad = actividadInput.value;

    form.reset();
    clearAllFieldErrors();
    syncCampus(selectedCampus);
    actividadInput.value = selectedActividad;
    updateEspacios();
    closeSuggestions();
    clearStudentFields();
    syncRunFieldState();
    formLiveRegion.textContent = 'Entrada registrada correctamente.';
    runInput.focus();
  } catch (error) {
    showMessage(error.message || 'No fue posible registrar la entrada.', 'error');
    formLiveRegion.textContent = error.message || 'No fue posible registrar la entrada.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Registrar entrada';
  }
});

syncCampus(getSelectedCampus());
updateEspacios();
updateClock();
syncRunFieldState();
applyAuthState(isAuthenticated());
loadTodayRecords().catch((error) => {
  showMessage(error.message || 'No se pudieron cargar los registros del día.', 'error');
});
window.setInterval(updateClock, 1000);
