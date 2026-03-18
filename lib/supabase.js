function getEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}.`);
  }

  return value;
}

function getConfig() {
  return {
    url: getEnv('SUPABASE_URL'),
    key: getEnv('SUPABASE_ANON_KEY'),
  };
}

function buildUrl(path, query = {}) {
  const { url } = getConfig();
  const endpoint = new URL(`/rest/v1/${path}`, url.endsWith('/') ? url : `${url}/`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      endpoint.searchParams.set(key, value);
    }
  });

  return endpoint.toString();
}

async function supabaseRequest({ path, method = 'GET', query, body, prefer, select }) {
  const { key } = getConfig();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  if (select) {
    headers.Prefer = prefer || 'return=representation';
  } else if (prefer) {
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

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || 'Error en Supabase.');
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

module.exports = {
  supabaseRequest,
};
