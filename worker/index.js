import { analyzeItem, httpError } from './ai.js';
import { renderItemPage, renderCollectionPage, renderNotFound } from './pages.js';
import { CATEGORIES } from '../shared/categories.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const html = (body, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } });

const now = () => new Date().toISOString();
const ALPHA = 'abcdefghijkmnpqrstuvwxyz23456789';
const newId = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => ALPHA[b % ALPHA.length]).join('');

const ITEM_JSON_COLS = ['fields', 'photos', 'ai_uncertain', 'published'];
function parseItem(row) {
  if (!row) return null;
  const it = { ...row };
  for (const c of ITEM_JSON_COLS) it[c] = it[c] ? JSON.parse(it[c]) : c === 'published' ? null : c === 'fields' ? {} : [];
  return it;
}

async function getItem(env, id) {
  return parseItem(await env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first());
}

async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

function checkAuth(req, env) {
  const pw = env.EDIT_PASSWORD;
  if (!pw) throw httpError(500, '尚未設定 EDIT_PASSWORD');
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = new TextEncoder().encode(got);
  const b = new TextEncoder().encode(pw);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  if (diff) throw httpError(401, '密碼錯誤');
}

const EDITABLE = ['category', 'subtype', 'title', 'notes', 'intro_short', 'intro_long'];

async function api(req, env, url) {
  checkAuth(req, env);
  const path = url.pathname.replace(/^\/api/, '');
  const m = req.method;
  let r;

  if (path === '/ping') return json({ ok: true });

  // 設定
  if (path === '/settings') {
    if (m === 'GET') return json(await getSettings(env));
    if (m === 'PUT') {
      const body = await req.json();
      const allowed = ['shop_name', 'shop_contact', 'style_example'];
      const stmts = allowed
        .filter((k) => k in body)
        .map((k) => env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, String(body[k] ?? '')));
      if (stmts.length) await env.DB.batch(stmts);
      return json(await getSettings(env));
    }
  }

  // 商品列表 / 新增
  if (path === '/items') {
    if (m === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT id, category, subtype, title, photos, published_at, updated_at, created_at FROM items ORDER BY updated_at DESC'
      ).all();
      return json(results.map((x) => ({ ...x, photos: JSON.parse(x.photos || '[]') })));
    }
    if (m === 'POST') {
      const body = await req.json();
      if (!CATEGORIES[body.category]) throw httpError(400, '類別錯誤');
      const id = newId();
      const t = now();
      await env.DB.prepare(
        'INSERT INTO items (id, category, subtype, notes, fields, photos, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(id, body.category, body.subtype || '', body.notes || '', '{}', '[]', t, t)
        .run();
      return json(await getItem(env, id), 201);
    }
  }

  // 單一商品
  if ((r = path.match(/^\/items\/([a-z0-9]+)$/))) {
    const id = r[1];
    const item = await getItem(env, id);
    if (!item) throw httpError(404, '找不到資料');
    if (m === 'GET') return json(item);
    if (m === 'PUT') {
      const body = await req.json();
      const next = { ...item };
      for (const k of EDITABLE) if (k in body) next[k] = String(body[k] ?? '');
      if (body.fields && typeof body.fields === 'object') next.fields = body.fields;
      if (Array.isArray(body.photos)) {
        // 只允許重新排序或改類型，不能憑空加照片
        const known = new Map(item.photos.map((p) => [p.id, p]));
        next.photos = body.photos.filter((p) => known.has(p.id)).map((p) => ({ id: p.id, kind: p.kind === 'cert' ? 'cert' : 'photo' }));
      }
      if (Array.isArray(body.ai_uncertain)) next.ai_uncertain = body.ai_uncertain.map(String);
      if (!CATEGORIES[next.category]) throw httpError(400, '類別錯誤');
      await env.DB.prepare(
        'UPDATE items SET category=?, subtype=?, title=?, notes=?, intro_short=?, intro_long=?, fields=?, photos=?, ai_uncertain=?, updated_at=? WHERE id=?'
      )
        .bind(next.category, next.subtype, next.title, next.notes, next.intro_short, next.intro_long, JSON.stringify(next.fields), JSON.stringify(next.photos), JSON.stringify(next.ai_uncertain), now(), id)
        .run();
      // 被移除的照片從 R2 刪除（已發佈版本仍在使用的保留）
      const keep = new Set([...next.photos, ...(item.published?.photos || [])].map((p) => p.id));
      const removed = item.photos.filter((p) => !keep.has(p.id));
      if (removed.length) await env.PHOTOS.delete(removed.map((p) => `p/${p.id}.jpg`));
      return json(await getItem(env, id));
    }
    if (m === 'DELETE') {
      const all = new Set([...item.photos, ...(item.published?.photos || [])].map((p) => p.id));
      if (all.size) await env.PHOTOS.delete([...all].map((pid) => `p/${pid}.jpg`));
      await env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }

  // 上傳照片（body 為 JPEG，前端已壓縮）
  if ((r = path.match(/^\/items\/([a-z0-9]+)\/photos$/)) && m === 'POST') {
    const item = await getItem(env, r[1]);
    if (!item) throw httpError(404, '找不到資料');
    if (item.photos.length >= 12) throw httpError(400, '每件最多 12 張照片');
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 8 * 1024 * 1024) throw httpError(400, '照片大小不符');
    const pid = crypto.randomUUID();
    await env.PHOTOS.put(`p/${pid}.jpg`, buf, { httpMetadata: { contentType: 'image/jpeg' } });
    const kind = url.searchParams.get('kind') === 'cert' ? 'cert' : 'photo';
    const photos = [...item.photos, { id: pid, kind }];
    await env.DB.prepare('UPDATE items SET photos=?, updated_at=? WHERE id=?').bind(JSON.stringify(photos), now(), item.id).run();
    return json(await getItem(env, item.id));
  }

  // AI 判讀（回傳建議，不寫入）
  if ((r = path.match(/^\/items\/([a-z0-9]+)\/analyze$/)) && m === 'POST') {
    const item = await getItem(env, r[1]);
    if (!item) throw httpError(404, '找不到資料');
    const body = await req.json().catch(() => ({}));
    // 允許前端帶入尚未儲存的類別／品項／補充
    for (const k of ['category', 'subtype', 'notes']) if (body[k] != null) item[k] = String(body[k]);
    return json(await analyzeItem(env, item, await getSettings(env)));
  }

  // 定版發佈 / 取消發佈
  if ((r = path.match(/^\/items\/([a-z0-9]+)\/(publish|unpublish)$/)) && m === 'POST') {
    const item = await getItem(env, r[1]);
    if (!item) throw httpError(404, '找不到資料');
    if (r[2] === 'publish') {
      if (!item.title?.trim()) throw httpError(400, '請先填寫名稱');
      if (!item.photos.length) throw httpError(400, '請至少上傳一張照片');
      const snap = {
        category: item.category, subtype: item.subtype, title: item.title, fields: item.fields,
        intro_short: item.intro_short, intro_long: item.intro_long, photos: item.photos,
      };
      const t = now();
      // 舊版本有、新版本沒用到的照片，若草稿也沒用到就刪除
      const keep = new Set(item.photos.map((p) => p.id));
      const orphan = (item.published?.photos || []).filter((p) => !keep.has(p.id));
      if (orphan.length) await env.PHOTOS.delete(orphan.map((p) => `p/${p.id}.jpg`));
      await env.DB.prepare('UPDATE items SET published=?, published_at=?, updated_at=? WHERE id=?').bind(JSON.stringify(snap), t, t, item.id).run();
    } else {
      await env.DB.prepare('UPDATE items SET published=NULL, published_at=NULL WHERE id=?').bind(item.id).run();
    }
    return json(await getItem(env, item.id));
  }

  // 作品集
  if (path === '/collections') {
    if (m === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM collections ORDER BY created_at DESC').all();
      return json(results.map((c) => ({ ...c, item_ids: JSON.parse(c.item_ids) })));
    }
    if (m === 'POST') {
      const body = await req.json();
      const ids = Array.isArray(body.item_ids) ? body.item_ids.map(String).slice(0, 100) : [];
      if (!ids.length) throw httpError(400, '請選擇作品');
      const id = newId();
      await env.DB.prepare('INSERT INTO collections (id, title, item_ids, created_at) VALUES (?, ?, ?, ?)')
        .bind(id, String(body.title || '精選作品').slice(0, 80), JSON.stringify(ids), now())
        .run();
      return json({ id }, 201);
    }
  }
  if ((r = path.match(/^\/collections\/([a-z0-9]+)$/)) && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM collections WHERE id = ?').bind(r[1]).run();
    return json({ ok: true });
  }

  throw httpError(404, 'Not found');
}

