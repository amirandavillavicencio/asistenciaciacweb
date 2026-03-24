const { supabaseGet } = require('../lib/supabase');
const { cleanRun } = require('../lib/rut');

const RECORD_SELECT = 'id,dia,hora_entrada,hora_salida,run,dv,carrera,sede,estado';

function parseBody(req) {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}');
  }

  return req.body || {};
}

function getChileDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function extractRunForSearch(value) {
  const raw = String(value || '').trim().toUpperCase();

  if (!raw) {
    return '';
  }

  const withoutDots = raw.replace(/\./g, '').replace(/\s+/g, '');

  if (withoutDots.includes('-')) {
    const [runPart] = withoutDots.split('-');
    return cleanRun(runPart);
  }

  const compact = withoutDots.replace(/-/g, '');

  if (/^\d+$/.test(compact)) {
    if (compact.length >= 9) {
      return compact.slice(0, -1);
    }
    return compact;
  }

  if (/^\d+[0-9K]$/.test(compact)) {
    return cleanRun(compact.slice(0, -1));
  }

  return cleanRun(compact);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const body = parseBody(req);
    const run = extractRunForSearch(body.run || '');

    if (!/^\d{7,8}$/.test(run)) {
      return res.status(400).json({ error: 'Debes indicar un RUN válido.' });
    }

    const dia = getChileDate();
    const rows = await supabaseGet('attendance_records', {
      select: RECORD_SELECT,
      dia: `eq.${dia}`,
      run: `eq.${run}`,
      hora_salida: 'is.null',
      estado: 'eq.Dentro',
      order: 'hora_entrada.desc',
      limit: '1',
    }, { endpointName: 'api/buscar-activo-rut.js' });

    const record = Array.isArray(rows) ? rows[0] || null : null;

    if (!record) {
      return res.status(200).json({ found: false });
    }

    return res.status(200).json({ found: true, record });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudo buscar un ingreso activo por RUT.',
      detail: error.message || 'Error desconocido.',
      supabase: error.details || null,
    });
  }
};
