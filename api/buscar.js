const { supabaseRequest } = require('../lib/supabase');
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

    const data = await supabaseRequest({
      path: 'students_matrix',
      query: {
        select: 'run,dv,carrera,anio_ingreso,sede',
        run: `eq.${run}`,
        limit: '1',
      },
      prefer: null,
    });

    const alumno = Array.isArray(data) ? data[0] || null : null;

    if (!alumno) {
      return res.status(200).json({ alumno: null });
    }

    return res.status(200).json({
      alumno: {
        run: String(alumno.run || ''),
        dv: String(alumno.dv || ''),
        carrera: String(alumno.carrera || ''),
        anio_ingreso: alumno.anio_ingreso === null || alumno.anio_ingreso === undefined ? '' : String(alumno.anio_ingreso),
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
