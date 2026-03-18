const fetch = require('node-fetch');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || '').trim();

if (!SUPABASE_URL) {
  throw new Error('Falta SUPABASE_URL');
}

if (!SUPABASE_ANON_KEY) {
  throw new Error('Falta SUPABASE_ANON_KEY');
}

async function supabaseRequest({ path, method = 'GET', query = {}, body = null }) {
  const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
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
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    const error = new Error(`ERROR FETCH SUPABASE: ${err.message}`);
    error.status = 500;
    error.details = {
      url: url.toString(),
      cause: err.message
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
      data?.hint ||
      `Supabase respondió ${response.status}`
    );
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

module.exports = { supabaseRequest };
