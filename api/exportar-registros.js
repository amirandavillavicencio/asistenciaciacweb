const { supabaseGet } = require('../lib/supabase');

const CHILE_TIMEZONE = 'America/Santiago';
const CSV_HEADERS = [
  'Día',
  'Hora Entrada',
  'Hora Salida',
  'RUN',
  'Dígito V',
  'Carrera',
  'Año Ingreso',
  'Campus',
  'Actividad',
  'Temática',
  'Espacio',
  'Estado',
  'Observaciones',
];

function getChileDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function sanitizeCell(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function toDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function formatDateDDMMYYYY(dateInput) {
  const normalized = sanitizeCell(dateInput);
  if (!normalized) return '';
  const direct = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (direct) return `${direct[3]}/${direct[2]}/${direct[1]}`;
  const parsed = toDate(normalized);
  if (!parsed) return normalized;
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: CHILE_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

function formatHourHHMM(value) {
  const parsed = toDate(value);
  if (!parsed) {
    const normalized = sanitizeCell(value);
    if (!normalized) return '';
    const match = normalized.match(/(\d{2}:\d{2})/);
    return match ? match[1] : normalized;
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CHILE_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(parsed);
  const get = (type) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('hour')}:${get('minute')}`;
}

function escapeCsvCell(value) {
  const normalized = sanitizeCell(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function formatRunValue(run) {
  const normalized = sanitizeCell(run);
  if (!normalized) return '';
  return normalized.replace(/\./g, '').split('-')[0].replace(/\D/g, '');
}

function getDvValue(record) {
  const directDv = sanitizeCell(record?.dv ?? record?.digito_verificador ?? '');
  if (directDv) return directDv.toUpperCase();
  const runSource = sanitizeCell(record?.run ?? record?.rut ?? '');
  const runParts = runSource.split('-');
  return sanitizeCell(runParts[1] ?? '').toUpperCase();
}

// Detecta el valor de fecha del registro probando múltiples nombres de columna
function getDateValue(record) {
  // Primero intenta campo "dia" o "fecha" (tipo DATE)
  const diaDirecto = record?.dia ?? record?.fecha ?? null;
  if (diaDirecto) {
    const normalized = sanitizeCell(diaDirecto);
    // Si ya es YYYY-MM-DD devuelve directo
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  }

  // Fallback a created_at (timestamp)
  const createdAt = toDate(record?.created_at ?? record?.created ?? null);
  if (createdAt) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: CHILE_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(createdAt);
  }

  return '';
}

function buildCsvRow(record) {
  const r = record ?? {};
  return [
    formatDateDDMMYYYY(getDateValue(r)),
    // Hora entrada: prueba múltiples nombres de columna
    formatHourHHMM(r?.hora_entrada ?? r?.entrada ?? r?.check_in ?? r?.hora_ingreso ?? ''),
    // Hora salida: ídem
    formatHourHHMM(r?.hora_salida ?? r?.salida ?? r?.check_out ?? r?.hora_egreso ?? ''),
    formatRunValue(r?.run ?? r?.rut ?? ''),
    getDvValue(r),
    sanitizeCell(r?.carrera ?? ''),
    sanitizeCell(r?.anio_ingreso ?? r?.año_ingreso ?? r?.year_ingreso ?? r?.anio ?? ''),
    // Campus: prueba "campus" y "sede"
    sanitizeCell(r?.campus ?? r?.sede ?? ''),
    sanitizeCell(r?.actividad ?? ''),
    sanitizeCell(r?.tematica ?? r?.temática ?? r?.tematica_consulta ?? ''),
    sanitizeCell(r?.espacio ?? r?.sala ?? ''),
    sanitizeCell(r?.estado ?? ''),
    sanitizeCell(r?.observaciones ?? r?.observacion ?? ''),
  ].map(escapeCsvCell).join(';');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const today = getChileDate();
    const campusSeleccionado = sanitizeCell(req.query?.campus || '');

    // ─── CONSULTA A SUPABASE ───────────────────────────────────────────────
    // supabaseGet usa PostgREST: cada key del objeto query se convierte en
    // un parámetro de URL. El formato correcto para filtros PostgREST es:
    //   columna = "eq.valor"   →  ?columna=eq.valor
    //   select  = "*"          →  ?select=*
    //   order   = "col.asc"    →  ?order=col.asc
    //
    // Para fecha intentamos AMBAS columnas posibles:
    //   1) "dia" (tipo DATE exacto)
    //   2) Si falla o devuelve vacío, filtramos por rango en "created_at"

    let rows = [];

    // Intento 1: filtrar por columna "dia" (DATE exacto)
    try {
      const query1 = {
        select: '*',
        dia: `eq.${today}`,
        order: 'created_at.asc',
      };
      if (campusSeleccionado) query1.campus = `eq.${campusSeleccionado}`;

      const resultado1 = await supabaseGet('attendance_records', query1, {
        endpointName: 'export-csv-dia',
      });
      rows = Array.isArray(resultado1) ? resultado1 : [];
      console.log('[CSV] Intento 1 (filtro dia):', rows.length, 'registros');
    } catch (e) {
      console.log('[CSV] Intento 1 falló:', e.message);
    }

    // Intento 2: si no trajo nada, filtrar por rango en created_at
    if (rows.length === 0) {
      try {
        const query2 = {
          select: '*',
          created_at: `gte.${today}T00:00:00`,
          'created_at.lte': `${today}T23:59:59`,   // segundo filtro mismo campo
          order: 'created_at.asc',
        };
        // PostgREST soporta múltiples filtros sobre la misma columna así:
        // ?created_at=gte.2025-03-24T00:00:00&created_at=lte.2025-03-24T23:59:59
        // pero URLSearchParams descarta duplicados, así que usamos "and" de PostgREST:
        const query2Clean = {
          select: '*',
          and: `(created_at.gte.${today}T00:00:00,created_at.lte.${today}T23:59:59)`,
          order: 'created_at.asc',
        };
        if (campusSeleccionado) query2Clean.campus = `eq.${campusSeleccionado}`;

        const resultado2 = await supabaseGet('attendance_records', query2Clean, {
          endpointName: 'export-csv-created_at',
        });
        rows = Array.isArray(resultado2) ? resultado2 : [];
        console.log('[CSV] Intento 2 (filtro created_at):', rows.length, 'registros');
      } catch (e) {
        console.log('[CSV] Intento 2 falló:', e.message);
      }
    }

    // Intento 3: sin filtro de fecha — trae todo y filtramos en memoria
    // Útil para diagnosticar si el problema es la tabla o los filtros
    if (rows.length === 0) {
      try {
        const query3 = {
          select: '*',
          order: 'created_at.asc',
          limit: '500',
        };
        if (campusSeleccionado) query3.campus = `eq.${campusSeleccionado}`;

        const resultado3 = await supabaseGet('attendance_records', query3, {
          endpointName: 'export-csv-sinFiltro',
        });
        const todos = Array.isArray(resultado3) ? resultado3 : [];
        console.log('[CSV] Intento 3 (sin filtro fecha):', todos.length, 'registros totales');

        // Log del primer registro para ver nombres de columnas reales
        if (todos.length > 0) {
          console.log('[CSV] Columnas reales del primer registro:', JSON.stringify(Object.keys(todos[0])));
          console.log('[CSV] Primer registro completo:', JSON.stringify(todos[0], null, 2));
        }

        // Filtrar en memoria por hoy usando cualquier campo de fecha disponible
        rows = todos.filter((r) => {
          const fechaReg = getDateValue(r);
          return fechaReg === today;
        });
        console.log('[CSV] Registros de hoy tras filtro en memoria:', rows.length);
      } catch (e) {
        console.log('[CSV] Intento 3 falló:', e.message);
        throw e; // Si el intento 3 falla, ya no hay más opciones
      }
    }

    // ─── CONSTRUCCIÓN DEL CSV ─────────────────────────────────────────────
    const csvLines = [
      CSV_HEADERS.map(escapeCsvCell).join(';'),
      ...rows.map((record) => buildCsvRow(record)),
    ];
    const csvContent = `\uFEFF${csvLines.join('\r\n')}\r\n`;
    const buffer = Buffer.from(csvContent, 'utf8');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="registros_CIAC_${today}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', buffer.length);

    return res.status(200).send(buffer);
  } catch (error) {
    console.error('[CSV] Error final:', error.message, error.details ?? '');
    return res.status(error.status || 500).json({
      error: 'No se pudo exportar el archivo CSV.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
