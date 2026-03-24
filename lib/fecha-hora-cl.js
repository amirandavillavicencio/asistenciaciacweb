const CHILE_TIMEZONE = 'America/Santiago';

function getChileDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value;

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function getFechaHoraCL() {
  const ahora = new Date();
  const { year, month, day, hour, minute, second } = getChileDateParts(ahora);
  const fechaISO = `${year}-${month}-${day}`;
  const horaISO = `${hour}:${minute}:${second}`;

  return {
    fecha: fechaISO,
    hora: horaISO,
    dia: fechaISO,
    timestamp: ahora.toISOString(),
  };
}

module.exports = {
  CHILE_TIMEZONE,
  getFechaHoraCL,
};
