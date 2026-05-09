// little name studio — local server
// Run with:  ANTHROPIC_API_KEY=sk-ant-... node server.js
//
// The browser never sees the API key. The HTML calls /api/messages on this
// server, and this server forwards the request to api.anthropic.com with the
// key attached.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

if (!API_KEY) {
  console.error('ERROR: set the ANTHROPIC_API_KEY environment variable before starting.');
  console.error('       e.g.  ANTHROPIC_API_KEY=sk-ant-... node server.js');
  process.exit(1);
}

const INDEX_PATH = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  // ---- proxy to Anthropic ----
  if (req.method === 'POST' && req.url === '/api/messages') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);

      const upstream = https.request(
        {
          hostname: 'api.anthropic.com',
          path: '/v1/messages',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Length': body.length,
          },
        },
        (apiRes) => {
          console.log(`POST /api/messages → ${apiRes.statusCode}`);
          res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
          apiRes.pipe(res);
        }
      );

      upstream.on('error', (err) => {
        console.error('upstream error:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      });

      upstream.write(body);
      upstream.end();
    });
    return;
  }

  // ---- static: only serve / and /index.html ----
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    fs.readFile(INDEX_PATH, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('could not read index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // ---- everything else ----
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`little name studio → http://localhost:${PORT}`);
  console.log(`  proxy endpoint:    POST /api/messages`);
  console.log(`  api key:           ${API_KEY.slice(0, 10)}…${API_KEY.slice(-4)}`);
});