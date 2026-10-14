"""Launch the static website with Python 3; no packages or build required."""
import argparse
import errno
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

ROOT = Path(__file__).resolve().parents[1] / "dist"
TITLE = 'Tower overview 3'
DEFAULT_PORT = 3103


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not (ROOT / "index.html").is_file():
        parser.error(f"Website files are missing: {ROOT}")
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    ports = [args.port] if args.port is not None else range(DEFAULT_PORT, DEFAULT_PORT + 20)
    for port in ports:
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), handler)
            break
        except OSError as error:
            if error.errno != errno.EADDRINUSE:
                parser.exit(1, f"Could not start {TITLE}: {error}\n")
    else:
        parser.exit(1, "The local ports are busy. Close the previous launcher window "
                    "or use --port with another port.\n")
    url = f"http://127.0.0.1:{server.server_port}/"
    print(f"{TITLE}: {url}\nKeep this window open. Press Control+C to stop.", flush=True)
    if not args.no_browser:
        timer = threading.Timer(0.5, lambda: webbrowser.open(url))
        timer.daemon = True
        timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
