function getEnv(name) {
  const value = process.env[name];

  if (!value || !String(value).trim()) {
    throw new Error(`Falta la variable de entorno ${name}.`);
  }

  return String(value).trim();
}

function getConfig() {
  return {
    url: getEnv('SUPABASE_URL').replace(/\/+$/, ''),
    key: getEnv('SUPABASE_ANON_KEY'),
  };
}

function buildUrl(table, query = {}) {
  const { url } = getConfig();
  const endpoint = new URL(`/rest/v1/${table}`, `${url}/`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      endpoint.searchParams.set(key, String(value));
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
  } catch {
    return text;
  }
}

async function request(table, { method = 'GET', query, body, prefer } = {}) {
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

  const response = await fetch(buildUrl(table, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const detail = typeof data === 'object' && data !== null ? data : { message: data };
    const error = new Error(detail.message || detail.error_description || detail.error || 'Error al conectar con Supabase.');
    error.status = response.status;
    error.details = detail;
    throw error;
  }

  return data;
}

function supabaseGet(table, query, options = {}) {
  return request(table, { ...options, method: 'GET', query });
}

function supabasePost(table, body, options = {}) {
  return request(table, {
    ...options,
    method: 'POST',
    body,
    prefer: options.prefer || 'return=representation',
  });
}

function supabasePatch(table, query, body, options = {}) {
  return request(table, {
    ...options,
    method: 'PATCH',
    query,
    body,
    prefer: options.prefer || 'return=representation',
  });
}

module.exports = {
  getConfig,
  supabaseGet,
  supabasePost,
  supabasePatch,
};
