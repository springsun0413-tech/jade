import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CATEGORIES, GROUP_LABELS, categoryOf } from '../shared/categories.js';
import { api, copyText, imgUrl, itemStatus, resizeImage, shareUrl } from './lib.js';
import { useToast } from './App.jsx';
import { PhotoPickers } from './NewItem.jsx';

const FORM_KEYS = ['category', 'subtype', 'title', 'notes', 'fields', 'intro_short', 'intro_long', 'photos', 'ai_uncertain'];
const pickForm = (it) => Object.fromEntries(FORM_KEYS.map((k) => [k, it[k] ?? (k === 'fields' ? {} : Array.isArray(it[k]) ? [] : '')]));

export default function EditItem() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [item, setItem] = useState(null);
  const [form, setForm] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const nav = useNavigate();
  const autoRan = useRef(false);

  useEffect(() => {
    api('GET', `/items/${id}`)
      .then((it) => { setItem(it); setForm(pickForm(it)); })
      .catch((e) => toast(e.message));
  }, [id]);

  useEffect(() => {
    if (item && params.get('analyze') === '1' && !autoRan.current) {
      autoRan.current = true;
      setParams({}, { replace: true });
      analyze(true);
    }
  }, [item]);

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!form) return <div className="page"><p className="muted center">載入中…</p></div>;

  const cat = categoryOf(form.category);
  const st = itemStatus(dirty ? { ...item, updated_at: '9999' } : item);
  const update = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };
  const setField = (k, v) => update({ fields: { ...form.fields, [k]: v } });

  async function save(quiet) {
    setBusy('儲存中…');
    try {
      const it = await api('PUT', `/items/${id}`, form);
      setItem(it);
      setForm(pickForm(it));
      setDirty(false);
      if (!quiet) toast('已儲存草稿');
      return it;
    } finally {
      setBusy('');
    }
  }

  async function analyze(auto) {
    if (!form.photos.length) return toast('請先上傳照片');
    const hasContent = form.intro_long || form.intro_short;
    if (!auto && hasContent && !confirm('AI 會重新產生名稱、欄位和介紹，覆蓋目前內容。繼續？')) return;
    try {
      if (dirty) await save(true);
      setBusy('AI 判讀中，約 20–40 秒…');
      const r = await api('POST', `/items/${id}/analyze`, { category: form.category, subtype: form.subtype, notes: form.notes });
      setForm((f) => {
        const fields = { ...f.fields };
        for (const [k, v] of Object.entries(r.fields || {})) if (v) fields[k] = v;
        return {
          ...f,
          title: r.title || f.title,
          subtype: r.subtype || f.subtype,
          fields,
          intro_short: r.intro_short || f.intro_short,
          intro_long: r.intro_long || f.intro_long,
          ai_uncertain: r.uncertain || [],
        };
      });
      setDirty(true);
      toast('AI 已填入，請檢查後儲存');
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy('');
    }
  }

  async function upload(files) {
    try {
      let it;
      for (let i = 0; i < files.length; i++) {
        setBusy(`上傳照片 ${i + 1}/${files.length}…`);
        const blob = await resizeImage(files[i]);
        it = await api('POST', `/items/${id}/photos?kind=photo`, blob, { raw: true });
      }
      // 只合併新照片，保留尚未儲存的編輯
      const known = new Set(form.photos.map((p) => p.id));
      const added = it.photos.filter((p) => !known.has(p.id));
      setForm((f) => ({ ...f, photos: [...f.photos, ...added] }));
      setItem((x) => ({ ...x, updated_at: it.updated_at }));
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy('');
    }
  }

  function movePhoto(i, d) {
    const ps = [...form.photos];
    const j = i + d;
    if (j < 0 || j >= ps.length) return;
    [ps[i], ps[j]] = [ps[j], ps[i]];
    update({ photos: ps });
  }

  async function publish() {
    if (!form.title.trim()) return toast('請先填寫名稱');
    try {
      if (dirty) await save(true);
      setBusy('發佈中…');
      const it = await api('POST', `/items/${id}/publish`);
      setItem(it);
      setForm(pickForm(it));
      setDirty(false);
      await copyText(shareUrl('p', id));
      toast('已定版發佈，連結已複製');
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy('');
    }
  }

  async function unpublish() {
    if (!confirm('取消發佈後，已分享的連結會打不開。確定？')) return;
    const it = await api('POST', `/items/${id}/unpublish`).catch((e) => toast(e.message));
    if (it) { setItem(it); toast('已取消發佈'); }
  }

  async function remove() {
    if (!confirm('永久刪除這件作品和所有照片？無法復原。')) return;
    await api('DELETE', `/items/${id}`).catch((e) => toast(e.message));
    nav('/', { replace: true });
  }

  async function share() {
    const url = shareUrl('p', id);
    const text = item.published?.intro_short || '';
    if (navigator.share) {
      try { await navigator.share({ title: item.published?.title, text, url }); } catch {}
    } else {
      await copyText(url);
      toast('連結已複製');
    }
  }

  return (
    <div className="page has-dock">
      <header className="bar">
        <Link to="/" className="back" onClick={(e) => { if (dirty && !confirm('有未儲存的修改，確定離開？')) e.preventDefault(); }}>‹ 作品</Link>
        <h1 className="ellipsis">{form.title || '編輯作品'}</h1>
        <span className={`badge ${st.key}`}>{dirty ? '未儲存' : st.label}</span>
      </header>

      {item.published_at && (
        <div className="share-box">
          <div className="small muted">分享頁（顯示最後一次定版的內容）</div>
          <div className="share-actions">
            <button className="btn sm" onClick={share}>分享</button>
            <button className="btn sm ghost" onClick={async () => { await copyText(shareUrl('p', id)); toast('連結已複製'); }}>複製連結</button>
            <button className="btn sm ghost" onClick={async () => { await copyText(`${item.published.intro_short || item.published.title}\n${shareUrl('p', id)}`); toast('已複製 LINE 文字'); }}>複製 LINE 文字</button>
            <a className="btn sm ghost" href={shareUrl('p', id)} target="_blank" rel="noreferrer">開啟</a>
          </div>
        </div>
      )}

      <div className="section">
        <div className="label">照片</div>
        <div className="photo-grid">
          {form.photos.map((p, i) => (
            <div key={p.id} className="ph">
              <img src={imgUrl(p.id)} alt="" />
              {i === 0 && <span className="cover">封面</span>}
              <button className={`kind ${p.kind}`} onClick={() => update({ photos: form.photos.map((x, j) => (j === i ? { ...x, kind: x.kind === 'cert' ? 'photo' : 'cert' } : x)) })}>
                {p.kind === 'cert' ? '鑑定書' : '商品照'}
              </button>
              <button className="x" aria-label="移除" onClick={() => update({ photos: form.photos.filter((_, j) => j !== i) })}>×</button>
              <div className="mv">
                <button onClick={() => movePhoto(i, -1)} disabled={i === 0} aria-label="往前">‹</button>
                <button onClick={() => movePhoto(i, 1)} disabled={i === form.photos.length - 1} aria-label="往後">›</button>
              </div>
            </div>
          ))}
        </div>
        <PhotoPickers onFiles={upload} compact />
        <p className="muted small">第一張商品照是封面；標為「鑑定書」的照片只給 AI 讀資料，不會出現在分享頁。</p>
      </div>

      <div className="section">
        <div className="row2">
          <label className="field">
            <span>類別</span>
            <select value={form.category} onChange={(e) => update({ category: e.target.value, subtype: '' })}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>品項</span>
            <select value={form.subtype} onChange={(e) => update({ subtype: e.target.value })}>
              <option value="">未選</option>
              {cat.subtypes.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span>給 AI 的補充</span>
          <textarea rows={2} value={form.notes} onChange={(e) => update({ notes: e.target.value })} placeholder="例：內徑 56mm、重 38g" />
        </label>
        <button className="btn ai block" onClick={() => analyze(false)} disabled={!!busy}>✦ AI 判讀並產生介紹</button>
      </div>

      {form.ai_uncertain?.length > 0 && (
        <div className="notice">
          <b>請確認</b>
          <ul>{form.ai_uncertain.map((u, i) => <li key={i}>{u}</li>)}</ul>
          <button className="link" onClick={() => update({ ai_uncertain: [] })}>都確認了</button>
        </div>
      )}

      <div className="section">
        <label className="field">
          <span>名稱</span>
          <input value={form.title} onChange={(e) => update({ title: e.target.value })} placeholder="例：冰種陽綠觀音吊墜" />
        </label>
      </div>

      {['look', 'spec', 'cert'].map((g) => (
        <div className="section" key={g}>
          <div className="label">{GROUP_LABELS[g]}{g === 'cert' && <small className="muted">　只依鑑定書填寫</small>}</div>
          {cat.fields.filter((f) => f.group === g).map((f) => (
            <label className="field" key={f.key}>
              <span>{f.label}</span>
              {f.key === 'meaning' ? (
                <textarea rows={2} value={form.fields[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.hint} />
              ) : (
                <input value={form.fields[f.key] || ''} onChange={(e) => setField(f.key, e.target.value)} placeholder={f.hint} />
              )}
            </label>
          ))}
        </div>
      ))}

      <div className="section">
        <label className="field">
          <span>短介紹（LINE 用）<small className="muted">　{form.intro_short.length} 字</small></span>
          <textarea rows={3} value={form.intro_short} onChange={(e) => update({ intro_short: e.target.value })} />
        </label>
        <label className="field">
          <span>完整介紹（分享頁）<small className="muted">　{form.intro_long.length} 字，空一行分段</small></span>
          <textarea rows={10} value={form.intro_long} onChange={(e) => update({ intro_long: e.target.value })} />
        </label>
      </div>

      <div className="section danger-zone">
        {item.published_at && <button className="btn ghost block" onClick={unpublish}>取消發佈</button>}
        <button className="btn ghost danger block" onClick={remove}>刪除作品</button>
      </div>

      <div className="dock two">
        <button className="btn" disabled={!dirty || !!busy} onClick={() => save().catch((e) => toast(e.message))}>儲存草稿</button>
        <button className="btn primary" disabled={!!busy || (!dirty && st.key === 'pub')} onClick={publish}>
          {item.published_at ? '更新定版' : '定版發佈'}
        </button>
      </div>

      {busy && <div className="overlay"><div className="spinner" /><div>{busy}</div></div>}
    </div>
  );
}
