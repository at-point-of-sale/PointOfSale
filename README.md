# point-of-sale.dev

The website of the @point-of-sale/ libraries, at https://point-of-sale.dev and https://point-of-sale.app, deployed as a Cloudflare Worker.

The Worker does two things:

- It serves the static pages of the site from `public/`. Cloudflare answers those at the edge, the Worker script never runs for them.
- It puts the apps, each a Worker of its own deployed from its own repository, under a path of this domain. The script in `worker/index.js` strips the path prefix and hands the request to the app over a service binding, so every app is built as if it lived at the root of a domain and needs no hostname of its own.

| Path | App | Worker |
| --- | --- | --- |
| `/receipt-printer/playground/` | [ReceiptPrinterPlayground](https://github.com/at-point-of-sale/ReceiptPrinterPlayground) | `receipt-printer-playground` |
| `/receipt-printer/font-editor/` | [ReceiptPrinterFontEditor](https://github.com/at-point-of-sale/ReceiptPrinterFontEditor) | `receipt-printer-font-editor` |
| `/barcode-scanner/playground/` | [BarcodeScannerPlayground](https://github.com/at-point-of-sale/BarcodeScannerPlayground) | `barcode-scanner-playground` |

The apps are listed in two places: the bindings in `wrangler.toml` and the table at the top of `worker/index.js`. To add an app, deploy it as a Worker with static assets (copy the `wrangler.toml` of one of the playgrounds), add a binding and a row, and link to it from `public/index.html`.

## Developing

```
npm install
npm run dev
```

This builds the three apps from the sibling checkouts (`../ReceiptPrinterPlayground` and so on) and runs the website on http://localhost:8787 with the apps next to it, each a wrangler dev process of its own on its own port, so the paths above work locally. `npm run dev:site` runs the website alone; the paths of the apps then answer with an error from the unconnected bindings.

## Deploying

```
npm run deploy
```

Pushes to `main` deploy automatically once the repository is connected to the Worker in the Cloudflare dashboard (Workers & Pages, the `point-of-sale-website` Worker, Settings, Build) with `npx wrangler deploy` as the deploy command; the build has no separate step. Each app deploys the same way from its own repository, with `npm run deploy` as the deploy command since an app builds first, and the website needs no redeploy when an app changes.

## Moving from Cloudflare Pages

Until September 2026 the site was the Pages project `point-of-sale-website`, the playgrounds were Pages projects of their own, and a hand-configured Worker, `point-of-sale-proxy`, fetched the playgrounds from their `pages.dev` hostnames on two routes of the zone. The move, in this order:

1. Deploy the apps, each from its own repository: `npm run deploy` in ReceiptPrinterPlayground, BarcodeScannerPlayground and ReceiptPrinterFontEditor. The website's service bindings need these Workers to exist.
2. In the Cloudflare dashboard, remove the custom domains `point-of-sale.dev` and `point-of-sale.app` from the Pages project `point-of-sale-website`. This deletes the DNS records the Pages project owns; a Worker custom domain cannot be created while another record holds the name.
3. `npm run deploy` here. Wrangler creates the custom domains, their DNS records and certificates.
4. Delete the `point-of-sale-proxy` Worker, which removes its two routes, and the three Pages projects.
5. Connect the repositories to their Workers in the dashboard for automatic deploys. That works for the website and for BarcodeScannerPlayground today. ReceiptPrinterPlayground depends on the encoder at 4.0.0, the renderer and receiptline, none of which is on npm yet and all of which its checkout takes through `npm link`; ReceiptPrinterFontEditor takes the encoder and the renderer as `file:` checkouts. A build on Cloudflare cannot install either, so those two deploy from a machine that has the checkouts, with `npm run deploy`, until the packages are published.

Between steps 2 and 3 the site is unreachable, which takes about a minute.
