/* The point-of-sale.dev website.

   The pages of the site itself are static files in public/, served as Worker
   assets: Cloudflare answers those at the edge and this script never runs
   for them. The script runs for the apps, which are Workers of their own
   deployed from their own repositories, and puts each of them under a path
   of this domain through a service binding, so the apps stay at the URLs
   they have always had:

     /receipt-printer/playground/    ReceiptPrinterPlayground
     /receipt-printer/font-editor/   ReceiptPrinterFontEditor
     /barcode-scanner/playground/    BarcodeScannerPlayground

   The prefix is stripped before the request is handed to the app, so every
   app is built and deployed as if it lived at the root of a domain, and the
   apps reference their own files relatively. Anything else that is not a
   static file is a 404 from the assets binding. */

const apps = [
  { prefix: '/receipt-printer/playground', binding: 'RECEIPT_PRINTER_PLAYGROUND' },
  { prefix: '/receipt-printer/font-editor', binding: 'RECEIPT_PRINTER_FONT_EDITOR' },
  { prefix: '/barcode-scanner/playground', binding: 'BARCODE_SCANNER_PLAYGROUND' },
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
        const response = await env[app.binding].fetch(new Request(url, request));

        /* The app answers a few paths with a redirect, a page asked for with
           its .html or a path that is not in its canonical encoding, and it
           does not know about the prefix, so a redirect to its own origin
           gets the prefix back before it reaches the browser */
        const location = response.headers.get('Location');
        if (location) {
          const target = new URL(location, url);
          if (target.origin === url.origin) {
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