async function publicRoutes(req, env, url) {
  let r;
  if ((r = url.pathname.match(/^\/img\/([0-9a-f-]{36})\.jpg$/))) {
    const obj = await env.PHOTOS.get(`p/${r[1]}.jpg`);
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, {
      headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable', etag: obj.httpEtag },
    });
  }
  if ((r = url.pathname.match(/^\/p\/([a-z0-9]+)\/?$/))) {
    const item = await getItem(env, r[1]);
    if (!item?.published) return html(renderNotFound(), 404);
    return html(renderItemPage(url.origin, { ...item.published, id: item.id, published_at: item.published_at }, await getSettings(env)));
  }
  if ((r = url.pathname.match(/^\/c\/([a-z0-9]+)\/?$/))) {
    const col = await env.DB.prepare('SELECT * FROM collections WHERE id = ?').bind(r[1]).first();
    if (!col) return html(renderNotFound(), 404);
    const ids = JSON.parse(col.item_ids);
    const items = [];
    for (const id of ids) {
      const it = await getItem(env, id);
      if (it?.published) items.push({ ...it.published, id: it.id });
    }
    return html(renderCollectionPage(url.origin, col, items, await getSettings(env)));
  }
  return null;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, env, url);
      const res = await publicRoutes(req, env, url);
      if (res) return res;
      return env.ASSETS.fetch(req);
    } catch (e) {
      if (!e.status) console.error(e);
      return json({ error: e.status ? e.message : '伺服器錯誤' }, e.status || 500);
    }
  },
};
