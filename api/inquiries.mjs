import { timingSafeEqual } from 'node:crypto';

function authorized(request) {
  const supplied = request.headers.get('x-admin-password') || '';
  const expected = process.env.ANALYTICS_PASSWORD || '';
  if (!supplied || !expected) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
    ...extra,
  };
}

function text(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

async function supabase(path, options = {}) {
  const base = process.env.SUPABASE_URL;
  if (!base) throw new Error('SUPABASE_URL is not configured.');
  return fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: supabaseHeaders(options.headers),
  });
}

async function createInquiry(request) {
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: '入力内容を確認してください。' }, { status: 400 });
  }

  if (text(input.website, 100)) return new Response(null, { status: 204 });
  const kind = input.kind === 'agent_provider' ? 'agent_provider' : 'company';
  const email = text(input.email, 254).toLowerCase();
  if (!validEmail(email)) {
    return Response.json({ error: '正しいメールアドレスを入力してください。' }, { status: 400 });
  }

  const row = {
    kind,
    company_name: text(input.companyName, 120) || null,
    contact_name: text(input.contactName, 120) || null,
    email,
    category: kind === 'company' ? text(input.category, 120) || null : null,
    agent_specialty: kind === 'agent_provider' ? text(input.agentSpecialty, 300) || null : null,
    source_path: text(input.sourcePath, 200) || '/',
  };
  if (!row.company_name && !row.contact_name) {
    return Response.json({ error: '会社名またはお名前を入力してください。' }, { status: 400 });
  }

  const result = await supabase('inquiries', {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!result.ok) {
    console.error('Supabase insert failed', result.status, await result.text());
    return Response.json({ error: '送信できませんでした。時間をおいて再度お試しください。' }, { status: 502 });
  }
  return Response.json({ ok: true }, { status: 201 });
}

async function listInquiries(request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await supabase('inquiries?select=*&order=created_at.desc&limit=200', {
    headers: { accept: 'application/json' },
  });
  if (!result.ok) return Response.json({ error: 'Supabase read failed' }, { status: 502 });
  return Response.json({ inquiries: await result.json() }, { headers: { 'cache-control': 'no-store' } });
}

async function updateInquiry(request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const id = text(input.id, 40);
  const allowedStatuses = new Set(['new', 'in_progress', 'done', 'spam']);
  const update = {};
  if (allowedStatuses.has(input.status)) update.status = input.status;
  if (typeof input.adminNotes === 'string') update.admin_notes = text(input.adminNotes, 2000);
  if (!id || Object.keys(update).length === 0) return Response.json({ error: 'Invalid update' }, { status: 400 });

  const result = await supabase(`inquiries?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify(update),
  });
  if (!result.ok) return Response.json({ error: 'Supabase update failed' }, { status: 502 });
  const rows = await result.json();
  return Response.json({ inquiry: rows[0] || null });
}

export default {
  async fetch(request) {
    if (request.method === 'POST') return createInquiry(request);
    if (request.method === 'GET') return listInquiries(request);
    if (request.method === 'PATCH') return updateInquiry(request);
    return new Response('Method Not Allowed', { status: 405 });
  },
};
