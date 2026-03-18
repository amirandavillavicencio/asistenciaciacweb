const { supabaseRequest } = require('../lib/supabase');
const { cleanRun, cleanDv, isValidRut } = require('../lib/rut');

const CHILE_TIMEZONE = 'America/Santiago';
const CAMPUS_OPTIONS = ['Vitacura', 'San Joaquín'];
const ACTIVITY_OPTIONS = [
  'Reforzamiento',
  'Consultoría',
  'Tutoría par integral',
  'Mentoría',
  'Psicoeducativo individual',
  'Psicoeducativo grupal',
  'Uso de sala',
];
const SPACE_OPTIONS = {
  Vitacura: ['Espacio común'],
  'San Joaquín': ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6', 'Espacio común'],
};
const RECORD_SELECT = 'id,dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,observaciones,espacio,estado,created_at';

function getChileParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
}

function getChileDateInfo(date = new Date()) {
  const parts = getChileParts(date);
  const dia = `${parts.year}-${parts.month}-${parts.day}`;
  const iso = `${dia}T${parts.hour}:${parts.minute}:${parts.second}-03:00`;

  return {
    dia,
    timestamp: new Date(iso).toISOString(),
  };
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}');
  }

  return req.body || {};
}

async function getOpenRecord(dia, run) {
  const data = await supabaseRequest({
    path: 'attendance_records',
    query: {
      select: RECORD_SELECT,
      dia: `eq.${dia}`,
      run: `eq.${run}`,
      estado: 'eq.Dentro',
      order: 'hora_entrada.desc',
      limit: '1',
    },
  });

  return Array.isArray(data) ? data[0] || null : null;
}

async function getTodayRecords(dia) {
  const data = await supabaseRequest({
    path: 'attendance_records',
    query: {
      select: RECORD_SELECT,
      dia: `eq.${dia}`,
      order: 'hora_entrada.desc',
    },
  });

  return Array.isArray(data) ? data : [];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const body = parseBody(req);
    const campus = String(body.campus || '').trim();
    const run = cleanRun(body.run || '');
    const dv = cleanDv(body.dv || '');
    const carrera = String(body.carrera || '').trim();
    const anioIngreso = String(body.anio_ingreso || '').trim();
    const actividad = String(body.actividad || '').trim();
    const tematica = String(body.tematica || '').trim();
    const observaciones = String(body.observaciones || '').trim();
    const espacio = String(body.espacio || '').trim();

    if (!CAMPUS_OPTIONS.includes(campus)) {
      return res.status(400).json({ error: 'Debes seleccionar un campus válido.' });
    }

    if (!run) {
      return res.status(400).json({ error: 'Debes ingresar el RUN.' });
    }

    if (!dv) {
      return res.status(400).json({ error: 'Debes ingresar el DV.' });
    }

    if (!isValidRut(run, dv)) {
      return res.status(400).json({ error: 'El RUN y DV no son válidos.' });
    }

    if (!carrera) {
      return res.status(400).json({ error: 'Debes ingresar la carrera.' });
    }

    if (!/^\d{4}$/.test(anioIngreso)) {
      return res.status(400).json({ error: 'Debes ingresar un año de ingreso válido.' });
    }

    if (!ACTIVITY_OPTIONS.includes(actividad)) {
      return res.status(400).json({ error: 'Debes seleccionar una actividad válida.' });
    }

    if (!SPACE_OPTIONS[campus].includes(espacio)) {
      return res.status(400).json({ error: 'Debes seleccionar un espacio válido para el campus elegido.' });
    }

    const now = getChileDateInfo();
    const openRecord = await getOpenRecord(now.dia, run);
    let action = 'entrada';

    if (openRecord) {
      await supabaseRequest({
        path: 'attendance_records',
        method: 'PATCH',
        query: {
          id: `eq.${openRecord.id}`,
        },
        body: {
          hora_salida: now.timestamp,
          estado: 'Fuera',
          dv,
          carrera,
          sede: campus,
          anio_ingreso: Number(anioIngreso),
          actividad,
          tematica,
          observaciones,
          espacio,
        },
        prefer: 'return=minimal',
      });
      action = 'salida';
    } else {
      await supabaseRequest({
        path: 'attendance_records',
        method: 'POST',
        body: {
          dia: now.dia,
          hora_entrada: now.timestamp,
          hora_salida: null,
          run,
          dv,
          carrera,
          sede: campus,
          anio_ingreso: Number(anioIngreso),
          actividad,
          tematica,
          observaciones,
          espacio,
          estado: 'Dentro',
        },
        prefer: 'return=minimal',
      });
    }

    const registrosHoy = await getTodayRecords(now.dia);

    return res.status(200).json({
      ok: true,
      action,
      registrosHoy,
      message: action === 'entrada'
        ? 'Entrada registrada correctamente en Supabase.'
        : 'Salida registrada correctamente en Supabase.',
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudo registrar la asistencia en Supabase.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
