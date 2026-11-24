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

### Compile and Minify for Production

```sh
npm run build
```
