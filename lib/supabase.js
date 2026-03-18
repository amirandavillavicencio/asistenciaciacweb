const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error('Falta SUPABASE_URL');
}

if (!SUPABASE_ANON_KEY) {
  throw new Error('Falta SUPABASE_ANON_KEY');
}

async function supabaseRequest({ path, method = 'GET', query = {}, body = null }) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await response.text();

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
      'Error consultando Supabase'
    );
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

module.exports = { supabaseRequest };
