const XLSX = require('xlsx');
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

function slugifyFilename(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeState(record) {
  return record.estado || (record.hora_salida ? 'salida' : 'entrada');
}

function buildDetailRows(records) {
  return records.map((record) => ({
    RUN: record.run || '',
    DV: record.dv || '',
    Carrera: record.carrera || '',
    Sede: record.sede || '',
    'Año Ingreso': record.anio_ingreso || '',
    Temática: record.tematica || '',
    Estado: normalizeState(record),
    'Hora Entrada': record.hora_entrada || '',
    'Hora Salida': record.hora_salida || '',
  }));
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
    const rows = buildDetailRows(Array.isArray(registros) ? registros : []);
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ['RUN', 'DV', 'Carrera', 'Sede', 'Año Ingreso', 'Temática', 'Estado', 'Hora Entrada', 'Hora Salida'],
    });

    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 6 },
      { wch: 28 },
      { wch: 20 },
      { wch: 14 },
      { wch: 28 },
      { wch: 14 },
      { wch: 24 },
      { wch: 24 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Informe');
    const workbookBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filenameSuffix = campus ? `-${slugifyFilename(campus)}` : '';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="informe-uso-ciac-${dia}${filenameSuffix}.xlsx"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', workbookBuffer.length);

    return res.status(200).send(workbookBuffer);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'No se pudo generar el informe de uso.',
      detail: error.details || null,
    });
  }
};
