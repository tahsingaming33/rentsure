// Rentsure quote requests API (Vercel serverless function).
//   POST   /api/quotes            public: the website saves a new request
//   GET    /api/quotes            admin: list requests (newest first)
//   PATCH  /api/quotes?id=...     admin: update status, quoted price, notes
//   DELETE /api/quotes?id=...     admin: delete a request
// Admin calls must send the header  x-admin-key: <ADMIN_PASSWORD>.
// Storage: Upstash Redis (Vercel Marketplace). Vercel adds its env vars when you connect it.

import crypto from 'node:crypto';

const DB_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const DB_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const STATUSES = ['new', 'contacted', 'quoted', 'booked', 'lost'];
const TRIPS = ['airport', 'city', 'out', 'monthly'];
const MAX_LIST = 1000;

async function redis(commands) {
  const r = await fetch(`${DB_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`Redis HTTP ${r.status}`);
  const out = await r.json();
  return out.map((x) => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v, min, max) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

function authed(req) {
  const given = String(req.headers['x-admin-key'] || '');
  if (!ADMIN_PASSWORD || !given) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

async function create(req, res) {
  const b = body(req);
  if (b.rs_hp) return res.status(200).json({ ok: true }); // honeypot: bots fill hidden fields (renamed so browser autofill can't trip it)

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const [hits] = await redis([['INCR', `rl:${ip}`], ['EXPIRE', `rl:${ip}`, 600, 'NX']]);
  if (hits > 30) return res.status(429).json({ error: 'Too many requests. Please message us on WhatsApp.' });

  const q = {
    trip: TRIPS.includes(b.trip) ? b.trip : 'city',
    from: str(b.from, 200),
    to: str(b.to, 200),
    pin: /^https:\/\/(maps\.google\.com|www\.google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/.test(str(b.pin, 400)) ? str(b.pin, 400) : '',
    start: isDate(b.start) ? b.start : '',
    end: isDate(b.end) ? b.end : '',
    time: /^\d{2}:\d{2}$/.test(b.time) ? b.time : '',
    passengers: int(b.passengers, 1, 11),
    bags: int(b.bags, 0, 30),
    vehicle: str(b.vehicle, 40),
    name: str(b.name, 80),
    phone: str(b.phone, 20).replace(/[^\d+]/g, ''),
    notes: str(b.notes, 1000),
    lang: b.lang === 'bn' ? 'bn' : 'en',
    source: str(b.source, 40) || 'direct',
    device: b.device === 'mobile' ? 'mobile' : 'desktop',
  };
  if (!q.from || !q.to || !q.start || q.phone.length < 10) {
    return res.status(400).json({ error: 'Missing pickup, destination, date or phone.' });
  }

  const now = new Date().toISOString();
  const id = Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
  const record = { id, createdAt: now, updatedAt: now, status: 'new', quotedPrice: '', adminNotes: '', firstReplyAt: '', history: [{ status: 'new', at: now }], ...q };

  await redis([['SET', `quote:${id}`, JSON.stringify(record)], ['ZADD', 'quotes', Date.now(), id]]);
  return res.status(201).json({ ok: true, id });
}

async function list(req, res) {
  const [ids] = await redis([['ZREVRANGE', 'quotes', 0, MAX_LIST - 1]]);
  if (!ids || !ids.length) return res.status(200).json({ quotes: [] });
  const [rows] = await redis([['MGET', ...ids.map((id) => `quote:${id}`)]]);
  const quotes = rows.filter(Boolean).map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
  return res.status(200).json({ quotes });
}

async function patch(req, res) {
  const id = str(req.query.id, 40);
  const [raw] = await redis([['GET', `quote:${id}`]]);
  if (!raw) return res.status(404).json({ error: 'Request not found.' });
  const q = JSON.parse(raw);
  const b = body(req);
  const now = new Date().toISOString();

  if (b.status !== undefined && STATUSES.includes(b.status) && b.status !== q.status) {
    q.status = b.status;
    q.history = [...(q.history || []), { status: b.status, at: now }].slice(-30);
    if (!q.firstReplyAt && b.status !== 'new') q.firstReplyAt = now;
  }
  if (b.quotedPrice !== undefined) q.quotedPrice = str(String(b.quotedPrice), 20).replace(/[^\d.,]/g, '');
  if (b.adminNotes !== undefined) q.adminNotes = str(b.adminNotes, 2000);
  q.updatedAt = now;

  await redis([['SET', `quote:${id}`, JSON.stringify(q)]]);
  return res.status(200).json({ quote: q });
}

async function remove(req, res) {
  const id = str(req.query.id, 40);
  await redis([['DEL', `quote:${id}`], ['ZREM', 'quotes', id]]);
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!DB_URL || !DB_TOKEN) {
    return res.status(500).json({ error: 'Database not connected. In Vercel, add Upstash Redis under Storage and redeploy.' });
  }
  try {
    if (req.method === 'POST') return await create(req, res);
    if (!authed(req)) return res.status(401).json({ error: 'Wrong password.' });
    if (req.method === 'GET') return await list(req, res);
    if (req.method === 'PATCH') return await patch(req, res);
    if (req.method === 'DELETE') return await remove(req, res);
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
}
