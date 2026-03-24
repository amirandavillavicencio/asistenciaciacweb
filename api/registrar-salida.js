const { supabaseGet, supabasePatch } = require('../lib/supabase');
const { getFechaHoraCL } = require('../lib/fecha-hora-cl');

const RECORD_SELECT = 'id,dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,observaciones,espacio,estado,created_at';

function parseBody(req) {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}');
  }

  return req.body || {};
}

async function getTodayRecords(dia) {
  const data = await supabaseGet('attendance_records', {
    select: RECORD_SELECT,
    dia: `eq.${dia}`,
    order: 'hora_entrada.desc',
  });

  return Array.isArray(data) ? data : [];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const body = parseBody(req);
    const id = String(body.id || '').trim();

    if (!id) {
      return res.status(400).json({ error: 'Debes indicar un registro válido.' });
    }

    const { hora, timestamp } = getFechaHoraCL();
    const dia = String(timestamp).slice(0, 10);

    console.log('Hora Chile:', hora);
    console.log('Timestamp:', timestamp);
    const existing = await supabaseGet('attendance_records', {
      select: RECORD_SELECT,
      id: `eq.${id}`,
      dia: `eq.${dia}`,
      limit: '1',
    });

    const record = Array.isArray(existing) ? existing[0] || null : null;

    if (!record) {
      return res.status(404).json({ error: 'No se encontró el registro solicitado.' });
    }

    if (record.hora_salida) {
      return res.status(409).json({ error: 'La salida ya fue registrada para este alumno.' });
    }

    const updated = await supabasePatch(
      'attendance_records',
      { id: `eq.${id}`, select: RECORD_SELECT },
      {
        hora_salida: timestamp,
        estado: 'Fuera',
      },
    );

    const registroActualizado = Array.isArray(updated) ? updated[0] || null : updated;
    const registrosHoy = await getTodayRecords(dia);

    return res.status(200).json({
      message: 'Salida registrada correctamente.',
      registroActualizado,
      registrosHoy,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudo registrar la salida.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
