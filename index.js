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

function renderHTML(products, displayMode) {
    const rows = products.map(p => {
        return `<tr>
            <td>${p.id}</td>
            <td><input type="text" name="check1_${p.id}" value="${p.check1}" /></td>
            <td><input type="text" name="check2_${p.id}" value="${p.check2}" /></td>
            <td><input type="text" name="w_${p.id}" value="${p.w}" /></td>
            <td><input type="text" name="profit_${p.id}" value="${p.profit}" /></td>
            <td><input type="text" name="day_${p.id}" value="${p.day}" />/<input type="text" name="month_${p.id}" value="${p.month}" />/<input type="text" name="year_${p.id}" value="${p.year}" /></td>
            <td><input type="checkbox" name="edit[]" value="${p.id}" /></td>
            <td><input type="checkbox" name="upload[]" value="${p.id}" /></td>
            <td><input type="checkbox" name="delete[]" value="${p.id}" /></td>
        </tr>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Price Table</title></head>
<body>
    <h2>ตารางราคาสินค้า (Display: ${displayMode})</h2>
    <form method="POST">
        <table border="1" cellpadding="5">
            <tr>
                <th>ID</th><th>Check1</th><th>Check2</th><th>น้ำหนัก</th><th>กำไร</th><th>วันปิด</th><th>Edit</th><th>Upload</th><th>Delete</th>
            </tr>
            ${rows}
        </table>
        <br>
        <button type="submit">บันทึก</button>
    </form>
</body></html>`;
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let products = loadProducts();
    const displayMode = parsedUrl.query.display_mode || 'new-and-Edited';

    if (req.method === 'POST') {
        const post = await parsePostData(req);

        if (post.edit) {
            for (const id of post.edit) {
                const p = products.find(p => p.id == id);
                if (!p) continue;
                p.check1 = post[`check1_${id}`] || p.check1;
                p.check2 = post[`check2_${id}`] || p.check2;
                p.w = post[`w_${id}`] || p.w;
                p.profit = post[`profit_${id}`] || p.profit;
                p.day = post[`day_${id}`] || p.day;
                p.month = post[`month_${id}`] || p.month;
                p.year = post[`year_${id}`] || p.year;
            }
        }

        if (post.upload) {
            for (const id of post.upload) {
                const p = products.find(p => p.id == id);
                if (p) p.status = 'Uploaded';
            }
        }

        if (post.delete) {
            products = products.filter(p => !post.delete.includes(p.id.toString()));
        }

        saveProducts(products);
        res.writeHead(302, { Location: '/' });
        res.end();
        return;
    }

    let filtered = products;
    if (displayMode !== 'all') {
        filtered = products.filter(p => p.status === displayMode);
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(renderHTML(filtered, displayMode));
});

server.listen(PORT, () => {
    console.log(`📦 Server running at http://localhost:${PORT}`);
});
