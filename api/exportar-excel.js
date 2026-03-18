const XLSX = require('xlsx');
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
    const records = await supabaseRequest({
      path: 'attendance_records',
      query: {
        select: 'dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,observaciones',
        dia: `eq.${today}`,
        order: 'hora_entrada.asc',
      },
    });

    const rows = (records || []).map((item) => ({
      'Día': item.dia || '',
      'Hora Entrada': item.hora_entrada || '',
      'Hora Salida': item.hora_salida || '',
      'RUN (sin puntos ni digito verificador)': item.run || '',
      'Dígito V': item.dv || '',
      Carrera: item.carrera || '',
      Sede: item.sede || '',
      'Año Ingreso': item.anio_ingreso || '',
      Actividad: item.actividad || '',
      'Temática': item.tematica || '',
      Observaciones: item.observaciones || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [
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
      ],
      skipHeader: false,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ciac-registros-${today}.xlsx"`);
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo exportar el archivo Excel.', detail: error.message });
  }
};
