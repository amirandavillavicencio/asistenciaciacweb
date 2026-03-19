const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();

function getAdminPassword() {
  if (!ADMIN_PASSWORD) {
    const error = new Error('Falta configurar ADMIN_PASSWORD.');
    error.status = 500;
    throw error;
  }

  return ADMIN_PASSWORD;
}

function validateAdminPassword(value) {
  return String(value || '').trim() === getAdminPassword();
}

function getPasswordFromRequest(req) {
  const headerValue = req.headers?.['x-report-password'];
  const bodyValue = req.body?.password;
  const queryValue = req.query?.password;
  return String(headerValue || bodyValue || queryValue || '').trim();
}

function requireReportAccess(req) {
  const password = getPasswordFromRequest(req);

  if (!validateAdminPassword(password)) {
    const error = new Error('Clave incorrecta');
    error.status = 401;
    throw error;
  }

  return true;
}

module.exports = {
  getAdminPassword,
  getPasswordFromRequest,
  requireReportAccess,
  validateAdminPassword,
};
