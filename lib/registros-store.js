const CHILE_TIMEZONE = 'America/Santiago';

function getChileDateParts(date = new Date()) {
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
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

function getStore() {
  if (!globalThis.__ciacRegistroStore) {
    globalThis.__ciacRegistroStore = {
      registros: [],
    };
  }

  return globalThis.__ciacRegistroStore;
}

function getTodayRecords() {
  const store = getStore();
  const today = getChileDateParts().date;

  return store.registros
    .filter((item) => item.fecha === today)
    .sort((a, b) => a.hora_entrada.localeCompare(b.hora_entrada));
}

function registerOrToggle(payload) {
  const store = getStore();
  const now = getChileDateParts();

  const existingOpenRecord = store.registros.find(
    (item) => item.fecha === now.date && item.run === payload.run && !item.hora_salida,
  );

  if (existingOpenRecord) {
    existingOpenRecord.hora_salida = now.time;
    existingOpenRecord.estado = 'Fuera';

    return {
      action: 'salida',
      record: existingOpenRecord,
      registrosHoy: getTodayRecords(),
    };
  }

  const newRecord = {
    run: payload.run,
    dv: payload.dv,
    nombre: payload.nombre,
    carrera: payload.carrera,
    anio_ingreso: payload.anio_ingreso,
    fecha: now.date,
    hora_entrada: now.time,
    hora_salida: '',
    estado: 'Dentro',
  };

  store.registros.push(newRecord);

  return {
    action: 'entrada',
    record: newRecord,
    registrosHoy: getTodayRecords(),
  };
}

module.exports = {
  getTodayRecords,
  registerOrToggle,
  getChileDateParts,
};
