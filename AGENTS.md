# MMM-BracketEngine

A [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror) module that renders a
mirrored knockout tournament bracket. See `README.md` for module config, the data
schema, and provider details.

## Cursor Cloud specific instructions

This repo is a MagicMirror² *module*, not a standalone app. It has no server or
database of its own — the frontend (`MMM-BracketEngine.js`) and backend
(`node_helper.js`) only run inside a MagicMirror² host, communicating over
MagicMirror's socket bus. Providers (`providers/`) normalize data into the schema in
`schemas/bracket.js`; the `static` provider (`data/placeholder-bracket.json`) gives a
fully offline path, while the `fifa` provider needs outbound HTTPS to `api.fifa.com`.

### Lint / test / run

- Install deps: `npm install` (only dep is `node-fetch`; handled by the update script).
- Test: `npm test` — runs `test/validate.js`, a schema smoke test. No lint tooling is
  configured in this repo.

### Running end-to-end (rendering the bracket)

The module cannot render on its own; it must be loaded by a MagicMirror² host. A host
is pre-installed at `~/MagicMirror` (v2.37.0) and the module is symlinked into it at
`~/MagicMirror/modules/MMM-BracketEngine -> /workspace`. Non-obvious caveats:

- **Node version**: MagicMirror requires Node `>=22.21.1 <23 || >=24`. The default
  `node` on `PATH` (`/exec-daemon/node`) is v22.14 and is too old. Use the nvm build
  (v22.22.2) and prepend it to `PATH` before running the host:
  ```bash
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
  export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
  ```
  Note: `nvm use` alone is not enough because `/exec-daemon` comes first on `PATH`.
  The module's own `npm install`/`npm test` work fine on the default Node.
- **Run headless**: use server-only mode (no Electron/display needed):
  `cd ~/MagicMirror && npm run server`, then open `http://localhost:8080`.
  Electron was installed with `ELECTRON_SKIP_BINARY_DOWNLOAD=1`, so the GUI
  `npm start` will not work — only `npm run server` is usable here.
- **Host config**: `~/MagicMirror/config/config.js` is set to load this module with
  the `static` provider and `ipWhitelist: []` (allow all) so the page is viewable in
  the VM browser. Loading the page triggers a `BE_GET_BRACKET` socket note → provider
  fetch → schema validation → `BE_BRACKET_RESULT` → the bracket renders.
- If you change module code, restart the host (`npm run server`) and reload the
  browser — there is no hot reload.
