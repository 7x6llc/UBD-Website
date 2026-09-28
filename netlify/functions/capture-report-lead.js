const BREVO_API = 'https://api.brevo.com/v3';
const DEFAULT_LIST_NAME = 'Unbecoming By Design — Website Leads';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function text(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

async function brevo(path, apiKey, options = {}) {
  const response = await fetch(`${BREVO_API}${path}`, {
    ...options,
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(
      `Brevo request failed (${response.status}): ${errorText}`
    );
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;

  return response.json();
}

async function resolveListId(apiKey) {
  const result = await brevo('/contacts/lists?limit=50&offset=0', apiKey, {
    method: 'GET'
  });

  const lists = Array.isArray(result?.lists) ? result.lists : [];

  const match = lists.find(
    list => String(list.name || '').trim() === DEFAULT_LIST_NAME
  );

  return match ? match.id : null;
}

exports.handler = async function(event) {

  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  try {

    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      console.error('BREVO_API_KEY is not configured.');
      return json(500, {
        error: 'Lead capture is temporarily unavailable.'
      });
    }

    let body;

    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, {
        error: 'Invalid request.'
      });
    }

    const name = text(body.name, 200);
    const email = text(body.email, 320).toLowerCase();

    if (!name || !email) {
      return json(400, {
        error: 'Name and email are required.'
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return json(400, {
        error: 'Please enter a valid email address.'
      });
    }

    const nameParts = name.split(/\s+/);

    const firstName = nameParts.shift() || '';

    const lastName = nameParts.join(' ');

    const inquiryDate = new Date().toISOString();

    const listId = await resolveListId(apiKey);

    const attributes = {
      FIRSTNAME: firstName,
      LASTNAME: lastName,
      INTEREST: 'Human Design Report',
      LEAD_SOURCE: 'Website',
      INQUIRY_TYPE: 'Human Design Report',
      INQUIRY_DATE: inquiryDate
    };

    const payload = {
      email,
      attributes,
      updateEnabled: true
    };

    if (listId) {
      payload.listIds = [listId];
    }

    await brevo('/contacts', apiKey, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return json(200, {
      ok: true
    });

  } catch (error) {

    console.error('Human Design report lead capture error:', error);

    return json(500, {
      error: 'Lead capture is temporarily unavailable.'
    });

  }
};
