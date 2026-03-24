const CHILE_TIMEZONE = 'America/Santiago';

function getFechaHoraCL() {
  const ahora = new Date();

  return {
    fecha: ahora.toLocaleDateString('es-CL', { timeZone: CHILE_TIMEZONE }),
    hora: ahora.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: CHILE_TIMEZONE,
      hour12: false,
    }),
    timestamp: ahora.toLocaleString('sv-SE', {
      timeZone: CHILE_TIMEZONE,
      hour12: false,
    }).replace(' ', 'T'),
  };
}

module.exports = {
  CHILE_TIMEZONE,
  getFechaHoraCL,
};
