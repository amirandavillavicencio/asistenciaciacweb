const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !String(SUPABASE_URL).trim()) {
  throw new Error('Falta SUPABASE_URL');
}

if (!SUPABASE_ANON_KEY || !String(SUPABASE_ANON_KEY).trim()) {
  throw new Error('Falta SUPABASE_ANON_KEY');
}

async function supabaseRequest({ path, method = 'GET', query = {}, body = null }) {
  const baseUrl = String(SUPABASE_URL).trim().replace(/\/+$/, '');
  const anonKey = String(SUPABASE_ANON_KEY).trim();
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
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
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

module.exports = { supabaseRequest, supabaseGet, supabasePost, supabasePatch };
