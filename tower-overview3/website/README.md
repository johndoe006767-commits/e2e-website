# Tower overview 3

Double-click `../Start Local.command` on macOS or `../Start Local.bat` on Windows.
Python 3 is required. The launcher opens http://127.0.0.1:3103/ in your browser. If that port is busy, it selects the next available port automatically.
Keep its terminal window open; press Control+C to stop the server.

## Files

- `dist/`: the complete editable website, including HTML, CSS, JavaScript, required assets, data, and licenses. Local preview and Sites use these same files.
- `scripts/serve.py`: the local HTTP server and browser launcher.
- `scripts/o2c-map/extract.mjs`: regenerates `dist/data/maps/o2c.json` (the O2C process-map journey) from the manager's map HTML at the repo root. Run `node scripts/o2c-map/extract.mjs`, then `--check`.
- `scripts/qa/shoot.mjs`: headless-Chrome screenshots and checks.
- `.openai/hosting.json`: Sites hosting configuration.

No build, npm install, or external project folder is required. Edit the files in `dist/` directly.
All included asset and library licenses must remain with the website.

## Local command

From this `website` folder:

```sh
python3 scripts/serve.py
```

Use `--port 8080` to select a different port, or `--no-browser` to serve without opening a browser.

## Sites

Use this `website` folder as the source/project directory. Publish `dist/` as the static directory with no build command.
The existing Sites project ID is preserved in `.openai/hosting.json`.
The folder cleanup did not change or redeploy any hosted site.

The anatomy and process content are illustrative. Attribution is in `dist/licenses/`, `dist/assets/BRAIN-LICENSE.txt`, `dist/assets/organs/LICENSE.txt`, and `dist/vendor/THREE-LICENSE.txt`.
