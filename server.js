// Load product data from JSON file
const fs = require('fs');
const http = require('http');
const path = require('path');
const url = require('url');

const DATA_FILE = path.join(__dirname, 'products.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');
const PORT = 3000;

const rateJPY = 0.26 ;
const shipping_cost_per_1kg = 600 ;
const profit = 0 ;

const config = fs.existsSync(CONFIG_FILE)
  ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  : { rateJPY: 0, shipping_cost_per_1kg: 0, profit: 0 };

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
    // อ่าน config ล่าสุดทุกครั้ง
    const configPath = path.join(__dirname, 'config.json');
    const config = fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
        : { rateJPY: 0, shipping_cost_per_1kg: 0, profit: 0 };

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
                <option value="Promoted" ${p.status === 'Promoted' ? 'selected' : ''}>Promoted</option>
                <option value="new" ${p.status === 'new' ? 'selected' : ''}>new</option>
                <option value="Edited" ${p.status === 'Edited' ? 'selected' : ''}>Edited</option>
                <option value="Delete" ${p.status === 'Delete' ? 'selected' : ''}>Delete</option>
              </select>
            </td>
            <td>
              ¥${p.price || 0}<br/>
              <input type="number" name="w_${p.id}" placeholder="น้ำหนัก(kg)" step="0.01" onchange="calcPrice(${p.id})" oninput="calcPrice(${p.id})" value="${p.w ?? ''}" />
              <br /><input type="number" name="profit_${p.id}" placeholder="กำไร(บาท)" onchange="calcPrice(${p.id})" value="${p.profit ?? config.profit}" />
            </td>
            <td><input type="text" name="lotjp_${p.id}" id="lotjp_${p.id}" value="${p.lotjp ?? ''}" /></td>
            <td><input type="text" name="lotagent_${p.id}" value="${p.lotagent ?? ''}" /></td>
            <td><input type="text" name="mudjum_${p.id}" value="${p.mudjum ?? ''}" /></td>
            <td><input type="text" name="close_${p.id}" value="${p.close ?? ''}" /></td>
        </tr>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Price Table</title>
<style>
  body { width: 1280px; height: 1024px; margin: 0; overflow: auto; font-family: sans-serif; }
  table { border-collapse: collapse; width: 1280px; table-layout: fixed; }
  th, td {
    border: 1px solid #000;
    padding: 4px;
    font-size: 12px;
    text-align: center;
    overflow: hidden;
    white-space: nowrap;
  }
  input[type="text"], input[type="number"], select {
    width: 90px;
    font-size: 12px;
  }
  img {
    display: block;
    width: 120px;
    height: 120px;
    object-fit: cover;
    margin: 0 auto;
  }
  button {
    width: 100px;
    height: 30px;
    font-size: 14px;
  }

  /* ✅ ทำให้เฉพาะช่องชื่อสินค้า responsive + ตัดคำ */
  td:nth-child(3) {
    white-space: normal !important;
    word-break: break-word;
    word-wrap: break-word;
    text-align: left;
    vertical-align: top;
  }
</style>

<script>
  const rateJPY = parseFloat("${config.rateJPY || rateJPY}") || 0;
  const shippingCostPerKg = parseFloat("${config.shipping_cost_per_1kg || shipping_cost_per_1kg}") || 0;
  const defaultProfit = parseFloat("${config.profit || profit}") || 0;
  const products = ${JSON.stringify(products.map(p => ({ ...p, price: Number(p.price || 0) })))};


