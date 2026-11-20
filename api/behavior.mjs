import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';

function cookieValue(cookie, name) {
  const match = cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function number(value, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(max, parsed)) : 0;
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }
    const sessionId = cookieValue(request.headers.get('cookie') || '', 'rai_sid');
    if (!sessionId) return new Response(null, { status: 204 });

    let input;
    try {
      input = await request.json();
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const now = new Date();
    const event = {
      kind: 'behavior',
      sessionId,
      timestamp: now.toISOString(),
      duration: number(input.duration, 3600),
      scrollDepth: number(input.scrollDepth, 100),
      mouseMoves: number(input.mouseMoves, 10000),
      clicks: number(input.clicks, 1000),
      keydowns: number(input.keydowns, 1000),
      webdriver: Boolean(input.webdriver),
      visibilityChanges: number(input.visibilityChanges, 1000),
    };
    const day = now.toISOString().slice(0, 10);
    try {
      await put(`access/${day}/${now.getTime()}-${randomUUID()}.json`, JSON.stringify(event), {
        access: 'private',
        addRandomSuffix: false,
        contentType: 'application/json',
      });
    } catch (error) {
      console.error('Behavior log write failed', error);
      return Response.json({ error: 'Storage error' }, { status: 500 });
    }
    return new Response(null, { status: 204 });
  },
};
