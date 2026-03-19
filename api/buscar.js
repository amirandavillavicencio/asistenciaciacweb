const { supabaseRequest } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const run = String(req.query.run || '').replace(/\D/g, '');

    // No bloquear, solo no buscar si es muy corto
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
    });

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(200).json({ alumno: null });
    }

    const alumno = data[0];

    return res.status(200).json({
      alumno: {
        run: alumno.rut || '',
        dv: alumno.dv || '',
        carrera: alumno.carrera_ingreso || '',
        anio_ingreso: alumno.cohorte || '',
        sede: alumno.sede || '',
      },
    });
  } catch (error) {
    console.error('ERROR BUSCAR:', error);

    // 👇 clave: NO romper frontend
    return res.status(200).json({
      alumno: null,
    });
  }
};
