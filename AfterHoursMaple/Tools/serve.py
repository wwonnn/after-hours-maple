"""Serve the Unity Web build on localhost; no installation or internet needed."""
import argparse, functools, http.server, pathlib, socketserver, threading, webbrowser

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8790)
parser.add_argument('--no-open', action='store_true')
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parents[1] / 'Builds/Web'
if not (root / 'index.html').exists():
    raise SystemExit('Web build is missing. Run Build-Web.ps1 first.')

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.wasm': 'application/wasm', '.data': 'application/octet-stream',
                      '.js': 'application/javascript', '.json': 'application/json'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    def log_message(self, fmt, *values):
        if values and str(values[1]) != '200':
            super().log_message(fmt, *values)

class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

url = f'http://127.0.0.1:{args.port}/'
with Server(('127.0.0.1', args.port), functools.partial(Handler, directory=str(root))) as server:
    print(f'After Hours Maple: {url}\nClose this window or press Ctrl+C to stop.', flush=True)
    if not args.no_open:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
