const { supabaseRequest } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const run = String(req.query.run || '').replace(/\D/g, '');

    if (run.length < 3) {
      return res.status(200).json({ alumno: null, debug: { motivo: 'run muy corto' } });
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

    return res.status(200).json({
      alumno: Array.isArray(data) && data.length > 0 ? data[0] : null,
      debug: {
        runBuscado: run,
        encontrados: Array.isArray(data) ? data.length : 0,
        tipoRespuesta: Array.isArray(data) ? 'array' : typeof data,
      },
    });
  } catch (error) {
    console.error('ERROR BUSCAR:', error);

    return res.status(error.status || 500).json({
      alumno: null,
      error: 'Error al buscar alumno',
      detail: error.message,
      debug: error.details || null,
    });
  }
};
