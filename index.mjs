import fs from 'fs'

const gcode = 'FIGURE-183423'

const r = await fetch(`https://api.amiami.com/api/v1.0/item?gcode=${gcode}&lang=eng`, {
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
})
  .then((r) => r.json())
  .catch(() => null)

if (!r || !r.RSuccess || typeof r.item == 'undefined') {
  console.log("Script broken :(")
}

const product = {
  gcode: r.item.gcode,
  name: r.item.sname,
  price: r.item.price,
  status: r.item.salestatus,
  release: r.item.releasedate,
  maker: r.item.maker_name,
  barcode: r.item.jancode,
  spec: r.item.spec,
  detail: r.item.memo,
  images: [
    { image_url: r.item.main_image_url },
    ...(r._embedded.review_images ?? [])
  ].map((i) => `https://img.amiami.com${i.image_url}`),
  series_titles: [...(r._embedded.series_titles ?? [])].map((i) => i.name),
  original_titles: [...(r._embedded.original_titles ?? [])].map((i) => i.name),
  character_names: [...(r._embedded.character_names ?? [])].map((i) => i.name),
}

// Save Data

if (!fs.existsSync(`./data/${product.gcode}`)) {
  fs.mkdirSync(`./data/${product.gcode}`)
}

fs.writeFileSync(`./data/${product.gcode}/${product.gcode}.json`, JSON.stringify(product, null, 4))

for (const url of product.images) {
  const buf = await fetch(url)
    .then(r => r.arrayBuffer())

  const fName = url.split('/').splice(-1)
  fs.writeFileSync(`./data/${product.gcode}/${fName}`, Buffer.from(buf))
}
