import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';

function cookieValue(cookie, name) {
  const match = cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

async function recordRequest(request, sessionId) {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for') || '';
  const ip = forwarded.split(',')[0].trim();
  const salt = process.env.ACCESS_LOG_SALT || 'recruit-ai';
  const ipHash = ip
    ? createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 16)
    : 'unknown';
  const now = new Date();
  const event = {
    kind: 'page',
    sessionId,
    timestamp: now.toISOString(),
    path: new URL(request.url).pathname,
    userAgent: headers.get('user-agent') || '',
    acceptLanguage: headers.get('accept-language') || '',
    fetchMode: headers.get('sec-fetch-mode') || '',
    fetchSite: headers.get('sec-fetch-site') || '',
    referrer: headers.get('referer') || '',
    ipHash,
    country: headers.get('x-vercel-ip-country') || '',
    city: headers.get('x-vercel-ip-city') || '',
  };
  const day = now.toISOString().slice(0, 10);
  await put(`access/${day}/${now.getTime()}-${randomUUID()}.json`, JSON.stringify(event), {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

export default {
  async fetch(request) {
    const sessionId = cookieValue(request.headers.get('cookie') || '', 'rai_sid') || randomUUID();
    try {
      await recordRequest(request, sessionId);
    } catch (error) {
      console.error('Access log write failed', error);
    }

    const html = await readFile(path.join(process.cwd(), 'dist', 'home.html'), 'utf8');
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'private, no-store',
        'set-cookie': `rai_sid=${encodeURIComponent(sessionId)}; Path=/; Max-Age=86400; SameSite=Lax; Secure`,
        'x-robots-tag': 'all',
      },
    });
  },
};