function calcPrice(id) {
  const wEl = document.querySelector("[name='w_" + id + "']");
  const profitEl = document.querySelector("[name='profit_" + id + "']");
  const lotjpEl = document.getElementById("lotjp_" + id);

  const w = wEl ? parseFloat(wEl.value) || 0 : 0;
  const profit = profitEl ? parseFloat(profitEl.value) || defaultProfit : defaultProfit;
  const product = products.find(p => p.id == id || p.id == parseInt(id));

  if (!product || !lotjpEl) return;

  const priceJPY = product.price;
  let result = (priceJPY * rateJPY) + (w * shippingCostPerKg) + profit;

  // 🔧 ปรับหลักท้ายตามเงื่อนไข
  let rounded = Math.ceil(result);
  const lastTwo = rounded % 100;

  if (lastTwo <= 25) {
    rounded = rounded - lastTwo; // ลงท้าย 00
  } else if (lastTwo <= 74) {
    rounded = rounded - lastTwo + 50; // ลงท้าย 50
  } else {
    rounded = rounded - lastTwo + 100; // ปัดขึ้นร้อย
  }

  lotjpEl.value = rounded;
}
</script>
</head>
<body>
    <h2>📋 Price Table [ ${products.length} items ]</h2>
    <form method="POST" action="/price">
    <table>
        <thead>
          <tr>
            <th>ID</th><th>GCode</th><th>Name</th><th>Status</th><th>Price Input</th><th>ล็อตญี่ปุ่น</th><th>ล็อตตัวแทน</th><th>มัดจำ</th><th>ปิดจอง</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
    </table>
    <br><button type="submit">💾 Save</button> &nbsp;&nbsp;&nbsp;&nbsp; <button type="button" onclick="promoteAll()">🟢 Promote</button>
    </form>
    <br /><p><a href="/promote">→ ไปหน้า Promote Table</a></p>
    <script>
  function promoteAll() {
    fetch('/promote-all', { method: 'POST' })
      .then(() => window.location.reload())
      .catch(err => alert("Promote All Failed: " + err));
  }
</script>
</body></html>`;
}

function filterName(name) {
    const keywordsToRemove = [
      "[Goodsmile Online Shop Exclusive]", "Complete", "Exclusive Sale", "Figure",
      "(Pre-order)", '"', "[", "]", "or Later, Already on Sale", "Ships in",
      "AmiAmi Exclusive Bonus", "Exclusive Bonus", "(Released)", "(Provisional Pre-order)",
      "Bonus", "TV Anime", "(Single Shipment)", "COMPLETEEDITION", "1/7", "1/6",
      "1/8", "1/4", "1/12", "1/10", "1/20", "(Pre-owned ITEM:A-/BOX:B)",
      "(Pre-owned ITEM:A/BOX:B)", "(Pre-owned ITEM:A/BOX:A)", "(Pre-owned ITEM:B/BOX:B)",
      "(Pre-owned ITEM:C/BOX:B)", "Half-complete Assembly", "Assemble Heroines",
      "(ANIPLEX+ Exclusive)", "Posable"
    ];
  
    let result = name;
    for (const word of keywordsToRemove) {
      result = result.replaceAll(word, '').trim();
    }
    return result;
  }

function tt( p ) {
    const productName = p.name || '';
    const lotjp = parseFloat(p.lotjp || 0);
    const lotagent = parseFloat(p.lotagent || 0);
    const lotName = lotjp > lotagent ? 'ญี่ปุ่น' : 'ตัวแทนจำหน่าย';
    const price = Math.max(lotjp, lotagent).toLocaleString();
    const mudjum = parseFloat(p.mudjum || 0).toLocaleString();
    const isClose = lotjp > lotagent ? 'จองได้จนกว่ายอดที่ญี่ปุ่นจะเต็ม' : `ปิดจองราคานี้ ${p.close}` ;
    return `
${productName} ราคา  ${price} บาท (มัดจำ ${mudjum} บาท)  ${isClose} #AmeShop
`;
}

function x( p ) {
    const productName = p.name || '';
    const lotjp = parseFloat(p.lotjp || 0);
    const lotagent = parseFloat(p.lotagent || 0);
    const lotName = lotjp > lotagent ? 'ญี่ปุ่น' : 'ตัวแทนจำหน่าย';
    const price = Math.max(lotjp, lotagent).toLocaleString();
    const mudjum = parseFloat(p.mudjum || 0).toLocaleString();
    const isClose = lotjp > lotagent ? 'จองได้จนกว่ายอดที่ญี่ปุ่นจะเต็ม' : `ปิดจองราคานี้ ${p.close}` ;
    return `
${productName}
ราคา  ${price} บาท (มัดจำ ${mudjum} บาท)



