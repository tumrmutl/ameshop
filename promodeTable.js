// Load product data from JSON file
const fs = require('fs');
const http = require('http');
const path = require('path');
const url = require('url');

const DATA_FILE = path.join(__dirname, 'products.json');
const PORT = 3000;

function loadProducts() {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveProducts(products) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');
}

function parsePostData(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const data = new URLSearchParams(body);
            const result = {};
            for (const [key, value] of data.entries()) {
                if (key.endsWith('[]')) {
                    const realKey = key.slice(0, -2);
                    if (!result[realKey]) result[realKey] = [];
                    result[realKey].push(value);
                } else {
                    result[key] = value;
                }
            }
            resolve(result);
        });
    });
}

function renderHTML(products) {
    const rows = products.map(p => {
        return `<tr>
            <td>${p.id}</td>
            <td>${p.status}</td>
            <td>${p.check1}</td>
            <td>${p.check2}</td>
            <td>${p.mudjum}</td>
            <td>${p.check3}</td>
            <td>${p.profit}</td>
            <td>${p.w}</td>
            <td>${p.day}/${p.month}/${p.year}</td>
            <td>
              <form method="POST">
                <input type="hidden" name="edit[]" value="${p.id}" />
                <button>✔ Promote</button>
              </form>
            </td>
        </tr>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Promote Table</title></head>
<body>
    <h2>🟢 Promote Table</h2>
    <table border="1" cellpadding="5">
        <thead>
          <tr>
            <th>ID</th><th>Status</th><th>Check1</th><th>Check2</th><th>Mudjum</th><th>Check3</th><th>Profit</th><th>Weight</th><th>Deadline</th><th>Promote</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
    </table>
</body></html>`;
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let products = loadProducts();

    if (req.method === 'POST') {
        const post = await parsePostData(req);
        if (post.edit) {
            const idsToRemove = new Set(post.edit.map(id => parseInt(id)));
            products = products.filter(p => !idsToRemove.has(p.id));
            saveProducts(products);
        }
        res.writeHead(302, { Location: '/' });
        res.end();
        return;
    }

    if (parsedUrl.pathname === '/') {
        const promoted = products.filter(p => ['Uploaded', 'Promoted'].includes(p.status));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(renderHTML(promoted));
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`📦 Server running at http://localhost:${PORT}`);
});
