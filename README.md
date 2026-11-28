# Campus Resource Hub

The Vue workspace supports campus maintenance reporting, review, assignments, buildings and user administration. Sign in with an existing campus account. Administrators can open the bundled API results viewer at `/qa/results`. See the [Phase 2 implementation and verification report](PHASE-2.md) for portal routes, permissions and test results.

Start the configured Express API with `node server/index.js` and the frontend with `npm run dev`. Vite proxies `/api` to loopback port 3000. Set `CAMPUS_API_ORIGIN` to use another local API. For deployment, serve the built `dist` files with HTML history fallback and forward `/api` to Express on the same origin.

Run `npm test` for database-independent checks. The [server guide](server/README.md) explains isolated MariaDB setup for `npm run test:api`. With the same test database environment variables, run `npm run test:ui` to build the frontend and exercise the browser workflow. Set `CHROMIUM_PATH` to an installed Chromium or Chrome executable when using a system browser. Set `UI_SCREENSHOTS` to an existing directory to save the coordinator and technician views.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### QR maintenance labels

Set `CMS_PUBLIC_BASE_URL` in `server/.env` to the frontend origin and restart the API. The origin must contain only a scheme, host and optional port. Label generation requires this setting. Existing tokens remain stable when the origin changes.

For a phone test, use a trusted private network and a disposable campus member account. First configure XAMPP MariaDB with `bind-address=127.0.0.1` under `[mysqld]`, restart MariaDB during an authorized maintenance window, and verify the port 3306 listener is loopback-only. Keep Express on loopback. Build the frontend with `npm run build`, then run `npm run preview -- --host <PC-private-IPv4> --port 4173 --strictPort`. Set the label origin to `http://<PC-private-IPv4>:4173` or an authorized HTTPS origin. Restrict frontend access to your test device on the private network. The preview server proxies `/api` to local Express. Use trusted HTTPS for real university credentials.

In the administrator portal, open **QR labels**, select resources and generate labels. Print the sheet or download individual PNGs. Use the phone camera to open a label, sign in and submit a report. Development labels carry a visible development mark. For Phase 3.8, configure the permanent HTTPS origin, set `NODE_ENV=production`, restart the API and generate the labels again. Reprinting preserves active tokens. Replace physical development labels because printed URLs retain the original host. [Implementation and verification](PHASE-3.4.md)

### Compile and Minify for Production

```sh
npm run build
```
