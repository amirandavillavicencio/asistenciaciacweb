const crypto = require('crypto');

function parseBody(req) {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body || '{}');
  }
  return req.body || {};
}

function safeCompare(a, b) {
  const valueA = String(a || '');
  const valueB = String(b || '');

  const bufferA = Buffer.from(valueA);
  const bufferB = Buffer.from(valueB);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  }

  try {
    const body = parseBody(req);
    const password = String(body.password || '');
    const configuredPassword = String(process.env.CIAC_ACCESS_PASSWORD || '');

    if (!configuredPassword) {
      return res.status(500).json({ ok: false, error: 'Clave de acceso no configurada.' });
    }

    if (!safeCompare(password, configuredPassword)) {
      return res.status(401).json({ ok: false });
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false, error: 'Solicitud inválida.' });
  }
};
