const { supabaseRequest } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const run = String(req.query.run || '').replace(/\D/g, '');

    if (run.length < 3) {
      return res.status(200).json({ alumno: null });
    }

    const data = await supabaseRequest({
      path: 'students_autocomplete',
      query: {
        select: '*',
        run: `eq.${run}`,
        limit: '1',
      },
      endpointName: 'api/buscar.js',
    });

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(200).json({ alumno: null });
    }

    const alumno = data[0];

    return res.status(200).json({
      alumno: {
        run: alumno.run || '',
        dv: alumno.dv || '',
        carrera: alumno.carrera || '',
        anio_ingreso: alumno.anio_ingreso || '',
        sede: alumno.sede || '',
      },
    });
  } catch (error) {
    console.error('ERROR BUSCAR:', error);

    return res.status(200).json({
      alumno: null,
    });
  }
};
