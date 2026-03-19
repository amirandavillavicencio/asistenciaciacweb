const { supabaseGet } = require('../lib/supabase');
const { requireReportAccess } = require('../lib/report-auth');

const CHILE_TIMEZONE = 'America/Santiago';
const RECORD_SELECT = 'dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,estado';

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
    requireReportAccess(req);

    const dia = getChileDate();
    const campus = String(req.query?.campus || '').trim();
    const query = {
      select: RECORD_SELECT,
      dia: `eq.${dia}`,
      order: 'hora_entrada.desc',
    };

    if (campus) {
      query.sede = `eq.${campus}`;
    }

    const registros = await supabaseGet('attendance_records', query);
    return res.status(200).json({ registros: Array.isArray(registros) ? registros : [] });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'No se pudo cargar el informe.',
      detail: error.details || null,
    });
  }
};
