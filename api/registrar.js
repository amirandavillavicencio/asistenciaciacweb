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
  Vitacura: ['Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 6', 'Espacio común'],
  'San Joaquín': ['Espacio común'],
};

function getChileDateTime(date = new Date()) {
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

  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    dia: `${parts.year}-${parts.month}-${parts.day}`,
    hora: `${parts.hour}:${parts.minute}:${parts.second}`,
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
      select: 'id',
      dia: `eq.${dia}`,
      run: `eq.${run}`,
      hora_salida: 'is.null',
      order: 'hora_entrada.desc',
      limit: '1',
    },
  });

  return Array.isArray(data) ? data[0] || null : null;
}

async function getTodayRecords(dia) {
  return supabaseRequest({
    path: 'attendance_records',
    query: {
      select: 'id,dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,observaciones,espacio,estado',
      dia: `eq.${dia}`,
      order: 'hora_entrada.desc',
    },
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const body = parseBody(req);
    const campus = String(body.campus || '').trim();
    const run = cleanRun(body.run);
    const dv = cleanDv(body.dv);
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
      return res.status(400).json({ error: 'El RUN/DV no es válido.' });
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

    if (!tematica) {
      return res.status(400).json({ error: 'Debes ingresar la temática.' });
    }

    if (!observaciones) {
      return res.status(400).json({ error: 'Debes ingresar las observaciones.' });
    }

    if (!SPACE_OPTIONS[campus].includes(espacio)) {
      return res.status(400).json({ error: 'Debes seleccionar un espacio válido para el campus.' });
    }

    const now = getChileDateTime();
    const openRecord = await getOpenRecord(now.dia, run);

    let action;

    if (openRecord) {
      await supabaseRequest({
        path: 'attendance_records',
        method: 'PATCH',
        query: {
          id: `eq.${openRecord.id}`,
        },
        body: {
          hora_salida: now.hora,
          estado: 'Finalizado',
          dv,
          carrera,
          sede: campus,
          anio_ingreso: anioIngreso,
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
          hora_entrada: now.hora,
          hora_salida: null,
          run,
          dv,
          carrera,
          sede: campus,
          anio_ingreso: anioIngreso,
          actividad,
          tematica,
          observaciones,
          espacio,
          estado: 'Abierto',
        },
        prefer: 'return=minimal',
      });
      action = 'entrada';
    }

    const registrosHoy = await getTodayRecords(now.dia);

    return res.status(200).json({
      ok: true,
      action,
      registrosHoy: registrosHoy || [],
      message: action === 'entrada'
        ? 'Entrada registrada correctamente.'
        : 'Salida registrada correctamente.',
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo registrar la asistencia.', detail: error.message });
  }
};
