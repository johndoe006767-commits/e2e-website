# GFS merged

Double-click `../Start Local.command` on macOS or `../Start Local.bat` on Windows.
Python 3 is required. The launcher opens http://127.0.0.1:8012/ in your browser. If that port is busy, it selects the next available port automatically.
Keep its terminal window open; press Control+C to stop the server.

## Files

- `dist/`: the complete editable website, including HTML, CSS, JavaScript, required assets, data, and licenses. Local preview and Sites use these same files.
- `scripts/serve.py`: the local HTTP server and browser launcher.
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
This project has not been registered with Sites. When first publishing, register it and save its returned project ID in `.openai/hosting.json`.
The folder cleanup did not change or redeploy any hosted site.

GFS retains its existing externally hosted AstraZeneca logo; its remaining runtime assets are local.
