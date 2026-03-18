const { supabaseGet } = require('../lib/supabase');
const { cleanRun } = require('../lib/rut');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const run = cleanRun(req.query.run || '');

    if (run.length < 3) {
      return res.status(200).json({ alumno: null });
    }

    const data = await supabaseGet('students_matrix', {
      select: 'rut,dv,carrera_ingreso,cohorte,sede',
      rut: `eq.${run}`,
      limit: '1',
    });

    const alumno = Array.isArray(data) ? data[0] || null : null;

    if (!alumno) {
      return res.status(200).json({ alumno: null });
    }

    return res.status(200).json({
      alumno: {
        run,
        dv: String(alumno.dv || ''),
        carrera: String(alumno.carrera_ingreso || ''),
        anio_ingreso: alumno.cohorte === null || alumno.cohorte === undefined ? '' : String(alumno.cohorte),
        sede: String(alumno.sede || ''),
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudo buscar el RUN en students_matrix.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
