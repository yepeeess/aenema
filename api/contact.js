const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

module.exports = async (request, response) => {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const name = asText(request.body?.name, 100);
  const email = asText(request.body?.email, 254).toLowerCase();
  const message = asText(request.body?.message, 3000);

  if (!name || !message || !EMAIL_PATTERN.test(email)) {
    return response.status(400).json({ error: 'Invalid contact request' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return response.status(503).json({ error: 'Contact service is not configured' });
  }

  try {
    const result = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/contact_requests`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ name, email, message })
    });

    if (!result.ok) throw new Error(`Supabase request failed: ${result.status}`);
    return response.status(201).json({ ok: true });
  } catch (error) {
    console.error('Contact request failed', error);
    return response.status(500).json({ error: 'Unable to save contact request' });
  }
};
