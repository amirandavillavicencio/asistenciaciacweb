const { supabaseRequest } = require('../lib/supabase');

const CHILE_TIMEZONE = 'America/Santiago';

function getChileDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
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
    const today = getChileDate();
    const data = await supabaseRequest({
      path: 'attendance_records',
      query: {
        select: 'id,campus,run,dv,carrera,anio_ingreso,actividad,espacio,fecha,hora_entrada,hora_salida,estado',
        fecha: `eq.${today}`,
        order: 'hora_entrada.desc',
      },
    });

    return res.status(200).json({ registros: data || [] });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudieron cargar los registros de hoy.', detail: error.message });
  }
};
