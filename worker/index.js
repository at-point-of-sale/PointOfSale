/* The point-of-sale.dev website.

   The pages of the site itself are static files in public/, served as Worker
   assets: Cloudflare answers those at the edge and this script never runs
   for them. The script runs for the apps, which are deployed on their own,
   and puts each of them under a path of this domain, so the apps stay at
   the URLs they have always had:

     /receipt-printer/playground/    ReceiptPrinterPlayground
     /receipt-printer/inspector/     ReceiptPrinterPlayground, its second page
     /receipt-printer/font-editor/   ReceiptPrinterFontEditor
     /barcode-scanner/playground/    BarcodeScannerPlayground

   An app is reached in one of two ways. A Pages project, or anything else
   with a public hostname, is fetched over its `origin`. A Worker of its own
   is called over a service `binding`, named in wrangler.toml, which needs
   no hostname. The receipt printer playground is a Worker; the barcode
   scanner playground is a Pages project today, and moves to a Worker, and
   to a binding here, when its npm dependencies are released.

   The prefix is stripped before the request is handed to the app, so every
   app is built and deployed as if it lived at the root of a domain, and the
   apps reference their own files relatively. An app that is a second page
   of another's deployment names that page as its `index`: the bare prefix
   fetches that page rather than the deployment's own index, and everything
   under the prefix is the deployment's files, which both pages share. The
   page is named without its .html, the name the deployment serves it under;
   asked for with the extension it answers a redirect to the name without.
   Anything else that is not a static file is a 404 from the assets
   binding. */

const apps = [
  { prefix: '/receipt-printer/playground', binding: 'RECEIPT_PRINTER_PLAYGROUND' },
  { prefix: '/receipt-printer/inspector', binding: 'RECEIPT_PRINTER_PLAYGROUND', index: '/inspector' },
  { prefix: '/receipt-printer/font-editor', binding: 'RECEIPT_PRINTER_FONT_EDITOR' },
  { prefix: '/barcode-scanner/playground', origin: 'https://barcode-scanner-playground.pages.dev' },
];

function redirect(location) {
  return new Response(null, { status: 301, headers: { Location: location } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    for (const app of apps) {
      /* The website once carried the playgrounds as single pages next to the
         directories the apps live in now; links to those still exist */
      if (url.pathname === app.prefix + '.html') {
        return redirect(app.prefix + '/' + url.search);
      }

      /* The apps reference their files relatively, which only resolves
         inside the directory, so the directory always ends in a slash */
      if (url.pathname === app.prefix) {
        return redirect(app.prefix + '/' + url.search);
      }

      if (url.pathname.startsWith(app.prefix + '/')) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return new Response(`Method ${request.method} not allowed.`, {
            status: 405,
            headers: { Allow: 'GET, HEAD' },
          });
        }

        url.pathname = url.pathname.slice(app.prefix.length);

        /* A second page of a deployment is that page where its prefix alone
           is asked for */
        if (app.index && url.pathname === '/') {
          url.pathname = app.index;
        }

        let response;
        if (app.origin) {
          const target = new URL(url.pathname + url.search, app.origin);
          response = await fetch(new Request(target, request));
        } else {
          response = await env[app.binding].fetch(new Request(url, request));
        }

        /* The app answers a few paths with a redirect, a page asked for with
           its .html or a path that is not in its canonical encoding, and it
           does not know about the prefix, so a redirect to its own origin
           gets the prefix back before it reaches the browser */
        const location = response.headers.get('Location');
        if (location) {
          const target = new URL(location, app.origin ?? url);
          if (target.origin === (app.origin ?? url.origin)) {
            const headers = new Headers(response.headers);
            headers.set('Location', app.prefix + target.pathname + target.search + target.hash);
            return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
          }
        }

        return response;
      }
    }

    return env.ASSETS.fetch(request);
  },
};
