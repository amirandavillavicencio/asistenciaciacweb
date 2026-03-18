const CAMPUS_SPACES = {
  Vitacura: ['Espacio común'],
  'San Joaquín': ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6', 'Espacio común'],
};

const form = document.getElementById('registro-form');
const campusInput = document.getElementById('campus');
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

let lookupTimer = null;

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

function updateEspacios() {
  const spaces = CAMPUS_SPACES[campusInput.value] || [];

  if (!spaces.length) {
    espacioInput.innerHTML = '<option value="">Selecciona primero el campus</option>';
    espacioInput.disabled = true;
    return;
  }

  espacioInput.innerHTML = ['<option value="">Selecciona espacio</option>']
    .concat(spaces.map((space) => `<option value="${escapeHtml(space)}">${escapeHtml(space)}</option>`))
    .join('');
  espacioInput.disabled = false;
}

function renderRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    recordsBody.innerHTML = '<tr><td colspan="13" class="empty">No hay registros hoy.</td></tr>';
    recordsCount.textContent = '0 registros';
    return;
  }

  recordsBody.innerHTML = records.map((item) => {
    const estadoClass = item.estado === 'Dentro' ? 'estado--activo' : 'estado--cerrado';

    return `
      <tr>
        <td>${escapeHtml(item.dia)}</td>
        <td>${escapeHtml(item.hora_entrada)}</td>
        <td>${escapeHtml(item.hora_salida)}</td>
        <td>${escapeHtml(item.run)}</td>
        <td>${escapeHtml(item.dv)}</td>
        <td>${escapeHtml(item.carrera)}</td>
        <td>${escapeHtml(item.sede)}</td>
        <td>${escapeHtml(item.anio_ingreso)}</td>
        <td>${escapeHtml(item.actividad)}</td>
        <td>${escapeHtml(item.tematica)}</td>
        <td>${escapeHtml(item.observaciones)}</td>
        <td>${escapeHtml(item.espacio)}</td>
        <td><span class="estado ${estadoClass}">${escapeHtml(item.estado)}</span></td>
      </tr>
    `;
  }).join('');

  recordsCount.textContent = `${records.length} registro${records.length === 1 ? '' : 's'}`;
}

async function loadTodayRecords() {
  const response = await fetch('/api/registros-hoy');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'No se pudieron cargar los registros.');
  }

  renderRecords(data.registros || []);
}

async function lookupStudent(runValue) {
  const run = sanitizeRun(runValue);

  if (run.length < 3) {
    autocompleteStatus.textContent = 'Escribe 3 o más dígitos del RUN para consultar la matriz.';
    dvInput.value = '';
    carreraInput.value = '';
    anioInput.value = '';
    return;
  }

  autocompleteStatus.textContent = 'Buscando en students_matrix...';

  try {
    const response = await fetch(`/api/buscar?run=${encodeURIComponent(run)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'No se pudo buscar el RUN.');
    }

    if (!data.alumno) {
      dvInput.value = '';
      carreraInput.value = '';
      anioInput.value = '';
      autocompleteStatus.textContent = 'RUN sin coincidencia en students_matrix.';
      return;
    }

    dvInput.value = data.alumno.dv || '';
    carreraInput.value = data.alumno.carrera || '';
    anioInput.value = data.alumno.anio_ingreso || '';
    if (data.alumno.sede && !campusInput.value) {
      campusInput.value = data.alumno.sede;
      updateEspacios();
    }
    autocompleteStatus.textContent = 'RUN encontrado y datos autocompletados.';
  } catch {
    autocompleteStatus.textContent = 'No se pudo consultar students_matrix en este momento.';
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
      throw new Error(data.error || 'No se pudo exportar el Excel.');
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
    showMessage('Excel exportado correctamente.', 'success');
  } catch (error) {
    showMessage(error.message || 'No se pudo exportar el Excel.', 'error');
  } finally {
    exportButton.disabled = false;
    exportButton.textContent = 'Exportar Excel';
  }
}

campusInput.addEventListener('change', () => {
  updateEspacios();
  clearMessage();
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
    tematica: tematicaInput.value.trim(),
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
      throw new Error(data.error || 'No se pudo registrar.');
    }

    showMessage(data.message || 'Registro guardado.', 'success');
    renderRecords(data.registrosHoy || []);
    const selectedCampus = campusInput.value;
    const selectedActividad = actividadInput.value;
    form.reset();
    campusInput.value = selectedCampus;
    actividadInput.value = selectedActividad;
    dvInput.value = '';
    carreraInput.value = '';
    anioInput.value = '';
    updateEspacios();
    autocompleteStatus.textContent = 'Escribe 3 o más dígitos del RUN para consultar la matriz.';
    runInput.focus();
  } catch (error) {
    showMessage(error.message || 'No se pudo registrar.', 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Registrar';
  }
});

updateEspacios();
loadTodayRecords().catch((error) => {
  showMessage(error.message || 'No se pudieron cargar los registros del día.', 'error');
});
