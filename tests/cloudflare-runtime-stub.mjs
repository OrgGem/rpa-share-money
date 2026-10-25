// Only an import shim for local tests. It does not emulate Durable Object storage.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cloudflare:workers') {
      return { url: 'data:text/javascript,export class DurableObject {}', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
});