${isClose} #AmeShop #MiniMiku  
  `;
}

function fb(p) {
    const productName = p.name || '';
  
    const lotjp = parseFloat(p.lotjp || 0);
    const lotagent = parseFloat(p.lotagent || 0);
  
    const lotName = lotjp > lotagent ? 'ญี่ปุ่น' : 'ตัวแทนจำหน่าย';
    const price = Math.max(lotjp, lotagent).toLocaleString();
    const mudjum = parseFloat(p.mudjum || 0).toLocaleString();

    const isClose = lotjp > lotagent ? 'จองได้จนกว่ายอดที่ญี่ปุ่นจะเต็ม' : `ปิดจองราคานี้ ${p.close}` ;
  
    return `
  ${productName}
  ราคาล๊อต${lotName} : ❤ ${price} บาท (มัดจำ ${mudjum} บาท)
    
  เพจหลัก Ame-Shop ใช้งานไม่ได้ ฝากกดติดตามเพจรอง MiniMiku Shop นี้ให้ด้วยน้า
  ${isClose} 😊 รับโปรส่งฟรีเมื่อชำระเต็มจำนวน
  Tel: 084-0840092 Line: ameshop
  www.ame-shop.com // x.com/AmeshopTh
    
  เข้าร่วมร้านค้าตัวแทนจำหน่าย https://bit.ly/3Jd8k9q
  #AmeShop #MiniMiku    
  `;
}

function html( p ) {
    const productName = p.name || '';
  
    const lotjp = parseFloat(p.lotjp || 0);
    const lotagent = parseFloat(p.lotagent || 0);
  
    const lotName = lotjp > lotagent ? 'ญี่ปุ่น' : 'ตัวแทนจำหน่าย';
    const price = Math.max(lotjp, lotagent).toLocaleString();
    const mudjum = parseFloat(p.mudjum || 0).toLocaleString();

    const isClose = lotjp > lotagent ? 'จองได้จนกว่ายอดที่ญี่ปุ่นจะเต็ม' : `ปิดจองราคานี้ ${p.close}` ;
  
    const spec = (p.spec || '').replace(/\n+/g, '<br />');
    const detail = (p.detail || '').replace(/\n+/g, '<br />');

    const seriesTitles = Array.isArray(p.series_titles) ? p.series_titles.join('<br />')  : '';
    const originalTitles = Array.isArray(p.original_titles) ? p.original_titles.join('<br />')  : '';
    const characterTitles = Array.isArray(p.character_names) ? p.character_names.join('<br />')  : '';

    return `
<center>
			<header id="des-head">
				<h3 style="font-size: 26px; color:#3636AE;"><b>
                <strong>${productName}</strong>
                </b></h3>
			</header><!-- header /Head-Production-Description -->

			<section id="detail">
				<div id="price">
					<!--xxxxxxxxxx-->
                    <center>
                    <b style="font-size: 22px;">ราคาล๊อต${lotName} : <b id="lungaen_price_1">${price}</b> บาท</b> <b style="color: #F00; font-size: 24px;">
                    (มัดจำ <b id="lungaen_price_mo_1">${mudjum}</b> บาท)</b></center>
                    <br/><br/><center><b style="font-size: 16px; color: #F30;">${isClose}</b>
                    </center><br/>
                    <!--yyyyyyyyyy-->
				</div>
			</section>

			<section id="product-info">
				<header>
					<div id="product-info-header">
						<h2 style="text-align: left; margin-left: 10px;">
							<span style="background: #ff6600;color: #ffffff;display: inline-block;font-size: 153%;font-weight: bold;padding: 2px 5px 0;line-height: 48px;">รายละเอียด</span>
						</h2>
					</div><!-- div /head -->
				</header>
