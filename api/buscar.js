const { supabaseRequest } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const run = String(req.query.run || '').replace(/\D/g, '').trim();

    if (!run || run.length < 3) {
      return res.status(200).json({ alumno: null });
    }

    const data = await supabaseRequest({
      path: 'students_matrix',
      query: {
        select: 'rut,dv,cohorte,carrera_ingreso,sede',
        rut: `eq.${run}`,
        limit: '1',
      },
    });

    const alumno = Array.isArray(data) && data.length > 0 ? data[0] : null;

    if (!alumno) {
      return res.status(200).json({ alumno: null });
    }

    return res.status(200).json({
      alumno: {
        run: alumno.rut ? String(alumno.rut) : '',
        dv: alumno.dv ? String(alumno.dv) : '',
        carrera: alumno.carrera_ingreso ? String(alumno.carrera_ingreso) : '',
        anio_ingreso: alumno.cohorte ? String(alumno.cohorte) : '',
        sede: alumno.sede ? String(alumno.sede) : '',
      },
    });
  } catch (error) {
    console.error('Error en /api/buscar:', error);

    return res.status(200).json({
      alumno: null,
      error: 'No fue posible consultar los datos del estudiante.',
    });
  }
};
