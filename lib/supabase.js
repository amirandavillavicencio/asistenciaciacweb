function getEnv(name) {
  const value = process.env[name];

  if (!value || !String(value).trim()) {
    throw new Error(`Falta la variable de entorno ${name}.`);
  }

  return String(value).trim();
}

function getConfig() {
  const url = getEnv('SUPABASE_URL').replace(/\/+$/, '');
  const key = getEnv('SUPABASE_ANON_KEY');

  return { url, key };
}

function buildUrl(path, query = {}) {
  const { url } = getConfig();
  const endpoint = new URL(`/rest/v1/${path}`, `${url}/`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      endpoint.searchParams.set(key, value);
    }
  });

  return endpoint.toString();
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

async function supabaseRequest({ path, method = 'GET', query, body, prefer }) {
  const { key } = getConfig();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  if (prefer) {
    headers.Prefer = prefer;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const detail = typeof data === 'object' && data !== null ? data : { message: data };
    const error = new Error(detail.message || detail.error || 'Error en Supabase.');
    error.status = response.status;
    error.details = detail;
    throw error;
  }

  return data;
}

module.exports = {
  getConfig,
  supabaseRequest,
};
