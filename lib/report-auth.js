const FIXED_REPORT_PASSWORD = 'Ciac.2011';

function getAdminPassword() {
  return FIXED_REPORT_PASSWORD;
}

function validateAdminPassword(value) {
  return String(value || '') === getAdminPassword();
}

function getPasswordFromRequest(req) {
  const headerValue = req.headers?.['x-report-password'];
  const bodyValue = req.body?.password;
  const queryValue = req.query?.password;
  return String(headerValue || bodyValue || queryValue || '');
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
  FIXED_REPORT_PASSWORD,
  getAdminPassword,
  getPasswordFromRequest,
  requireReportAccess,
  validateAdminPassword,
};
