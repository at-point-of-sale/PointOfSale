/* Runs the website on http://localhost:8787 next to the three apps, each a
   wrangler dev process of its own from the sibling checkout, on the ports
   below, for an app that the website reaches over a service binding. An
   app fetched over its origin needs none of this: `npm run dev` alone
   proxies the live pages.dev hostname.

   Separate processes, because wrangler connects service bindings between
   dev processes through its local registry, while a single dev process
   running all four configurations (wrangler dev -c ... -c ...) answers a
   binding to a Worker that is only static assets with the website's own
   assets, in wrangler 4.132 at least. The apps are expected to be built:
   `npm run dev:apps` builds them first. */

import { spawn } from 'node:child_process';

const apps = {
  '../ReceiptPrinterPlayground': 8788,
  '../BarcodeScannerPlayground': 8789,
  '../ReceiptPrinterFontEditor': 8790,
};

const wrangler = (args, stdio) => spawn('npx', ['wrangler', ...args], { stdio });

/* Every dev process also opens an inspector port, and four processes
   starting at once race for the same default, so each gets its own */
const children = Object.entries(apps).map(([directory, port]) =>
  wrangler(['dev', '--config', `${directory}/wrangler.toml`, '--port', String(port), '--inspector-port', String(port + 1000)], ['ignore', 'ignore', 'inherit']),
);

const site = wrangler(['dev', '--port', '8787', '--inspector-port', '9787'], 'inherit');

site.on('exit', (code) => {
  for (const child of children) child.kill();
  process.exit(code ?? 0);
});

process.on('SIGINT', () => site.kill('SIGINT'));
