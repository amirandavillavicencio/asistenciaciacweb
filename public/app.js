const form = document.getElementById('registro-form');
const runInput = document.getElementById('run');
const dvInput = document.getElementById('dv');
const nombreInput = document.getElementById('nombre');
const carreraInput = document.getElementById('carrera');
const anioInput = document.getElementById('anio_ingreso');
const recordsBody = document.getElementById('records-body');
const recordsCount = document.getElementById('records-count');
const messageBox = document.getElementById('message');
const submitButton = document.getElementById('submit-button');
const autocompleteStatus = document.getElementById('autocomplete-status');

let autocompleteTimer = null;

function sanitizeRun(value) {
  return String(value).replace(/\D/g, '');
}

function sanitizeDv(value) {
  return String(value).toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);
}

function showMessage(text, type) {
  messageBox.textContent = text;
  messageBox.className = `message is-visible message--${type}`;
}

function clearMessage() {
  messageBox.textContent = '';
  messageBox.className = 'message';
}

function renderRecords(records) {
  if (!Array.isArray(records) || records.length === 0) {
    recordsBody.innerHTML = '<tr><td colspan="6" class="empty">No hay registros hoy.</td></tr>';
    recordsCount.textContent = '0 registros';
    return;
  }

  recordsBody.innerHTML = records.map((item) => `
    <tr>
      <td>${item.hora_entrada || ''}</td>
      <td>${item.hora_salida || ''}</td>
      <td>${item.run}-${item.dv}</td>
      <td>${escapeHtml(item.nombre || '')}</td>
      <td>${escapeHtml(item.carrera || '')}</td>
      <td><span class="estado ${item.estado === 'Dentro' ? 'estado--dentro' : 'estado--fuera'}">${item.estado}</span></td>
    </tr>
  `).join('');

  recordsCount.textContent = `${records.length} registro${records.length === 1 ? '' : 's'}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function loadTodayRecords() {
  const response = await fetch('/api/registros-hoy');
  const data = await response.json();
  renderRecords(data.registros || []);
}

async function lookupStudent(runValue) {
  const run = sanitizeRun(runValue);

  if (run.length < 3) {
    autocompleteStatus.textContent = 'Escribe al menos 3 dígitos del RUN para buscar coincidencias.';
    return;
  }

  autocompleteStatus.textContent = 'Buscando coincidencia...';

  try {
    const response = await fetch(`/api/buscar?run=${encodeURIComponent(run)}`);
    const data = await response.json();

    if (!data.alumno) {
      autocompleteStatus.textContent = 'Sin coincidencias. Puedes completar los datos manualmente.';
      return;
    }

    dvInput.value = data.alumno.dv || '';
    carreraInput.value = data.alumno.carrera || '';
    anioInput.value = data.alumno.anio_ingreso ? String(data.alumno.anio_ingreso) : '';
    autocompleteStatus.textContent = `Coincidencia encontrada para RUN ${data.alumno.run}-${data.alumno.dv}.`;
  } catch (error) {
    autocompleteStatus.textContent = 'No se pudo consultar el autocompletado.';
  }
}

runInput.addEventListener('input', () => {
  runInput.value = sanitizeRun(runInput.value);
  clearMessage();

  window.clearTimeout(autocompleteTimer);
  autocompleteTimer = window.setTimeout(() => {
    lookupStudent(runInput.value);
  }, 250);
});

dvInput.addEventListener('input', () => {
  dvInput.value = sanitizeDv(dvInput.value);
  clearMessage();
});

anioInput.addEventListener('input', () => {
  anioInput.value = anioInput.value.replace(/\D/g, '').slice(0, 4);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  const payload = {
    run: sanitizeRun(runInput.value),
    dv: sanitizeDv(dvInput.value),
    nombre: nombreInput.value.trim(),
    carrera: carreraInput.value.trim(),
    anio_ingreso: anioInput.value.trim(),
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
      showMessage(data.error || 'No se pudo registrar.', 'error');
      return;
    }

    showMessage(data.message || 'Registro actualizado.', 'success');
    renderRecords(data.registrosHoy || []);
    form.reset();
    autocompleteStatus.textContent = 'Escribe al menos 3 dígitos del RUN para buscar coincidencias.';
    runInput.focus();
  } catch (error) {
    showMessage('Ocurrió un error inesperado al registrar.', 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Registrar';
  }
});

loadTodayRecords().catch(() => {
  showMessage('No se pudieron cargar los registros del día.', 'error');
});
