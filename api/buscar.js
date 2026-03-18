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
        select: 'rut,dv,cohorte,carrera_ingreso,sede',
        rut: `eq.${run}`,
        limit: '1',
      },
      prefer: 'return=representation',
    });

    const alumno = Array.isArray(data) ? data[0] : null;

    if (!alumno) {
      return res.status(200).json({ alumno: null });
    }

    return res.status(200).json({
      alumno: {
        run: alumno.rut,
        dv: alumno.dv || '',
        carrera: alumno.carrera_ingreso || '',
        anio_ingreso: alumno.cohorte ? String(alumno.cohorte) : '',
        sede: alumno.sede || '',
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo buscar en la matriz.', detail: error.message });
  }
};
