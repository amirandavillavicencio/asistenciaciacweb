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
const messageBox = document.getElementById('message');
const submitButton = document.getElementById('submit-button');

function sanitizeRun(value) {
  return String(value || '').replace(/\D/g, '');
}

function sanitizeDv(value) {
  return String(value || '').trim().toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);
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

function getSelectedCampus() {
  return campusHeaderInput?.value || '';
}

function updateEspacios() {
  if (!espacioInput) return;

  const campus = getSelectedCampus();
  const spaces = CAMPUS_SPACES[campus] || [];

  if (!spaces.length) {
    espacioInput.innerHTML = '<option value="">Selecciona primero el campus</option>';
    espacioInput.disabled = true;
    return;
  }

  espacioInput.innerHTML = ['<option value="">Selecciona espacio</option>']
    .concat(spaces.map((s) => `<option value="${s}">${s}</option>`))
    .join('');

  espacioInput.disabled = false;
}

campusHeaderInput?.addEventListener('change', () => {
  updateEspacios();
  clearMessage();
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  // 🔥 VALIDACIÓN NUEVA
  const selectedCampus = getSelectedCampus();

  if (!selectedCampus) {
    showMessage('⚠️ Debes seleccionar tu campus antes de registrar.', 'error');
    campusHeaderInput?.focus();
    return;
  }

  const payload = {
    campus: selectedCampus,
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
      throw new Error(data.error || 'No se pudo registrar.');
    }

    showMessage('Entrada registrada correctamente.', 'success');

    const actividadSeleccionada = actividadInput.value;

    form.reset();
    campusHeaderInput.value = selectedCampus;
    actividadInput.value = actividadSeleccionada;

    updateEspacios();
    runInput.focus();

  } catch (error) {
    showMessage(error.message || 'Error al registrar.', 'error');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Registrar entrada';
    }
  }
});

updateEspacios();
