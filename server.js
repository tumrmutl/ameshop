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

function renderPriceTable(products) {
    const rows = products.map(p => {
        return `<tr>
            <td>${p.id}</td>
            <td>${p.gcode}</td>
            <td>
              <img src="${p.images?.[0] || ''}" alt="${p.name}" />
              ${p.name}
            </td>
            <td>
              <select name="status_${p.id}">
                <option value="new" ${p.status === 'new' ? 'selected' : ''}>new</option>
                <option value="Edited" ${p.status === 'Edited' ? 'selected' : ''}>Edited</option>
                <option value="Uploaded" ${p.status === 'Uploaded' ? 'selected' : ''}>Uploaded</option>
                <option value="Promoted" ${p.status === 'Promoted' ? 'selected' : ''}>Promoted</option>
              </select>
            </td>
            <td><input type="text" name="check1_${p.id}" value="${p.check1 ?? ''}" /></td>
            <td><input type="text" name="check2_${p.id}" value="${p.check2 ?? ''}" /></td>
            <td><input type="text" name="mudjum_${p.id}" value="${p.mudjum ?? ''}" /></td>
            <td><input type="text" name="check3_${p.id}" value="${p.check3 ?? ''}" /></td>
            <td><input type="text" name="profit_${p.id}" value="${p.profit ?? ''}" /></td>
            <td><input type="text" name="w_${p.id}" value="${p.w ?? ''}" /></td>
            <td>
              <input type="text" name="day_${p.id}" value="${p.day ?? ''}" size="2" />/
              <input type="text" name="month_${p.id}" value="${p.month ?? ''}" size="2" />/
              <input type="text" name="year_${p.id}" value="${p.year ?? ''}" size="4" />
            </td>
            <td>
              <input type="checkbox" name="edit[]" value="${p.id}" /> แก้ไข
            </td>
        </tr>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Price Table</title>
<style>
  body { width: 1280px; height: 1024px; margin: 0; overflow: auto; font-family: sans-serif; }
  table { border-collapse: collapse; width: 1280px; table-layout: fixed; }
  th, td { border: 1px solid #000; padding: 4px; font-size: 12px; text-align: center; overflow: hidden; white-space: nowrap; }
  input[type="text"], select { width: 90px; font-size: 12px; }
  input[type="checkbox"] { transform: scale(1.2); }
  img { display: block; width: 60px; height: 60px; object-fit: cover; margin: 0 auto; }
  button { width: 100px; height: 30px; font-size: 14px; }
  form { margin: 0; }
</style>
</head>
<body>
    <h2>📋 Price Table</h2>
    <form method="POST" action="/price">
    <table>
        <thead>
          <tr>
            <th>ID</th><th>GCode</th><th>Name</th><th>Status</th><th>Check1</th><th>Check2</th><th>Mudjum</th><th>Check3</th><th>Profit</th><th>Weight</th><th>Deadline</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
    </table>
    <br><button type="submit">💾 Save Changes</button>
    </form>
    <p><a href="/promote">→ ไปหน้า Promote Table</a></p>
</body></html>`;
}

function renderPromoteTable(products) {
    const rows = products.map(p => {
        return `<tr>
            <td>${p.id}</td>
            <td>${p.gcode}</td>
            <td><img src="${p.images?.[0] || ''}" alt="${p.name}" /><br>${p.name}</td>
            <td>${p.status}</td>
            <td>${p.price}</td>
            <td>${p.maker}</td>
            <td>${p.release}</td>
            <td>
              <form method="POST" action="/promote">
                <input type="hidden" name="edit[]" value="${p.id}" />
                <button>✔ Promote</button>
              </form>
            </td>
        </tr>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Promote Table</title>
<style>
  body { width: 1280px; height: 1024px; margin: 0; overflow: auto; font-family: sans-serif; }
  table { border-collapse: collapse; width: 1280px; table-layout: fixed; }
  th, td { border: 1px solid #000; padding: 4px; font-size: 12px; text-align: center; overflow: hidden; white-space: nowrap; }
  input[type="text"], select { width: 90px; font-size: 12px; }
  input[type="checkbox"] { transform: scale(1.2); }
  img { display: block; width: 60px; height: 60px; object-fit: cover; margin: 0 auto; }
  button { width: 100px; height: 30px; font-size: 14px; }
  form { margin: 0; }
</style>
</head>
<body>
    <h2>🟢 Promote Table</h2>
    <table>
        <thead>
          <tr>
            <th>ID</th><th>GCode</th><th>Name</th><th>Status</th><th>Price</th><th>Maker</th><th>Release</th><th>Promote</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
    </table>
    <p><a href="/price">← กลับไปหน้า Price Table</a></p>
</body></html>`;
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let products = loadProducts();

    if (req.method === 'POST') {
        const post = await parsePostData(req);

        if (parsedUrl.pathname === '/promote' && post.edit) {
            const idsToPromote = new Set(post.edit.map(id => parseInt(id)));
            products = products.filter(p => !idsToPromote.has(p.id));
            saveProducts(products);
            res.writeHead(302, { Location: '/promote' });
            res.end();
            return;
        }

        if (parsedUrl.pathname === '/price' && post.edit) {
            for (const id of post.edit) {
                const p = products.find(p => p.id == id);
                if (p) {
                    p.status = post[`status_${id}`] || p.status;
                    p.check1 = post[`check1_${id}`] || '';
                    p.check2 = post[`check2_${id}`] || '';
                    p.mudjum = post[`mudjum_${id}`] || '';
                    p.check3 = post[`check3_${id}`] || '';
                    p.profit = post[`profit_${id}`] || '';
                    p.w = post[`w_${id}`] || '';
                    p.day = post[`day_${id}`] || '';
                    p.month = post[`month_${id}`] || '';
                    p.year = post[`year_${id}`] || '';
                }
            }
            saveProducts(products);
            res.writeHead(302, { Location: '/price' });
            res.end();
            return;
        }
    }

    if (parsedUrl.pathname === '/') {
        res.writeHead(302, { Location: '/price' });
        res.end();
        return;
    }

    if (parsedUrl.pathname === '/price') {
        const priceItems = products.filter(p => ['new', 'Edited', 'Uploaded'].includes(p.status));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(renderPriceTable(priceItems));
        return;
    }

    if (parsedUrl.pathname === '/promote') {
        const promoteItems = products.filter(p => ['Uploaded', 'Promoted'].includes(p.status));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(renderPromoteTable(promoteItems));
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`📦 Server running at http://localhost:${PORT}`);
});
