const { supabaseRequest } = require('../lib/supabase');

const CHILE_TIMEZONE = 'America/Santiago';
const RECORD_SELECT = 'id,dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,observaciones,espacio,estado,created_at';

function getChileDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const dia = getChileDate();

    const data = await supabaseRequest({
      path: 'attendance_records',
      query: {
        select: RECORD_SELECT,
        dia: `eq.${dia}`,
        order: 'hora_entrada.desc',
      },
    });

    return res.status(200).json({
      registros: Array.isArray(data) ? data : [],
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudieron cargar los registros de hoy desde Supabase.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
