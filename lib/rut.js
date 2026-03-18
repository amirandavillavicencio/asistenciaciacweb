function cleanRun(value = '') {
  return String(value).replace(/\D/g, '');
}

function cleanDv(value = '') {
  return String(value).trim().toUpperCase().replace(/[^0-9K]/g, '').slice(0, 1);
}

function calculateDv(run) {
  const clean = cleanRun(run);
  if (!clean) return '';

  let sum = 0;
  let multiplier = 2;

  for (let i = clean.length - 1; i >= 0; i -= 1) {
    sum += Number(clean[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);

  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

function isValidRut(run, dv) {
  const clean = cleanRun(run);
  const normalizedDv = cleanDv(dv);

  if (!clean || clean.length < 7 || clean.length > 8 || !normalizedDv) {
    return false;
  }

  return calculateDv(clean) === normalizedDv;
}

module.exports = {
  cleanRun,
  cleanDv,
  calculateDv,
  isValidRut,
};
