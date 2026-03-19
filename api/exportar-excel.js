const XLSX = require('xlsx');
const { supabaseGet } = require('../lib/supabase');

const CHILE_TIMEZONE = 'America/Santiago';

function getChileDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getCurrentSemester(dateString) {
  const date = dateString ? new Date(`${dateString}T12:00:00`) : new Date();
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const term = month <= 6 ? 1 : 2;

  return `${term}-${year}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const dia = getChileDate();
    const registros = await supabaseGet('attendance_records', {
      select: 'dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,observaciones,espacio,estado',
      dia: `eq.${dia}`,
      order: 'hora_entrada.desc',
    });

    const rows = (Array.isArray(registros) ? registros : []).map((item) => ({
      Día: item.dia || '',
      'Hora entrada': item.hora_entrada || '',
      'Hora salida': item.hora_salida || '',
      RUN: item.run || '',
      DV: item.dv || '',
      Carrera: item.carrera || '',
      Sede: item.sede || '',
      'Año ingreso': item.anio_ingreso || '',
      Semestre: getCurrentSemester(item.dia || dia),
      Actividad: item.actividad || '',
      Temática: item.tematica || '',
      Espacio: item.espacio || '',
      Estado: item.hora_salida ? 'Salida registrada' : 'Entrada activa',
      Observaciones: item.observaciones || '',
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: [
      'Día',
      'Hora entrada',
      'Hora salida',
      'RUN',
      'DV',
      'Carrera',
      'Sede',
      'Año ingreso',
      'Semestre',
      'Actividad',
      'Temática',
      'Espacio',
      'Estado',
      'Observaciones',
    ] });
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ciac-registros-${dia}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudo exportar el Excel.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
