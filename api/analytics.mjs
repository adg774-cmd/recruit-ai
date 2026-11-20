import { timingSafeEqual } from 'node:crypto';
import { get, list } from '@vercel/blob';
import { classify } from '../lib/classify.mjs';

function authorized(request) {
  const supplied = request.headers.get('x-admin-password') || '';
  const expected = process.env.ANALYTICS_PASSWORD || '';
  if (!supplied || !expected) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(pathname) {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result?.stream) return null;
  return JSON.parse(await new Response(result.stream).text());
}

export default {
  async fetch(request) {
    if (!authorized(request)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { blobs } = await list({ prefix: 'access/', limit: 500 });
    const selected = blobs
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(0, 300);
    const events = (await Promise.all(selected.map((blob) => readJson(blob.pathname)))).filter(Boolean);
    const sessions = new Map();

    for (const event of events) {
      const session = sessions.get(event.sessionId) || { sessionId: event.sessionId, behavior: null };
      if (event.kind === 'page') {
        if (!session.timestamp || event.timestamp < session.timestamp) session.timestamp = event.timestamp;
        session.lastSeen = !session.lastSeen || event.timestamp > session.lastSeen ? event.timestamp : session.lastSeen;
        session.path = event.path;
        session.userAgent = event.userAgent;
        session.acceptLanguage = event.acceptLanguage;
        session.fetchMode = event.fetchMode;
        session.referrer = event.referrer;
        session.ipHash = event.ipHash;
        session.country = event.country;
        session.city = event.city;
        session.pageviews = (session.pageviews || 0) + 1;
      } else if (event.kind === 'behavior') {
        if (!session.behavior || event.timestamp > session.behavior.timestamp) session.behavior = event;
        session.lastSeen = !session.lastSeen || event.timestamp > session.lastSeen ? event.timestamp : session.lastSeen;
      }
      sessions.set(event.sessionId, session);
    }

    const now = Date.now();
    const rows = [...sessions.values()]
      .filter((session) => session.timestamp)
      .map((session) => {
        session.ageSeconds = Math.max(0, (now - new Date(session.timestamp).getTime()) / 1000);
        return { ...session, ...classify(session) };
      })
      .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

    const summary = {
      total: rows.length,
      likelyHuman: rows.filter((row) => row.score < 35).length,
      suspicious: rows.filter((row) => row.score >= 35 && row.score < 65).length,
      likelyAi: rows.filter((row) => row.score >= 65).length,
    };

    return Response.json({ summary, sessions: rows }, {
      headers: { 'cache-control': 'no-store' },
    });
  },
};
