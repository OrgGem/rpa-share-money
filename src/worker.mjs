// Editable extension over the immutable recovered deployment snapshot.
import recovered from '../recovered/worker/ui-wrapper.mjs';
import { moneyLayoutCss, moneyLayoutClient } from '../.build/money-layout-assets.mjs';

export { WriteOutbox } from '../recovered/worker/ui-wrapper.mjs';

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    const isStyle = path === '/css/app.css';
    const isScript = path === '/js/app.js';
    const response = await recovered.fetch(request, env, ctx);
    if ((!isStyle && !isScript) || !['GET', 'HEAD'].includes(request.method) || response.status !== 200) return response;

    const headers = new Headers(response.headers);
    for (const name of ['Content-Length', 'Content-Encoding', 'ETag', 'Last-Modified']) headers.delete(name);
    headers.set('Cache-Control', 'no-store');
    headers.set('X-RPA-Money-Layout', 'single-line-v1');
    if (request.method === 'HEAD') return new Response(null, { status: response.status, headers });

    const suffix = new TextEncoder().encode(isStyle ? `\n${moneyLayoutCss}\n` : `\n;\n${moneyLayoutClient}\n`);
    // Forward existing asset bytes as a stream and append only our small overlay.
    const body = response.body?.pipeThrough(new TransformStream({
      flush(controller) { controller.enqueue(suffix); }
    })) ?? suffix;
    return new Response(body, { status: response.status, headers });
  }
};
