import { categoryOf, GROUP_LABELS } from '../shared/categories.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const paras = (s) =>
  String(s || '')
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');

const CSS = `
:root{--bg:#f5f1e8;--card:#fffdf8;--ink:#1d2621;--muted:#6b6f68;--line:#e2dacb;--jade:#2e6a4f;--coral:#b0453a;--accent:var(--jade)}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink)}
body{font-family:"Noto Sans TC",system-ui,-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif;line-height:1.75;-webkit-font-smoothing:antialiased}
.wrap{max-width:720px;margin:0 auto;padding:0 16px 48px}
.shop{padding:18px 0 14px;text-align:center;font-family:"Noto Serif TC",serif;letter-spacing:.32em;font-size:13px;color:var(--muted);border-bottom:1px solid var(--line)}
.gal{margin:16px -16px 0;position:relative}
.track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}
.track::-webkit-scrollbar{display:none}
.slide{flex:0 0 100%;scroll-snap-align:center;aspect-ratio:1/1;background:#ece6da;display:flex;align-items:center;justify-content:center}
.slide img{width:100%;height:100%;object-fit:contain;display:block}
.dots{display:flex;gap:6px;justify-content:center;padding:10px 0 0}
.dots i{width:6px;height:6px;border-radius:50%;background:var(--line);transition:.2s}
.dots i.on{background:var(--accent);width:16px;border-radius:3px}
.tag{display:inline-block;margin-top:22px;font-size:12px;letter-spacing:.15em;color:var(--accent);border:1px solid currentColor;padding:2px 10px;border-radius:99px}
h1{font-family:"Noto Serif TC",serif;font-weight:600;font-size:clamp(24px,6vw,32px);line-height:1.35;margin:12px 0 4px;letter-spacing:.04em}
.intro{font-size:16px;margin-top:14px}
.intro p{margin:0 0 1em}
h2{font-family:"Noto Serif TC",serif;font-size:15px;font-weight:600;letter-spacing:.2em;color:var(--muted);margin:30px 0 8px;display:flex;align-items:center;gap:10px}
h2::after{content:"";flex:1;height:1px;background:var(--line)}
dl{margin:0;display:grid;grid-template-columns:6.5em 1fr;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
dt,dd{margin:0;padding:10px 14px;border-top:1px solid var(--line);font-size:15px}
dt{color:var(--muted);background:#faf6ee}
dl>dt:first-child,dl>dt:first-child+dd{border-top:0}
.foot{margin-top:36px;padding:20px;background:var(--card);border:1px solid var(--line);border-radius:12px;text-align:center;font-size:14px;color:var(--muted)}
.foot b{display:block;color:var(--ink);font-size:16px;margin-bottom:4px;font-family:"Noto Serif TC",serif}
.date{text-align:center;font-size:12px;color:var(--muted);margin-top:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-top:20px}
.card{display:block;text-decoration:none;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.card .ph{aspect-ratio:1/1;background:#ece6da}
.card img{width:100%;height:100%;object-fit:cover;display:block}
.card .tx{padding:12px 14px 14px}
.card h3{font-family:"Noto Serif TC",serif;font-size:17px;margin:2px 0 4px;font-weight:600}
.card small{color:var(--accent);font-size:12px;letter-spacing:.1em}
.card p{margin:0;font-size:13px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ctitle{text-align:center;margin-top:28px}
`;