<br />
				<div id="product-des" style="text-align: left;">

					<div id="des">
						<p style="font-size: 18px;">
							
					<p style="font-size: 20px; color:rgb(0, 0, 0); margin-left: 30px;">
                        
                            <b style="color: #ff6600">Pre-order</b>(Release Date: ${p.release})<br/><br/>
                            <b style="color: #ff6600">Brand</b><br/>${p.maker}<br/><br/>
                            <b style="color: #ff6600">Barcode</b><br/>${p.barcode}<br/><br/>
                            <b style="color: #ff6600">Product Line</b><br />${seriesTitles}<br/><br/>
                            <b style="color: #ff6600">Series Title</b><br />${originalTitles}<br/><br/>
                            <b style="color: #ff6600">Character</b><br />${characterTitles}<br/><br/>
                        

                    </p>
					<p style="font-size: 18px; margin-left: 50px;"></p>
				
                <section id="Specifications-details">
                    <h4 style="font-size: 20px; color: #ff6600; margin-left: 30px;"><b>Specifications</b></h4>
                    <p style="font-size: 14px; margin-left: 46px;">
                    
                    ${spec}
                    
                    <br/><br/>
                    
                    ${detail}
                    
                    <br /></p>
                </section><!-- section /Specifications-details -->
            
						</p>
					</div><!-- div /des -->

				</div><!-- div /product-des -->
			</section><!-- section /product-des -->

<br />

		<section>
			<div id="link">
				<br />
				<div>
					<h2 style="text-align: left; margin-left: 10px;">
						<span style="background: #ff6600;color: #ffffff;display: inline-block;font-size: 153%;font-weight: bold;padding: 2px 5px 0;line-height: 48px;">ช่องทางการติดต่อ</span>
					</h2>
				</div>
<br />
				<div style="margin-bottom: 20px;background-color: #fff;border: 1px solid transparent;border-radius: 4px;-webkit-box-shadow: 0 1px 1px rgba(0,0,0,.05);box-shadow: 0 1px 1px rgba(0,0,0,.05); width: 500px;">

					<div style="padding: 18px;">
						<b style="font-size: 120%;"><a style="text-decoration:none;" target="_blank" href="https://www.ame-shop.com">https://www.ame-shop.com</a><br /></b>
						<b style="font-size: 120%;"><a style="text-decoration:none;" target="_blank" href="https://www.facebook.com/minimikushop">https://www.facebook.com/AmeShopFC</a><br /></b>
						<b style="font-size: 120%;"><a style="text-decoration:none;" target="_blank" href="https://twitter.com/ameshopth">https://twitter.com/ameshopth</a><br /></b>
						<b style="font-size: 120%;">Line : ameshop<br /></b>
						<b style="font-size: 120%;">Email: ameshop.th@gmail.com<br /></b>
						<b style="font-size: 120%;">Tel: 084-0840092</b>
					</div>
				</div>

			</div>
		</section>

<br />

			<section id="tag">
					<div>
						<br />
						<div>
							<h2 style="text-align: left; margin-left: 10px;">
								<span style="background: #ff6600;color: #ffffff;display: inline-block;font-size: 153%;font-weight: bold;padding: 2px 5px 0;line-height: 48px;">แท๊ก</span>
							</h2>
						</div><!-- div /head -->
					</div>
