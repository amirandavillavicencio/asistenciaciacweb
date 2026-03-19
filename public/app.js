const CAMPUS_SPACES = {
  Vitacura: ['Espacio común'],
  'San Joaquín': ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6', 'Espacio común'],
};

const form = document.getElementById('registro-form');
const campusInput = document.getElementById('campus');
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
const messageBox = document.getElementById('message');
const autocompleteStatus = document.getElementById('autocomplete-status');
const submitButton = document.getElementById('submit-button');
const recordsBody = document.getElementById('records-body');
const recordsCount = document.getElementById('records-count');
const currentDate = document.getElementById('current-date');
const currentTime = document.getElementById('current-time');
const currentSemesterBadge = document.getElementById('current-semester');

let lookupTimer = null;
let activeCampusFilter = '';

function sanitizeRun(value) {
  return String(value || '').replace(/\D/g, '');
}

function sanitizeDv(value) {
  return String(value || '').trim().toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);
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
}

function clearMessage() {
  messageBox.textContent = '';
  messageBox.className = 'message';
}

function buildApiError(data, fallback) {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  return data.error || fallback;
}

function syncCampus(source, value) {
  if (source !== campusInput) {
    campusInput.value = value;
    updateEspacios();
  }

  if (source !== campusHeaderInput) {
    campusHeaderInput.value = value;
  }

  activeCampusFilter = value;
}

function updateEspacios() {
  const spaces = CAMPUS_SPACES[campusInput.value] || [];
  const previousValue = espacioInput.value;

  if (!spaces.length) {
    espacioInput.innerHTML = '<option value="">Selecciona primero el campus</option>';
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
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  return `${month <= 6 ? 1 : 2}-${year}`;
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Santiago',
  }).format(date);
}

function getStudentLabel(item) {
  const parts = [];

  if (item.carrera) {
    parts.push(item.carrera);
  }

  if (item.anio_ingreso) {
    parts.push(`Ingreso ${item.anio_ingreso}`);
  }

  return parts.join(' · ') || 'Alumno CIAC';
}

function getVisibleRecords(records) {
  if (!activeCampusFilter) {
    return records;
  }

  return records.filter((item) => item.sede === activeCampusFilter);
}

function renderRecords(records) {
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
    const semestre = getCurrentSemester(item.dia ? new Date(`${item.dia}T12:00:00Z`) : new Date());
    const actionButton = isOpen
      ? `<button type="button" class="table-action" data-action="salida" data-id="${escapeHtml(item.id)}">Salida</button>`
      : '<span class="table-action table-action--muted">Completado</span>';

    return `
      <tr>
        <td>${escapeHtml(item.run)}-${escapeHtml(item.dv)}</td>
        <td>
          <div class="student-cell">
            <strong>${escapeHtml(getStudentLabel(item))}</strong>
            <span>${escapeHtml(item.observaciones || 'Sin observaciones')}</span>
          </div>
        </td>
        <td>${escapeHtml(item.sede)}</td>
        <td>${escapeHtml(item.actividad)}</td>
        <td>${escapeHtml(item.tematica)}</td>
        <td>${escapeHtml(item.espacio)}</td>
        <td>${escapeHtml(semestre)}</td>
        <td>${escapeHtml(formatDateTime(item.hora_entrada))}</td>
        <td>${escapeHtml(formatDateTime(item.hora_salida))}</td>
        <td><span class="estado ${estadoClass}">${escapeHtml(estadoText)}</span></td>
        <td>${actionButton}</td>
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
    if (data.alumno.sede && !campusInput.value) {
      syncCampus(campusInput, data.alumno.sede);
    }
    autocompleteStatus.textContent = 'Datos del estudiante completados correctamente.';
  } catch {
    autocompleteStatus.textContent = 'No fue posible consultar los datos del estudiante.';
  }
}

async function exportExcel() {
  clearMessage();
  exportButton.disabled = true;
  exportButton.textContent = 'Exportando...';

  try {
    const response = await fetch('/api/exportar-excel');

    if (!response.ok) {
      const data = await response.json();
      throw new Error(buildApiError(data, 'No se pudo exportar el archivo Excel.'));
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match ? match[1] : 'ciac-registros.xlsx';
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    showMessage('El archivo Excel fue exportado correctamente.', 'success');
  } catch (error) {
    showMessage(error.message || 'No se pudo exportar el archivo Excel.', 'error');
  } finally {
    exportButton.disabled = false;
    exportButton.textContent = 'Exportar Excel';
  }
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
  } catch (error) {
    showMessage(error.message || 'No se pudo registrar la salida.', 'error');
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

campusInput.addEventListener('change', () => {
  syncCampus(campusInput, campusInput.value);
  updateEspacios();
  clearMessage();
  loadTodayRecords().catch((error) => {
    showMessage(error.message || 'No se pudieron cargar los registros del día.', 'error');
  });
});

campusHeaderInput.addEventListener('change', () => {
  syncCampus(campusHeaderInput, campusHeaderInput.value);
  clearMessage();
  loadTodayRecords().catch((error) => {
    showMessage(error.message || 'No se pudieron cargar los registros del día.', 'error');
  });
});

runInput.addEventListener('input', () => {
  runInput.value = sanitizeRun(runInput.value);
  clearMessage();
  window.clearTimeout(lookupTimer);
  lookupTimer = window.setTimeout(() => lookupStudent(runInput.value), 300);
});

dvInput.addEventListener('input', () => {
  dvInput.value = sanitizeDv(dvInput.value);
  clearMessage();
});

anioInput.addEventListener('input', () => {
  anioInput.value = String(anioInput.value || '').replace(/\D/g, '').slice(0, 4);
});

exportButton.addEventListener('click', exportExcel);

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

  const payload = {
    campus: campusInput.value,
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
      throw new Error(buildApiError(data, 'No se pudo registrar la asistencia.'));
    }

    showMessage(data.message || 'Entrada registrada correctamente.', 'success');
    renderRecords(data.registrosHoy || []);

    const selectedCampus = campusInput.value;
    const selectedActividad = actividadInput.value;

    form.reset();
    syncCampus(campusInput, selectedCampus);
    actividadInput.value = selectedActividad;
    updateEspacios();
    autocompleteStatus.textContent = 'Ingresa al menos 3 dígitos para consultar datos del estudiante.';
    runInput.focus();
  } catch (error) {
    showMessage(error.message || 'No se pudo registrar la asistencia.', 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Registrar entrada';
  }
});

updateEspacios();
updateClock();
window.setInterval(updateClock, 1000);
loadTodayRecords().catch((error) => {
  showMessage(error.message || 'No se pudieron cargar los registros del día.', 'error');
});
