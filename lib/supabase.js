const fetch = require('node-fetch');

const PUBLIC_SUPABASE_URL = 'NEXT_PUBLIC_SUPABASE_URL';
const PUBLIC_SUPABASE_ANON_KEY = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';
const SERVICE_ROLE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

function getSupabaseConfig() {
  const url = String(process.env[PUBLIC_SUPABASE_URL] || '').trim();
  const serviceRoleKey = String(process.env[SERVICE_ROLE_KEY] || '').trim();
  const anonKey = String(process.env[PUBLIC_SUPABASE_ANON_KEY] || '').trim();
  const apiKey = serviceRoleKey || anonKey;
  const authToken = serviceRoleKey || anonKey;

  return {
    url,
    anonKey,
    serviceRoleKey,
    apiKey,
    authToken,
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
    hasServiceRoleKey: Boolean(serviceRoleKey),
  };
}

function createConfigError(endpointName, config) {
  const error = new Error('Configuración de Supabase incompleta.');
  error.status = 500;
  error.details = {
    endpoint: endpointName,
    missing: {
      NEXT_PUBLIC_SUPABASE_URL: !config.hasUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !config.hasAnonKey,
      SUPABASE_SERVICE_ROLE_KEY: !config.hasServiceRoleKey,
    },
    message: 'Se requiere NEXT_PUBLIC_SUPABASE_URL y al menos una key de Supabase para procesar la solicitud.',
  };
  return error;
}

async function supabaseRequest({ path, method = 'GET', query = {}, body = null, endpointName = 'unknown-endpoint' }) {
  const config = getSupabaseConfig();

  console.log('[supabaseRequest] config check', JSON.stringify({
    endpoint: endpointName,
    hasUrl: config.hasUrl,
    hasServiceRoleKey: config.hasServiceRoleKey,
    hasAnonKey: config.hasAnonKey,
    method,
    path,
  }));

  if (!config.hasUrl || !config.authToken) {
    throw createConfigError(endpointName, config);
  }

  const baseUrl = config.url.replace(/\/+$/, '');
  const url = new URL(`${baseUrl}/rest/v1/${path}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  let response;

  try {
    response = await fetch(url.toString(), {
      method,
      headers: {
        apikey: config.apiKey,
        Authorization: `Bearer ${config.authToken}`,
        'Content-Type': 'application/json',
        Prefer: method === 'GET' ? 'count=exact' : 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const error = new Error(`ERROR FETCH SUPABASE: ${err.message}`);
    error.status = 500;
    error.details = {
      endpoint: endpointName,
      url: url.toString(),
      cause: err.message,
    };
    console.error('[supabaseRequest] fetch catch', JSON.stringify({
      endpoint: endpointName,
      message: err.message,
    }));
    throw error;
  }

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
      data?.error_description ||
      data?.details ||
      data?.hint ||
      `Supabase respondió ${response.status}`
    );
    error.status = response.status;
    error.details = {
      endpoint: endpointName,
      response: data,
      status: response.status,
      statusText: response.statusText,
      url: url.toString(),
    };
    throw error;
  }

  return data;
}

function supabaseGet(path, query = {}, options = {}) {
  return supabaseRequest({ path, method: 'GET', query, ...options });
}

function supabasePost(path, body = {}, query = {}, options = {}) {
  return supabaseRequest({ path, method: 'POST', query, body, ...options });
}

function supabasePatch(path, query = {}, body = {}, options = {}) {
  return supabaseRequest({ path, method: 'PATCH', query, body, ...options });
}

module.exports = { supabaseRequest, supabaseGet, supabasePost, supabasePatch, getSupabaseConfig };
