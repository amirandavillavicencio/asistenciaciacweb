const { getPasswordFromRequest, validateAdminPassword } = require('../lib/report-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const password = getPasswordFromRequest(req);
    const authorized = validateAdminPassword(password);

    if (!authorized) {
      return res.status(401).json({ error: 'Clave incorrecta', authorized: false });
    }

    return res.status(200).json({ authorized: true });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'No se pudo validar la clave.',
      authorized: false,
    });
  }
};
