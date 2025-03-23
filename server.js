const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, req.url === '/' ? '/index.html' : req.url);
  const ext = path.extname(filePath);
  const map = { '.html': 'text/html', '.json': 'application/json' };

  fs.readFile(filePath, (err, content) => {
    if (err) return res.end('404');
    res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
    res.end(content);
  });
});

server.listen(3000, () => console.log('📦 Server running at http://localhost:3000'));
