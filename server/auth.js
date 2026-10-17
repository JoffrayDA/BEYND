// Optional password gate, so the app can be put online. APP_PASSWORD unset →
// everything stays open (local dev). Set → every /api route but the public
// ones needs a session cookie, obtained by POST /api/login.
//
// The cookie holds `<expiry ms>.<HMAC(secret, expiry)>`: nothing stored
// server-side. The secret is SESSION_SECRET, or derived from the password,
// so changing the password logs every device out.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

export const COOKIE = 'beynd_session';
export const SESSION_DAYS = 30;
const MAX_FAILS = 10;                    // per client, per window
const MAX_FAILS_ALL = 50;                // all clients together, backstop
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const PUBLIC = new Set(['/api/health', '/api/session', '/api/login', '/api/logout']);

const sha256 = (s) => createHash('sha256').update(s).digest();
const sign = (secret, exp) => createHmac('sha256', secret).update(`v1.${exp}`).digest('base64url');

// Constant-time string comparison (hashing first evens out the lengths).
const same = (a, b) => timingSafeEqual(sha256(String(a)), sha256(String(b)));

export function createAuth({ password, secret, clock = () => new Date() } = {}) {
  const enabled = Boolean(password);
  const key = secret || (enabled ? sha256(`beynd-session:${password}`) : null);
  const fails = new Map();               // client → { count, since }

  const valid = (token) => {
    const [exp, mac] = String(token ?? '').split('.');
    if (!exp || !mac || !/^\d+$/.test(exp)) return false;
    return Number(exp) > clock().getTime() && same(mac, sign(key, exp));
  };

  const authenticated = (c) => !enabled || valid(getCookie(c, COOKIE));

  // Behind the Coolify proxy the real client is the last X-Forwarded-For hop
  // (the proxy appends it; earlier hops come from the client and can be forged).
  const clientOf = (c) => c.req.header('x-forwarded-for')?.split(',').at(-1).trim() || 'direct';
  const https = (c) => c.req.header('x-forwarded-proto') === 'https' || new URL(c.req.url).protocol === 'https:';

  const failures = (who) => {
    const f = fails.get(who);
    if (f && clock().getTime() - f.since > FAIL_WINDOW_MS) { fails.delete(who); return 0; }
    return f?.count ?? 0;
  };
  const fail = (who) => {
    const f = fails.get(who);
    if (f && failures(who) > 0) f.count += 1;
    else fails.set(who, { count: 1, since: clock().getTime() });
  };
  const locked = (who) => failures(who) >= MAX_FAILS || failures('*') >= MAX_FAILS_ALL;

  function routes(app) {
    app.get('/api/health', (c) => c.json({ ok: true }));
    app.get('/api/session', (c) => c.json({ required: enabled, authenticated: authenticated(c) }));

    app.post('/api/login', async (c) => {
      if (!enabled) return c.json({ ok: true });
      const who = clientOf(c);
      if (locked(who)) return c.json({ error: 'too many attempts, retry later' }, 429);
      const { password: given } = await c.req.json().catch(() => ({}));
      if (typeof given !== 'string' || !same(given, password)) {
        fail(who);
        fail('*');
        return c.json({ error: 'wrong password' }, 401);
      }
      fails.delete(who);
      const exp = clock().getTime() + SESSION_DAYS * 86400_000;
      setCookie(c, COOKIE, `${exp}.${sign(key, exp)}`, {
        httpOnly: true, sameSite: 'Lax', secure: https(c), path: '/', maxAge: SESSION_DAYS * 86400,
      });
      return c.json({ ok: true });
    });

    app.post('/api/logout', (c) => {
      deleteCookie(c, COOKIE, { path: '/', secure: https(c) });
      return c.json({ ok: true });
    });
  }

  const middleware = async (c, next) => {
    if (PUBLIC.has(c.req.path) || authenticated(c)) return next();
    return c.json({ error: 'auth required' }, 401);
  };

  return { enabled, routes, middleware };
}