<br />
				<div id="tag-information">
					<b>
				<u><a href="" target="_blank">#PRISMA</a></u>
				<u><a href="" target="_blank">#WING</a></u>
				<u><a href="" target="_blank">#Re:ZERO</a></u>
				<u><a href="" target="_blank">#-Starting</a></u>
				<u><a href="" target="_blank">#Life</a></u>
				<u><a href="" target="_blank">#in</a></u>
				<u><a href="" target="_blank">#Another</a></u>
				<u><a href="" target="_blank">#World-</a></u>
				<u><a href="" target="_blank">#Ram</a></u>
				<u><a href="" target="_blank">#Glass</a></u>
				<u><a href="" target="_blank">#Edition</a></u>
				<u><a href="" target="_blank">#1/7</a></u>
				<u><a href="" target="_blank">#Complete</a></u>
				<u><a href="" target="_blank">#Figure(Pre-order)</a></u>
					<u><a href="" target="_blank">#ด๋อย</a></u>
					<u><a href="" target="_blank">#ญี่ปุ่น</a></u>
					<u><a href="" target="_blank">#เนนโดรอยด์ ของแท้</a></u>
					<u><a href="" target="_blank">#ด๋อย คือ</a></u>
					<u><a href="" target="_blank">#ฟิกเกอร์</a></u>
					<u><a href="" target="_blank">#ฟิกม่า</a></u>
					<u><a href="" target="_blank">#Accessory</a></u>
					<u><a href="" target="_blank">#nendoroid ซื้อที่ไหน</a></u>
					<u><a href="" target="_blank">#nendoroid price</a></u>
					<u><a href="" target="_blank">#ฟิกม่า คือ</a></u>
					<u><a href="" target="_blank">#ราคา ฟิก เกอร์</a></u>
					<u><a href="" target="_blank">#Gunpla</a></u>
					<u><a href="" target="_blank">#nendoroid คือ</a></u>
					<u><a href="" target="_blank">#Scale Figure</a></u>
					<u><a href="" target="_blank">#รีวิว ฟิก ม่า</a></u>
					<u><a href="" target="_blank">#figma</a></u>
					<u><a href="" target="_blank">#ด๋ อย คือ อะไร</a></u>
					<u><a href="" target="_blank">#Gundam</a></u>
					<u><a href="" target="_blank">#ฟิก ม่า คือ</a></u>
					<u><a href="" target="_blank">#Nendoroid</a></u>
					<u><a href="" target="_blank">#ฟิก เกอร์ คือ</a></u>
					<u><a href="" target="_blank">#โมเดล figure</a></u>
					<u><a href="" target="_blank">#ร้าน ฟิก เกอร์</a></u>
					<u><a href="" target="_blank">#สินค้า</a></u>
					<u><a href="" target="_blank">#figma ราคา</a></u>
					<u><a href="" target="_blank">#Model</a></u>
					<u><a href="" target="_blank">#figure bleach</a></u>
					<u><a href="" target="_blank">#ฟิกเกอร์ คือ</a></u>
					<u><a href="" target="_blank">#ร้าน ขาย figma</a></u>
					<u><a href="" target="_blank">#สั่งซื้อ nendoroid</a></u>
					<u><a href="" target="_blank">#เน็ น โด รอย ด์</a></u>
					<u><a href="" target="_blank">#ด๋ อย คือ</a></u>
					<u><a href="" target="_blank">#ขาย เน น โด รอย ด์</a></u>
					<u><a href="" target="_blank">#ด๋อย มิกุ</a></u>
					<u><a href="" target="_blank">#พรีออเดอร์</a></u>
					<u><a href="" target="_blank">#Figma</a></u>
					<u><a href="" target="_blank">#figma ขาย</a></u>
					<u><a href="" target="_blank">#Animation</a></u>
					<u><a href="" target="_blank">#Figure</a></u>
					<u><a href="" target="_blank">#ด๋อย แปลว่า</a></u>
					<u><a href="" target="_blank">#ด๋ อย หมาย ถึง</a></u>
					<u><a href="" target="_blank">#nendoroid แท้</a></u>
					<u><a href="" target="_blank">#nendoroid ราคาถูก</a></u>
					<u><a href="" target="_blank">#ร้าน ฟิก ม่า</a></u>
					<u><a href="" target="_blank">#figma คือ</a></u>
					<u><a href="" target="_blank">#ขาย nendoroid</a></u>
					<u><a href="" target="_blank">#ด๋ อย แปล ว่า อะไร</a></u>
					<u><a href="" target="_blank">#Action Figure</a></u>
					<u><a href="" target="_blank">#ฟิกเกอร์ ราคาถูก</a></u>
					<u><a href="" target="_blank">#Pre-order</a></u>
					<u><a href="" target="_blank">#โมเดล</a></u>
					<u><a href="" target="_blank">#Japan</a></u>
					</b>
				</div>
			</section>
