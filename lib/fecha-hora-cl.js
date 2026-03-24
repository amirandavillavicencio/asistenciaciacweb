const CHILE_TIMEZONE = 'America/Santiago';

function getFechaHoraCL() {
  const ahora = new Date();

  // Fecha en formato YYYY-MM-DD en hora Chile (para agrupar registros del día)
  const fecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora); // "2026-03-24"

  // Hora legible en Chile para logs
  const hora = ahora.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: CHILE_TIMEZONE,
    hour12: false,
  });

  // Timestamp UTC con Z explícito — siempre usar esto para guardar en Supabase
  const timestampUTC = ahora.toISOString(); // "2026-03-24T17:19:00.000Z"

  return {
    fecha,   // "2026-03-24"  ← úsalo como campo `dia`
    hora,    // "14:19:00"    ← solo para logs
    timestampUTC, // "2026-03-24T17:19:00.000Z" ← úsalo para hora_entrada / hora_salida
  };
}

module.exports = {
  CHILE_TIMEZONE,
  getFechaHoraCL,
};
