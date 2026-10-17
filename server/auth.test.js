// Password gate: in-memory db, mock coach, pinned clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { COOKIE, SESSION_DAYS } from './auth.js';

function setup({ password = 'sésame', clientDir = null } = {}) {
  let now = new Date(2026, 9, 17, 9, 0, 0);
  const app = createApp({ db: openDb(':memory:'), clock: () => now, hasKey: false, password, sessionSecret: '', clientDir });
  let cookie = null;
  const call = async (method, path, json, headers = {}) => {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body, set, headers: res.headers };
  };
  return {
    get: (p, h) => call('GET', p, undefined, h),
    post: (p, j, h) => call('POST', p, j, h),
    forget: () => { cookie = null; },
    setCookie: (c) => { cookie = c; },
    cookie: () => cookie,
    advance: (days) => { now = new Date(now.getTime() + days * 86400_000); },
  };
}

test('no password: the API stays open', async () => {
  const api = setup({ password: '' });
  assert.equal((await api.get('/api/state')).status, 200);
  assert.equal((await api.get('/api/state')).body.auth, false);
  assert.deepEqual((await api.get('/api/session')).body, { required: false, authenticated: true });
});

test('password: API locked until login, public routes stay open', async () => {
  const api = setup();
  assert.equal((await api.get('/api/state')).status, 401);
  assert.equal((await api.post('/api/goals/analyze', { prompt: 'x' })).status, 401);
  assert.equal((await api.get('/api/health')).status, 200);
  assert.deepEqual((await api.get('/api/session')).body, { required: true, authenticated: false });
});

test('wrong password refused, right one sets an HttpOnly session cookie', async () => {
  const api = setup();
  const bad = await api.post('/api/login', { password: 'nope' });
  assert.equal(bad.status, 401);
  assert.equal(bad.set, null);
  assert.equal((await api.post('/api/login', {})).status, 401);

  const ok = await api.post('/api/login', { password: 'sésame' });
  assert.equal(ok.status, 200);
  assert.match(ok.set, new RegExp(`^${COOKIE}=`));
  assert.match(ok.set, /HttpOnly/);
  assert.match(ok.set, /SameSite=Lax/);
  assert.doesNotMatch(ok.set, /Secure/);
  const state = await api.get('/api/state');
  assert.equal(state.status, 200);
  assert.equal(state.body.auth, true);
  assert.deepEqual((await api.get('/api/session')).body, { required: true, authenticated: true });
});

test('cookie is Secure behind an HTTPS proxy', async () => {
  const api = setup();
  const ok = await api.post('/api/login', { password: 'sésame' }, { 'x-forwarded-proto': 'https' });
  assert.match(ok.set, /Secure/);
});

test('forged or tampered cookies are refused', async () => {
  const api = setup();
  await api.post('/api/login', { password: 'sésame' });
  const [name, value] = api.cookie().split('=');
  const [exp, mac] = value.split('.');
  for (const v of [`${Number(exp) + 1}.${mac}`, `${exp}.${mac.slice(0, -2)}xx`, 'garbage', `${exp}.`]) {
    api.setCookie(`${name}=${v}`);
    assert.equal((await api.get('/api/state')).status, 401, v);
  }
});

test('session expires after SESSION_DAYS, logout clears it', async () => {
  const api = setup();
  await api.post('/api/login', { password: 'sésame' });
  api.advance(SESSION_DAYS - 1);
  assert.equal((await api.get('/api/state')).status, 200);
  api.advance(2);
  assert.equal((await api.get('/api/state')).status, 401);

  await api.post('/api/login', { password: 'sésame' });
  const out = await api.post('/api/logout');
  assert.match(out.set, /Max-Age=0/);
  assert.equal((await api.get('/api/state')).status, 401);
});

test('changing the password invalidates existing sessions', async () => {
  const a = setup({ password: 'one' });
  await a.post('/api/login', { password: 'one' });
  const b = setup({ password: 'two' });
  b.setCookie(a.cookie());
  assert.equal((await b.get('/api/state')).status, 401);
});

test('too many failures lock the client out for a while', async () => {
  const api = setup();
  const ip = { 'x-forwarded-for': '203.0.113.9' };
  for (let i = 0; i < 10; i++) assert.equal((await api.post('/api/login', { password: 'x' }, ip)).status, 401);
  assert.equal((await api.post('/api/login', { password: 'sésame' }, ip)).status, 429);
  // Another client is not affected; the lock lifts after the window.
  assert.equal((await api.post('/api/login', { password: 'sésame' }, { 'x-forwarded-for': '203.0.113.10' })).status, 200);
  api.advance(1 / 96 + 0.001);
  assert.equal((await api.post('/api/login', { password: 'sésame' }, ip)).status, 200);
});

test('built client served with SPA fallback; unknown API routes stay JSON 404', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'beynd-dist-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>BEYND</title>');
  writeFileSync(join(dir, 'assets', 'app-abc.js'), 'console.log(1)');
  const api = setup({ clientDir: dir });

  const page = await api.get('/');
  assert.equal(page.status, 200);
  assert.match(page.body, /BEYND/);
  assert.equal(page.headers.get('cache-control'), 'no-cache');
  const deep = await api.get('/goals/12');
  assert.match(deep.body, /BEYND/);
  const asset = await api.get('/assets/app-abc.js');
  assert.match(asset.headers.get('cache-control'), /immutable/);

  await api.post('/api/login', { password: 'sésame' });
  const missing = await api.get('/api/nope');
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.body, { error: 'not found' });
});
