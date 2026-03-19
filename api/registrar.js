const { supabaseGet, supabasePost } = require('../lib/supabase');
const { cleanRun, cleanDv } = require('../lib/rut');

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
const TOPIC_OPTIONS = ['Matemática', 'Química', 'Física', 'Programación'];
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

function getChileNow(date = new Date()) {
  const parts = getChileParts(date);
  const dia = `${parts.year}-${parts.month}-${parts.day}`;
  const timestamp = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;

  return { dia, timestamp };
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}');
  }

  return req.body || {};
}

async function getOpenRecord(dia, run) {
  const data = await supabaseGet('attendance_records', {
    select: RECORD_SELECT,
    dia: `eq.${dia}`,
    run: `eq.${run}`,
    hora_salida: 'is.null',
    or: '(estado.eq.Dentro,estado.is.null)',
    order: 'hora_entrada.desc',
    limit: '1',
  });

  return Array.isArray(data) ? data[0] || null : null;
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
    const campus = String(body.campus || '').trim();
    const run = cleanRun(body.run || '');
    const dv = cleanDv(body.dv || '');
    const carrera = String(body.carrera || '').trim();
    const anioIngreso = String(body.anio_ingreso || '').trim();
    const actividad = String(body.actividad || '').trim();
    const tematica = String(body.tematica || '').trim();
    const observaciones = String(body.observaciones || '').trim();
    const espacio = String(body.espacio || '').trim();

    if (!campus) {
      return res.status(400).json({ error: 'Debes seleccionar un campus.' });
    }

    if (!CAMPUS_OPTIONS.includes(campus)) {
      return res.status(400).json({ error: 'Debes seleccionar un campus válido.' });
    }

    if (!run) {
      return res.status(400).json({ error: 'Debes ingresar el RUN.' });
    }

    if (!/^\d+$/.test(run)) {
      return res.status(400).json({ error: 'El RUN debe contener solo números.' });
    }

    if (!dv || dv.length !== 1) {
      return res.status(400).json({ error: 'Debes ingresar un dígito verificador válido.' });
    }

    if (!carrera) {
      return res.status(400).json({ error: 'Debes ingresar la carrera.' });
    }

    if (!anioIngreso || !/^\d{4}$/.test(anioIngreso)) {
      return res.status(400).json({ error: 'Debes ingresar un año de ingreso válido.' });
    }

    if (!actividad) {
      return res.status(400).json({ error: 'Debes seleccionar una actividad.' });
    }

    if (!ACTIVITY_OPTIONS.includes(actividad)) {
      return res.status(400).json({ error: 'Debes seleccionar una actividad válida.' });
    }

    if (!tematica) {
      return res.status(400).json({ error: 'Debes seleccionar una temática.' });
    }

    if (!TOPIC_OPTIONS.includes(tematica)) {
      return res.status(400).json({ error: 'Debes seleccionar una temática válida.' });
    }

    if (!espacio) {
      return res.status(400).json({ error: 'Debes seleccionar un espacio.' });
    }

    if (!SPACE_OPTIONS[campus].includes(espacio)) {
      return res.status(400).json({ error: 'Debes seleccionar un espacio válido para el campus elegido.' });
    }

    const now = getChileNow();
    const openRecord = await getOpenRecord(now.dia, run);

    if (openRecord) {
      return res.status(409).json({
        error: 'El alumno ya tiene una entrada activa hoy. Registra la salida desde la lista de registros.',
      });
    }

    const inserted = await supabasePost(
      'attendance_records',
      {
        dia: now.dia,
        hora_entrada: now.timestamp,
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
      { select: RECORD_SELECT },
    );

    const registroActualizado = Array.isArray(inserted) ? inserted[0] || null : inserted;
    const registrosHoy = await getTodayRecords(now.dia);

    return res.status(200).json({
      message: 'Entrada registrada correctamente.',
      registroActualizado,
      registrosHoy,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudo registrar la asistencia.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
