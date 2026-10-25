# RPA Money — recovered source snapshot

This is a sanitized snapshot of the recoverable RPA money application code. It is **not a complete backup and cannot rebuild the original deployed application on its own**.

Included:
- Cloudflare gateway backend bundle (Apps Script RPC/authentication/cache/outbox integration).
- Editable bank QR/profile service, private R2 adapter, local QR import/generation, filtered debt amounts, loading/file-share UI, presentation labels and regression tests.
- Recovered browser wrapper source: date/calendar, preferences, obligations, QR and label integration.
- Source-only assembly baselines, build scripts and synthetic test fixtures.
- Required third-party license notices.

Missing:
- Original frontend Static Assets, including the base `/js/app.js`, HTML, CSS and other assets.
- Original editable gateway modules before bundling (the recovered gateway is a readable assembled bundle).
- Google Apps Script backend project and its manifest.
- Production data, credentials, deployment identifiers and configuration values.

No operational logs, deployment receipts, uploaded screenshots, real QR payloads, bank profiles, OAuth files or old Git history are included. Account identifiers in tests are synthetic. Bank BIN catalog entries are public routing metadata.

Kiến trúc và giới hạn bằng chứng: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Snapshot includes the latest status capitalization, narrowly scoped personal-summary removal, centered QR close control and Vietnamese amount display.

## Local maintenance

Use Node.js 22 or newer. From `bank-qr/` run:

```sh
npm ci
npm run build
npm run prepare:worker
npm test
npm run test:browser
```

Browser tests need Playwright and Chromium. Install a browser with `npx playwright install chromium`, or set `CHROMIUM_PATH` to an installed Chromium executable. Tests only use synthetic data and mocked services/native sharing. Generated test output is ignored.

`prepare:worker` assembles recovered Worker modules under `bank-qr/candidate/`. Successful assembly/tests do **not** restore the missing frontend assets or Apps Script backend. Obtain those missing components before attempting a complete deployment.

`wrangler.example.jsonc` is illustrative only. Fill in your own configuration and review bindings, Durable Object migrations and the existing GAS contract. Set secret values with your own secret-management workflow. There is no automatic deployment workflow.

Bank profiles remain private, one JSON object per verified UUID. Settings QR has no amount; payment QR derives a fresh filtered amount. File sharing uses a user-selected native chooser where supported, with a local image-download fallback.

Third-party licenses are in `third-party-licenses/` and `bank-qr/vendor/`. No blanket first-party license is added by this export.
