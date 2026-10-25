import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import worker from '../recovered/worker/ui-wrapper.mjs';
import { createBankProfileHandlers, filterAuthorizedDebtNotes } from '../recovered/worker/bank-profile.mjs';

const actorId = '00000000-0000-4000-8000-000000000001';
const ownerId = '00000000-0000-4000-8000-000000000002';
const noteId = '00000000-0000-4000-8000-000000000003';
const actor = { id: actorId, active: true };
const note = {
  id: noteId, revision: 1, date: '2026-01-05', payerId: ownerId,
  allocations: [{ userId: actorId, amount: 1200, paid: false }]
};
const data = notes => ({ user: actor, users: [{ id: ownerId, active: true }], notes });

test('creditor notes honor the latest revision, deletion and selected dates', () => {
  const current = { ...note, revision: 2, allocations: [{ userId: actorId, amount: 2400, paid: false }] };
  const filter = notes => filterAuthorizedDebtNotes(data(notes), actor, '2026-01-01', '2026-01-31', ownerId);
  assert.deepEqual(filter([note, current]), [current]);
  assert.deepEqual(filter([note, { ...current, deleted: true }]), []);
  assert.deepEqual(filterAuthorizedDebtNotes(data([note]), actor, '2026-02-01', '2026-02-28', ownerId), []);
  assert.throws(() => filter([note, { ...note, allocations: [] }]), /UPSTREAM_INVALID/);
});

test('bank profile rejects cross-account transport and revision conflicts', async () => {
  let record = null;
  const bucket = {
    async get() { return record ? { size: JSON.stringify(record).length, etag: 'synthetic-etag', text: async () => JSON.stringify(record) } : null; },
    async put(key, value, options) {
      assert.equal(key, `rpa_qr/${actorId}.json`);
      assert.equal(options.onlyIf.get('If-None-Match'), '*');
      record = JSON.parse(value);
      return { etag: 'synthetic-etag' };
    }
  };
  const handlers = createBankProfileHandlers({
    requireSession: () => 'synthetic-session', requireMutation: async () => {},
    readJsonObject: request => request.json(), freshQueueActor: async () => actor,
    callGas: async () => { throw new Error('Unexpected upstream call'); }
  });
  function context(method, transportActor = actorId, body) {
    const url = new URL('https://example.invalid/api/bank-profile');
    return { url, requestId: 'synthetic-request', env: { BANK_PROFILES: bucket, BANK_PROFILE_SCOPE: 'example-bank-profile-scope-v1' },
      request: new Request(url, { method, headers: { 'X-RPA-Actor': transportActor, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }) };
  }
  assert.equal((await handlers.own(context('GET', ownerId))).status, 403);
  const draft = { bankBin: '970436', accountNumber: 'DEMO123', expectedRevision: 0 };
  const saved = await handlers.own(context('PUT', actorId, draft));
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).data.revision, 1);
  assert.equal((await handlers.own(context('PUT', actorId, draft))).status, 409);
  assert.equal(record.accountName, undefined);
});

test('wrapper appends decoded extensions only when the base asset contract matches', async () => {
  const base = 'const row = `${displayName(a.userId)} <b>${money(a.amount)}</b> `;\nconst header = `<div><div class="money">${money(n.total)}</div>`;\ninit();';
  const seen = [];
  const env = { ASSETS: { fetch: async request => {
    seen.push(request);
    return new Response(base, { headers: { ETag: 'synthetic-etag', 'Content-Type': 'application/javascript' } });
  } } };
  const result = await worker.fetch(new Request('https://example.invalid/js/app.js', { headers: { 'If-None-Match': 'synthetic-etag' } }), env, {});
  const body = await result.text();
  assert.match(body, /person-details/);
  assert.match(body, /RpaBankQr/);
  assert.ok(body.endsWith('\ninit();\n'));
  assert.equal(result.headers.get('etag'), null);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(seen[0].headers.get('if-none-match'), null);
  env.ASSETS.fetch = async () => new Response('unexpected base asset', { headers: { ETag: 'synthetic-etag' } });
  const incompatible = await worker.fetch(new Request('https://example.invalid/js/app.js'), env, {});
  assert.equal(await incompatible.text(), 'unexpected base asset');
  assert.equal(incompatible.headers.get('etag'), 'synthetic-etag');
});

test('gateway and wrapper route API errors and static assets without a live backend', async () => {
  const response = await worker.fetch(new Request('https://example.invalid/api/nonexistent'), {}, {});
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NOT_FOUND');
  const css = await worker.fetch(new Request('https://example.invalid/css/app.css'), {
    ASSETS: { fetch: async () => new Response('/* synthetic base */') }
  }, {});
  assert.match(await css.text(), /rpa-bank-settings/);
  assert.equal(css.headers.get('cache-control'), 'no-store');
});

test('recovered obligation model counts unpaid shares without netting opposing debts', async () => {
  const code = await readFile(new URL('../recovered/frontend-extensions/obligations.js', import.meta.url), 'utf8');
  const model = code.slice(0, code.indexOf('})();') + 5);
  const context = vm.createContext({});
  vm.runInContext(model, context);
  const result = context.RpaObligationModel.build({ actorId, active: true, notes: [note, {
    ...note, id: 'synthetic-other-note', payerId: actorId,
    allocations: [{ userId: ownerId, amount: 500, paid: false }]
  }], start: '2026-01-01', end: '2026-01-31' });
  assert.equal(result.status, 'ok');
  assert.equal(result.pay.total, '1200');
  assert.equal(result.receive.total, '500');
});

test('embedded QR bundle round-trips a synthetic account and rejects a changed checksum', async () => {
  const code = await readFile(new URL('../recovered/frontend-extensions/bank-qr.bundle.js', import.meta.url), 'utf8');
  const context = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, Uint8ClampedArray });
  vm.runInContext(code, context);
  const qr = context.RpaBankQr;
  const payload = qr.buildReusablePayload({ bankBin: '970436', accountNumber: 'DEMO123' });
  const parsed = qr.parseBankQr(payload);
  assert.equal(parsed.accountNumber, 'DEMO123');
  assert.equal(parsed.hasTransactionData, false);
  assert.equal(parsed.nameVerified, false);
  const changed = payload.slice(0, -1) + (payload.endsWith('0') ? '1' : '0');
  assert.throws(() => qr.parseBankQr(changed));
});
