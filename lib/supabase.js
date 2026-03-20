const fetch = require('node-fetch');

function getSupabaseConfig() {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl) {
    throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!serviceRoleKey) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
    serviceRoleKey,
  };
}

async function supabaseRequest({ path, method = 'GET', query = {}, body = null }) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const url = new URL(`${supabaseUrl}/rest/v1/${path}`);

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
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: method === 'GET' ? 'count=exact' : 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const error = new Error(`ERROR FETCH SUPABASE: ${err.message}`);
    error.status = 500;
    error.details = {
      url: url.toString(),
      cause: err.message,
    };
    throw error;
  }

  const rawText = await response.text();
  let data = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText ? { raw: rawText } : null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
      data?.error ||
      data?.error_description ||
      data?.details ||
      data?.hint ||
      `Supabase respondió ${response.status}`
    );
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

function supabaseGet(path, query = {}) {
  return supabaseRequest({ path, method: 'GET', query });
}

function supabasePost(path, body = {}, query = {}) {
  return supabaseRequest({ path, method: 'POST', query, body });
}

function supabasePatch(path, query = {}, body = {}) {
  return supabaseRequest({ path, method: 'PATCH', query, body });
}

module.exports = { supabaseRequest, supabaseGet, supabasePost, supabasePatch, getSupabaseConfig };
