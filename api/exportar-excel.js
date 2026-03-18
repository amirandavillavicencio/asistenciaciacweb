const XLSX = require('xlsx');
const { supabaseGet } = require('../lib/supabase');

const CHILE_TIMEZONE = 'America/Santiago';
const EXPORT_HEADERS = [
  'Día',
  'Hora Entrada',
  'Hora Salida',
  'RUN (sin puntos ni digito verificador)',
  'Dígito V',
  'Carrera',
  'Sede',
  'Año Ingreso',
  'Actividad',
  'Temática',
  'Observaciones',
];

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
    const dia = getChileDate();
    const records = await supabaseGet('attendance_records', {
      select: 'dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,observaciones',
      dia: `eq.${dia}`,
      order: 'hora_entrada.asc',
    });

    const rows = (Array.isArray(records) ? records : []).map((item) => ({
      [EXPORT_HEADERS[0]]: item.dia || '',
      [EXPORT_HEADERS[1]]: item.hora_entrada || '',
      [EXPORT_HEADERS[2]]: item.hora_salida || '',
      [EXPORT_HEADERS[3]]: item.run || '',
      [EXPORT_HEADERS[4]]: item.dv || '',
      [EXPORT_HEADERS[5]]: item.carrera || '',
      [EXPORT_HEADERS[6]]: item.sede || '',
      [EXPORT_HEADERS[7]]: item.anio_ingreso || '',
      [EXPORT_HEADERS[8]]: item.actividad || '',
      [EXPORT_HEADERS[9]]: item.tematica || '',
      [EXPORT_HEADERS[10]]: item.observaciones || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS, skipHeader: false });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ciac-registros-${dia}.xlsx"`);
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudo exportar el Excel.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
