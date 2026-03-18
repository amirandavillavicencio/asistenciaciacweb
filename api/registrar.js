const { cleanRun, cleanDv, isValidRut } = require('../lib/rut');
const { registerOrToggle } = require('../lib/registros-store');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  const run = cleanRun(body.run);
  const dv = cleanDv(body.dv);
  const nombre = String(body.nombre || '').trim();
  const carrera = String(body.carrera || '').trim();
  const anioIngresoValue = String(body.anio_ingreso || '').trim();

  if (!run) {
    return res.status(400).json({ error: 'Debes ingresar el RUN.' });
  }

  if (!dv) {
    return res.status(400).json({ error: 'Debes ingresar el DV.' });
  }

  if (!isValidRut(run, dv)) {
    return res.status(400).json({ error: 'El RUN/DV no es válido.' });
  }

  if (!nombre) {
    return res.status(400).json({ error: 'Debes ingresar el nombre.' });
  }

  if (!carrera) {
    return res.status(400).json({ error: 'Debes ingresar la carrera.' });
  }

  if (!/^\d{4}$/.test(anioIngresoValue)) {
    return res.status(400).json({ error: 'El año de ingreso debe tener 4 dígitos.' });
  }

  const result = registerOrToggle({
    run,
    dv,
    nombre,
    carrera,
    anio_ingreso: anioIngresoValue,
  });

  return res.status(200).json({
    ok: true,
    action: result.action,
    record: result.record,
    registrosHoy: result.registrosHoy,
    message: result.action === 'entrada'
      ? 'Entrada registrada correctamente.'
      : 'Salida registrada correctamente.',
  });
};
