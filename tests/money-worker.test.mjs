import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { WriteOutbox } from '../src/worker.mjs';
import { WriteOutbox as RecoveredOutbox } from '../recovered/worker/ui-wrapper.mjs';

function assetEnv(content, status = 200) {
  return { ASSETS: { fetch: async () => new Response(content, { status, headers: {
    'Content-Type': 'text/css', ETag: 'synthetic-etag', 'Content-Length': String(content.length)
  } }) } };
}

test('new Worker appends CSS and client over the recovered wrapper', async () => {
  const style = await worker.fetch(new Request('https://example.invalid/css/app.css'), assetEnv('/* synthetic base */'), {});
  const css = await style.text();
  assert.ok(css.startsWith('/* synthetic base */'));
  assert.match(css, /rpa-bank-settings/);
  assert.match(css, /--rpa-money-size/);
  assert.equal(style.headers.get('X-RPA-Money-Layout'), 'single-line-v1');
  assert.equal(style.headers.get('ETag'), null);
  assert.equal(style.headers.get('Content-Length'), null);
  const script = await worker.fetch(new Request('https://example.invalid/js/app.js'), assetEnv('init();'), {});
  assert.match(await script.text(), /^init\(\);\n;\n[\s\S]*RpaMoneyLayout/);
  assert.equal(WriteOutbox, RecoveredOutbox);
});

test('new Worker keeps HEAD empty and does not alter unrelated or failed assets', async () => {
  const head = await worker.fetch(new Request('https://example.invalid/css/app.css', { method: 'HEAD' }), assetEnv('/* base */'), {});
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('X-RPA-Money-Layout'), 'single-line-v1');
  const missing = await worker.fetch(new Request('https://example.invalid/js/app.js'), assetEnv('missing', 404), {});
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), 'missing');
  assert.equal(missing.headers.get('X-RPA-Money-Layout'), null);
  const html = await worker.fetch(new Request('https://example.invalid/'), assetEnv('<h1>Base asset</h1>'), {});
  assert.equal(await html.text(), '<h1>Base asset</h1>');
  assert.equal(html.headers.get('ETag'), 'synthetic-etag');
});
