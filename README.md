# point-of-sale.dev

The website of the @point-of-sale/ libraries, at https://point-of-sale.dev and https://point-of-sale.app, deployed as a Cloudflare Worker.

The Worker does two things:

- It serves the static pages of the site from `public/`. Cloudflare answers those at the edge, the Worker script never runs for them.
- It puts the apps, each deployed on its own, under a path of this domain. The script in `worker/index.js` strips the path prefix and hands the request to the app, so every app is built as if it lived at the root of a domain.

| Path | App | Reached over |
| --- | --- | --- |
| `/receipt-printer/playground/` | [ReceiptPrinterPlayground](https://github.com/at-point-of-sale/ReceiptPrinterPlayground) | the Pages project, `receipt-printer-playground.pages.dev` |
| `/barcode-scanner/playground/` | [BarcodeScannerPlayground](https://github.com/at-point-of-sale/BarcodeScannerPlayground) | the Pages project, `barcode-scanner-playground.pages.dev` |

An app is reached in one of two ways, chosen per row in the table at the top of `worker/index.js`:

- **`origin`**: a public hostname the Worker fetches, such as a Pages project. This is how both playgrounds are reached today.
- **`binding`**: a service binding to a Worker of the app's own, declared in `wrangler.toml`. The app then needs no hostname. The playgrounds and the font editor each have a `wrangler.toml` for this, and move over once the npm packages they depend on are released: deploy the app with `npm run deploy` in its repository, add the binding to `wrangler.toml` here, and switch the row from `origin` to `binding`. The deploy of the website fails if a binding names a Worker that does not exist yet, which is why the bindings come after the apps.

To add an app, deploy it somewhere, add a row, and if it is a Worker, a binding.

## Developing

```
npm install
npm run dev
```

The website runs on http://localhost:8787 and the apps come from their live origins. `npm run dev:apps` is for apps reached over a binding: it builds the three apps from the sibling checkouts (`../ReceiptPrinterPlayground` and so on) and runs each as a wrangler dev process next to the website, so the bindings connect locally.

## Deploying

Pushes to `main` deploy the Worker, through the repository connected to it in the Cloudflare dashboard. `npm run deploy` deploys the checkout by hand.

## Moving from Cloudflare Pages

Until September 2026 the site was the Pages project `point-of-sale-website`, and a hand-configured Worker, `point-of-sale-proxy`, fetched the playgrounds from their `pages.dev` hostnames on two routes of the zone. This Worker replaces both; the playgrounds stay on Pages for now. In this order, in the Cloudflare dashboard unless noted:

1. Push this repository to GitHub.
2. Workers & Pages, Create, Import a repository: pick `at-point-of-sale/PointOfSale`. The Worker name is `point-of-sale-website`, from `wrangler.toml`; leave the build command empty and the deploy command at `npx wrangler deploy`. Do not start the first deploy yet, or let it fail: it cannot create the custom domains while the Pages project holds them.
3. Workers & Pages, the Pages project `point-of-sale-website`, Custom domains: remove `point-of-sale.dev` and `point-of-sale.app`. This deletes the DNS records the Pages project owns. The site is down from here.
4. Deploy the Worker: retry the build, or `npm run deploy` from a checkout. Wrangler creates the custom domains, their DNS records and certificates. The site is back, a minute or two after step 3.
5. Workers & Pages, the Worker `point-of-sale-proxy`: delete it, which removes its two routes. Until then those routes, being more specific than the custom domain, keep serving the playground paths through the old proxy, which works the same.
6. Delete the Pages project `point-of-sale-website`.

The playgrounds' Pages projects keep deploying on their own pushes, unchanged.