</center> 
  `;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ส่วนที่เหลือของ server logic สามารถคงไว้ตามที่ใช้อยู่
function renderPromoteTable(products) {

    const rows = products.map(p => {
        return `<tr>
            <td>${p.id}</td>
            <td><input type="text" value="${p.gcode}"></td>
            <td><input type="text" value="${escapeHtml(p.name)}"><br /><img src="${p.images?.[0] || ''}" alt="${p.name}" /></td>
            <td><input type="text" value="${Math.max(Number(p.lotjp || 0), Number(p.lotagent || 0))}"></td>
            <td><textarea>as I'm seller in marketplace and I want to promote my product in twitter, I have only product name, can you provide me hashtag of my product. Give me 4 hashtag don't want line number, just provide hashtag result, provide continuous not new line. Just give me only hashtag, don't explain me anything because I want to copy it to another website. This is my product name: ${filterName(p.name)}
            ${Array.isArray(p.series_titles) ? p.series_titles.join(' ')  : ''} ${Array.isArray(p.original_titles) ? p.original_titles.join(' ')  : ''} ${Array.isArray(p.character_names) ? p.character_names.join(' ')  : ''}
            </textarea></td>
            <td><textarea></textarea></td>
            <td><textarea>${fb( p )}</textarea></td>
            <td><textarea>${ x( p ) }</textarea></td>
            <td><textarea>${ tt( p ) }</textarea></td>
            <td><textarea>${ html( p ) }</textarea></td>
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
  img { display: block; width: 60px; height: 60px; object-fit: cover; margin: 0 auto; }
  button { width: 100px; height: 30px; font-size: 14px; }
</style>
</head>
<body>
    <h2>🟢 Promote Table [ ${products.length} items ]</h2>
    <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>GCode</th>
            <th>Name</th>
            <th>Price</th>
            <th>Prompt to AI</th>
            <th>Hashtag</th>
            <th>FB</th>
            <th>X</th>
            <th>Tiktok</th>
            <th>HTML</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
    </table>
    <br />
<button onclick="editAll()">EditAll</button>
<script>
  function editAll() {
    fetch('/edit-all', { method: 'POST' })
      .then(() => window.location.reload())
      .catch(err => alert("Edit All Failed: " + err));
  }
</script>

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

        if (parsedUrl.pathname === '/promote-all') {
          for (const p of products) {
            p.status = 'Promoted';
          }
          saveProducts(products);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }
        
        if (parsedUrl.pathname === '/edit-all') {
          for (const p of products) {
            p.status = 'Edited';
          }
          saveProducts(products);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }
        

        if (parsedUrl.pathname === '/price') {
            let updated = [];
        
            for (const p of products) {
                const id = String(p.id);
                const status = post[`status_${id}`];
        
                if (status === 'Delete') continue;
        
                const old = JSON.stringify({
                    check1: p.check1,
                    check2: p.check2,
                    check3: p.check3,
                    profit: p.profit,
                    w: p.w,
                    day: p.day,
                    month: p.month,
                    year: p.year,
                    lotjp: p.lotjp,
                    lotagent: p.lotagent,
                    mudjum: p.mudjum,
                    close: p.close,
                });
        
                p.status = status || 'Promoted';
                p.check1 = post[`check1_${id}`] ?? p.check1;
                p.check2 = post[`check2_${id}`] ?? p.check2;
                p.check3 = post[`check3_${id}`] ?? p.check3;
                p.profit = post[`profit_${id}`] ?? (p.profit ?? config.profit);
                p.w = post[`w_${id}`] ?? p.w;
                p.day = post[`day_${id}`] ?? p.day;
                p.month = post[`month_${id}`] ?? p.month;
                p.year = post[`year_${id}`] ?? p.year;
        
                // ✅ เพิ่มใหม่ตรงนี้
                p.lotjp = post[`lotjp_${id}`] ?? p.lotjp;
                p.lotagent = post[`lotagent_${id}`] ?? p.lotagent;
                p.mudjum = post[`mudjum_${id}`] ?? p.mudjum;
                p.close = post[`close_${id}`] ?? p.close;
        
                const after = JSON.stringify({
                    check1: p.check1,
                    check2: p.check2,
                    check3: p.check3,
                    profit: p.profit,
                    w: p.w,
                    day: p.day,
                    month: p.month,
                    year: p.year,
                    lotjp: p.lotjp,
                    lotagent: p.lotagent,
                    mudjum: p.mudjum,
                    close: p.close,
                });
        
                if (old !== after) {
                    p.status = 'Edited';
                }
        
                updated.push(p);
            }
        
            saveProducts(updated);
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
        const priceItems = loadProducts().filter(p => p.status !== 'Promoted');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(renderPriceTable(priceItems));
        return;
    }

    if (parsedUrl.pathname === '/promote') {
        const promoteItems = loadProducts().filter(p => ['Uploaded', 'Promoted'].includes(p.status));
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