function shell({ title, desc, image, url, body, accent }) {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta property="og:url" content="${esc(url)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500&family=Noto+Serif+TC:wght@500;600&display=swap" rel="stylesheet">
<style>${CSS}${accent ? `:root{--accent:${accent}}` : ''}</style></head><body><div class="wrap">${body}</div></body></html>`;
}

const footer = (s) =>
  s.shop_name || s.shop_contact
    ? `<div class="foot">${s.shop_name ? `<b>${esc(s.shop_name)}</b>` : ''}${s.shop_contact ? esc(s.shop_contact).replace(/\n/g, '<br>') : ''}<div style="margin-top:6px">如需更多照片或影片，歡迎洽詢</div></div>`
    : '';

export function renderItemPage(origin, item, settings) {
  const p = item; // 已定版內容
  const cat = categoryOf(p.category);
  const photos = (p.photos || []).filter((x) => x.kind !== 'cert');
  const imgs = (photos.length ? photos : p.photos || []).map((x) => `${origin}/img/${x.id}.jpg`);

  const groups = ['look', 'spec', 'cert']
    .map((g) => {
      const rows = cat.fields.filter((f) => f.group === g && p.fields?.[f.key]);
      if (!rows.length) return '';
      return `<h2>${GROUP_LABELS[g]}</h2><dl>${rows.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(p.fields[f.key])}</dd>`).join('')}</dl>`;
    })
    .join('');

  const gallery = imgs.length
    ? `<div class="gal"><div class="track" id="t">${imgs
        .map((u, i) => `<div class="slide"><img src="${u}" alt="${esc(p.title)} 照片 ${i + 1}" ${i ? 'loading="lazy"' : ''}></div>`)
        .join('')}</div>${imgs.length > 1 ? `<div class="dots" id="d">${imgs.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}</div>
<script>(function(){var t=document.getElementById('t'),d=document.getElementById('d');if(!t||!d)return;t.addEventListener('scroll',function(){var i=Math.round(t.scrollLeft/t.clientWidth);[].forEach.call(d.children,function(e,j){e.className=j===i?'on':''})},{passive:true})})()</script>`
    : '';

  const body = `${settings.shop_name ? `<div class="shop">${esc(settings.shop_name)}</div>` : ''}
${gallery}
<span class="tag">${esc(cat.label)}${p.subtype ? ` · ${esc(p.subtype)}` : ''}</span>
<h1>${esc(p.title || '未命名')}</h1>
<div class="intro">${paras(p.intro_long || p.intro_short)}</div>
${groups}
${footer(settings)}
<div class="date">資料更新 ${esc(String(item.published_at || '').slice(0, 10))}</div>`;

  return shell({
    title: p.title || cat.label,
    desc: p.intro_short || '',
    image: imgs[0],
    url: `${origin}/p/${item.id}`,
    body,
    accent: p.category === 'coral' ? 'var(--coral)' : '',
  });
}

export function renderCollectionPage(origin, col, items, settings) {
  const cards = items
    .map((it) => {
      const cat = categoryOf(it.category);
      const cover = (it.photos || []).find((x) => x.kind !== 'cert') || (it.photos || [])[0];
      return `<a class="card" href="/p/${it.id}"><div class="ph">${cover ? `<img src="/img/${cover.id}.jpg" alt="" loading="lazy">` : ''}</div>
<div class="tx"><small style="color:${it.category === 'coral' ? 'var(--coral)' : 'var(--jade)'}">${esc(cat.label)}${it.subtype ? ` · ${esc(it.subtype)}` : ''}</small><h3>${esc(it.title || '未命名')}</h3><p>${esc(it.intro_short || '')}</p></div></a>`;
    })
    .join('');
  const first = items[0] && ((items[0].photos || []).find((x) => x.kind !== 'cert') || items[0].photos?.[0]);
  const body = `${settings.shop_name ? `<div class="shop">${esc(settings.shop_name)}</div>` : ''}
<h1 class="ctitle">${esc(col.title)}</h1>
<div style="text-align:center;color:var(--muted);font-size:14px">共 ${items.length} 件</div>
<div class="grid">${cards || '<p>目前沒有可顯示的作品</p>'}</div>
${footer(settings)}`;
  return shell({
    title: col.title,
    desc: `${settings.shop_name || ''} 精選 ${items.length} 件`.trim(),
    image: first ? `${origin}/img/${first.id}.jpg` : '',
    url: `${origin}/c/${col.id}`,
    body,
  });
}

export function renderNotFound() {
  return shell({ title: '找不到頁面', desc: '', body: '<h1 class="ctitle">找不到這個頁面</h1><p style="text-align:center;color:var(--muted)">連結可能已失效或尚未發佈。</p>' });
}
