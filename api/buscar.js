const alumnos = require('../lib/alumnos-data');
const { cleanRun } = require('../lib/rut');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const run = cleanRun(req.query.run || '');

  if (run.length < 3) {
    return res.status(200).json({ alumno: null });
  }

  const exactMatch = alumnos.find((item) => item.rut === run);
  const prefixMatch = exactMatch || alumnos.find((item) => item.rut.startsWith(run));

  if (!prefixMatch) {
    return res.status(200).json({ alumno: null });
  }

  return res.status(200).json({
    alumno: {
      run: prefixMatch.rut,
      dv: prefixMatch.dv,
      carrera: prefixMatch.carrera_ingreso,
      anio_ingreso: prefixMatch.cohorte,
      sede: prefixMatch.sede,
    },
  });
};
