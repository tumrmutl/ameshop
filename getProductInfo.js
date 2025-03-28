import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const IMAGE_DOWNLOAD_DELAY_MS = 300; //DELAY ดึงข้อมูลจากเว็บ Amimi (300 = 300ms)

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const links = fs.readFileSync(path.join(__dirname, 'link.txt'), 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(Boolean)

if (!fs.existsSync(path.join(__dirname, 'images'))) {
  fs.mkdirSync(path.join(__dirname, 'images'))
}

const DATA_FILE = path.join(__dirname, 'products.json')
let products = []

if (fs.existsSync(DATA_FILE)) {
  try {
    products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  } catch {
    products = []
  }
}

// หาค่า id สูงสุดที่มีใน products.json
let currentMaxId = products.reduce((max, p) => Math.max(max, p.id), 0)

function extractCode(link) {
  const gcodeMatch = link.match(/gcode=([\w-]+)/)
  const scodeMatch = link.match(/scode=([\w-]+)/)
  if (gcodeMatch) {
    return { type: 'gcode', code: gcodeMatch[1] }
  } else if (scodeMatch) {
    return { type: 'scode', code: scodeMatch[1] }
  } else {
    return null
  }
}

for (const link of links) {
  const result = extractCode(link)
  if (!result) {
    console.log(`   XXX Cannot find gcode or scode: ${link}`)
    continue
  }

  const { type, code } = result

  if (products.find(p => p.gcode === code || p.scode === code)) {
    console.log(`   !!! Skip ${code} (already have this item.)`)
    continue
  }

  console.log(`   Downloading ${type.toUpperCase()} ${code} ...`)

  const apiParam = type === 'gcode' ? `gcode=${code}` : `scode=${code}`

  const r = await fetch(`https://api.amiami.com/api/v1.0/item?${apiParam}&lang=eng`, {
    headers: {
      "accept": "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9,th;q=0.8,th-TH;q=0.7,ja;q=0.6",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "priority": "u=1, i",
      "sec-ch-ua": "\"Chromium\";v=\"134\", \"Not:A-Brand\";v=\"24\", \"Google Chrome\";v=\"134\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "x-user-key": "amiami_dev",
      "Referer": "https://www.amiami.com/",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    }
  }).then(res => res.json()).catch(() => null)

  if (!r || !r.RSuccess || typeof r.item === 'undefined') {
    console.log(`   XXX Cannot fetch item : ${code}`)
    continue
  }

  const product = {
    id: ++currentMaxId,
    gcode: r.item.gcode ?? null,
    scode: r.item.scode ?? null,
    name: r.item.sname,
    price: r.item.price,
    status: 'new',
    release: r.item.releasedate,
    maker: r.item.maker_name,
    barcode: r.item.jancode,
    spec: r.item.spec,
    detail: r.item.memo,
    images: [
      { image_url: r.item.main_image_url },
      ...(r._embedded.review_images ?? [])
    ].map(i => `https://img.amiami.com${i.image_url}`),
    series_titles: [...(r._embedded.series_titles ?? [])].map(i => i.name),
    original_titles: [...(r._embedded.original_titles ?? [])].map(i => i.name),
    character_names: [...(r._embedded.character_names ?? [])].map(i => i.name),
  }

  for (const url of product.images) {
    try {
      const buf = await fetch(url).then(res => res.arrayBuffer())
      const fileName = path.basename(url)
      fs.writeFileSync(path.join(__dirname, 'images', fileName), Buffer.from(buf))
      await delay(IMAGE_DOWNLOAD_DELAY_MS)
    } catch {
      console.log(`   XXX Fail to download : ${url}`)
    }
  }

  products.push(product)
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2))
  console.log(`   Records ${code} success.`)
}
