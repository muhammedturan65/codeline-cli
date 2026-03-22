import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
export class DebugServer {
    app = express();
    server = http.createServer(this.app);
    io = new Server(this.server);
    port = 6565;
    constructor() {
        this.app.use(express.static(process.cwd()));
        this.app.use(express.json());
        // Agent'ın logları buraya göndermesi için
        this.app.post('/api/logs', (req, res) => {
            this.io.emit('browser_error', req.body);
            res.sendStatus(200);
        });
        // Basit bir debug arayüzü
        this.app.get('/debug', (req, res) => {
            res.send(`
        <html>
          <head><title>Codeline Debug Console</title></head>
          <body style="background:#1a1a1a; color:#00ff00; font-family:monospace; padding:20px;">
            <h1>Codeline Debug Console</h1>
            <div id="logs"></div>
            <script src="/socket.io/socket.io.js"></script>
            <script>
              const socket = io();
              const logs = document.getElementById('logs');
              socket.on('browser_error', (data) => {
                const div = document.createElement('div');
                div.style.borderBottom = "1px solid #333";
                div.style.padding = "10px";
                div.innerHTML = \`<strong>[\${new Date().toLocaleTimeString()}] \${data.type.toUpperCase()}:</strong> \${data.message}\`;
                logs.prepend(div);
              });
            </script>
          </body>
        </html>
      `);
        });
    }
    start() {
        this.server.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                // Port kullanımda ise sadece log düş, uygulamayı kapatma
                // console.warn(`\n[DEBUG] Uyarı: Port ${this.port} kullanımda, debug sunucusu bu oturum için başlatılamadı.`);
            }
            else {
                console.error('Debug Server Error:', e);
            }
        });
        try {
            this.server.listen(this.port, () => {
                // console.log(`\n[DEBUG] Sunucu çalışıyor: http://localhost:${this.port}`);
                // console.log(`[DEBUG] Dosyalarınız burada: http://localhost:${this.port}/index.html`);
                // console.log(`[DEBUG] Hata Konsolu: http://localhost:${this.port}/debug\n`);
            });
        }
        catch (e) {
            // Catching potential sync errors
        }
    }
    // HTML dosyalarına inject edilecek script
    getInjectionScript() {
        return `
      <script>
        (function() {
          const originalError = console.error;
          console.error = function() {
            fetch('http://localhost:6565/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'error', message: Array.from(arguments).join(' ') })
            });
            originalError.apply(console, arguments);
          };
          window.onerror = function(msg, url, line) {
            fetch('http://localhost:6565/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'runtime_error', message: msg + ' at ' + url + ':' + line })
            });
          };
          console.log("Codeline Debug Modu Aktif");
        })();
      </script>
    `;
    }
}
export const debugServer = new DebugServer();
