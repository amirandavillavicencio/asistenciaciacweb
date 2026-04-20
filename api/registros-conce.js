const { supabaseGet } = require('../lib/supabase');

const FIXED_CAMPUS = 'Conce';
const RECORD_SELECT = '*';

function getChileDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const dia = getChileDate();
    const registros = await supabaseGet('attendance_records', {
      select: RECORD_SELECT,
      dia: `eq.${dia}`,
      sede: `eq.${FIXED_CAMPUS}`,
      order: 'hora_entrada.desc',
    }, { endpointName: 'api/registros-conce.js' });

    return res.status(200).json({
      registros: Array.isArray(registros) ? registros : [],
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudieron cargar los registros del día.',
      detail: error.message || 'Error desconocido.',
      supabase: error.details || null,
    });
  }
};
