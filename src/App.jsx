import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { CATEGORIES, categoryOf } from '../shared/categories.js';
import { api, copyText, getPw, imgUrl, itemStatus, setPw, shareUrl } from './lib.js';
import EditItem from './EditItem.jsx';
import NewItem from './NewItem.jsx';

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export default function App() {
  const [authed, setAuthed] = useState(!!getPw());
  const [toast, setToast] = useState(null);
  const show = useCallback((msg) => {
    setToast(msg);
    clearTimeout(window.__jcToast);
    window.__jcToast = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    const off = () => setAuthed(false);
    window.addEventListener('jc-logout', off);
    return () => window.removeEventListener('jc-logout', off);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {authed ? (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ItemList />} />
            <Route path="/new" element={<NewItem />} />
            <Route path="/item/:id" element={<EditItem />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/settings" element={<Settings onLogout={() => { setPw(''); setAuthed(false); }} />} />
            <Route path="*" element={<ItemList />} />
          </Routes>
        </BrowserRouter>
      ) : (
        <Login onOk={() => setAuthed(true)} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </ToastCtx.Provider>
  );
}

export function TopNav() {
  return (
    <nav className="tabs">
      <NavLink to="/" end>作品</NavLink>
      <NavLink to="/collections">作品集</NavLink>
      <NavLink to="/settings">設定</NavLink>
    </nav>
  );
}

function Login({ onOk }) {
  const [pw, setVal] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setPw(pw);
    try {
      await api('GET', '/ping');
      onOk();
    } catch (e2) {
      setPw('');
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <div className="brand">珠寶介紹工具</div>
      <p className="muted">翡翠・珊瑚</p>
      <form onSubmit={submit} className="stack">
        <input type="password" placeholder="編輯密碼" value={pw} onChange={(e) => setVal(e.target.value)} autoFocus />
        {err && <div className="err">{err}</div>}
        <button className="btn primary" disabled={!pw || busy}>{busy ? '確認中…' : '進入'}</button>
      </form>
    </div>
  );
}

function ItemList() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState([]);
  const toast = useToast();
  const nav = useNavigate();

  useEffect(() => {
    api('GET', '/items').then(setItems).catch((e) => toast(e.message));
  }, []);

  const shown = useMemo(
    () =>
      (items || []).filter(
        (it) => (!cat || it.category === cat) && (!q || `${it.title || ''}${it.subtype || ''}`.includes(q.trim()))
      ),
    [items, q, cat]
  );

  function toggle(it) {
    if (!it.published_at) return toast('只能選已發佈的作品');
    setSel((s) => (s.includes(it.id) ? s.filter((x) => x !== it.id) : [...s, it.id]));
  }

  async function makeCollection() {
    const title = prompt('作品集名稱', '精選作品');
    if (title === null) return;
    try {
      const { id } = await api('POST', '/collections', { title: title || '精選作品', item_ids: sel });
      await copyText(shareUrl('c', id));
      toast('已建立，連結已複製');
      setSelecting(false);
      setSel([]);
      nav('/collections');
    } catch (e) {
      toast(e.message);
    }
  }

  return (
    <div className="page">
      <header className="bar">
        <h1>作品</h1>
        <button className="btn ghost sm" onClick={() => { setSelecting(!selecting); setSel([]); }}>
          {selecting ? '取消' : '選取建立作品集'}
        </button>
      </header>
      <TopNav />
      <div className="filters">
        <input placeholder="搜尋名稱" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg">
          <button className={!cat ? 'on' : ''} onClick={() => setCat('')}>全部</button>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <button key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{v.label}</button>
          ))}
        </div>
      </div>

      {items === null ? (
        <p className="muted center">載入中…</p>
      ) : shown.length === 0 ? (
        <div className="empty">
          <p>{items.length ? '沒有符合的作品' : '還沒有作品'}</p>
          {!items.length && <p className="muted">按右下角「＋」拍第一件</p>}
        </div>
      ) : (
        <ul className="list">
          {shown.map((it) => {
            const st = itemStatus(it);
            const cover = it.photos.find((p) => p.kind !== 'cert') || it.photos[0];
            const picked = sel.includes(it.id);
            const inner = (
              <>
                <div className="thumb">{cover ? <img src={imgUrl(cover.id)} alt="" loading="lazy" /> : <span>無照片</span>}</div>
                <div className="meta">
                  <div className={`cat ${it.category}`}>{categoryOf(it.category).label}{it.subtype ? ` · ${it.subtype}` : ''}</div>
                  <div className="name">{it.title || '（未命名）'}</div>
                  <span className={`badge ${st.key}`}>{st.label}</span>
                </div>
                {selecting && <div className={`check ${picked ? 'on' : ''}`}>{picked ? '✓' : ''}</div>}
              </>
            );
            return (
              <li key={it.id}>
                {selecting ? (
                  <button className={`row ${picked ? 'picked' : ''}`} onClick={() => toggle(it)}>{inner}</button>
                ) : (
                  <Link className="row" to={`/item/${it.id}`}>{inner}</Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {selecting ? (
        <div className="dock">
          <button className="btn primary block" disabled={!sel.length} onClick={makeCollection}>
            建立作品集（{sel.length}）
          </button>
        </div>
      ) : (
        <Link to="/new" className="fab" aria-label="新增作品">＋</Link>
      )}
    </div>
  );
}

function Collections() {
  const [cols, setCols] = useState(null);
  const toast = useToast();
  const load = () => api('GET', '/collections').then(setCols).catch((e) => toast(e.message));
  useEffect(() => { load(); }, []);

  async function del(c) {
    if (!confirm(`刪除作品集「${c.title}」？（作品本身不會被刪除）`)) return;
    await api('DELETE', `/collections/${c.id}`).catch((e) => toast(e.message));
    load();
  }

  return (
    <div className="page">
      <header className="bar"><h1>作品集</h1></header>
      <TopNav />
      {cols === null ? (
        <p className="muted center">載入中…</p>
      ) : !cols.length ? (
        <div className="empty"><p>還沒有作品集</p><p className="muted">在「作品」頁按「選取建立作品集」</p></div>
      ) : (
        <ul className="cards">
          {cols.map((c) => (
            <li key={c.id} className="card-row">
              <div>
                <div className="name">{c.title}</div>
                <div className="muted small">{c.item_ids.length} 件 · {c.created_at.slice(0, 10)}</div>
              </div>
              <div className="actions">
                <button className="btn sm" onClick={async () => { await copyText(shareUrl('c', c.id)); toast('連結已複製'); }}>複製連結</button>
                <a className="btn sm ghost" href={shareUrl('c', c.id)} target="_blank" rel="noreferrer">開啟</a>
                <button className="btn sm ghost danger" onClick={() => del(c)}>刪除</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Settings({ onLogout }) {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { api('GET', '/settings').then(setS).catch((e) => toast(e.message)); }, []);
  async function save() {
    setBusy(true);
    try {
      setS(await api('PUT', '/settings', s));
      toast('已儲存');
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!s) return <div className="page"><header className="bar"><h1>設定</h1></header><TopNav /><p className="muted center">載入中…</p></div>;
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  return (
    <div className="page">
      <header className="bar"><h1>設定</h1></header>
      <TopNav />
      <div className="section stack">
        <label className="field">
          <span>店名</span>
          <input value={s.shop_name || ''} onChange={set('shop_name')} placeholder="顯示在分享頁上方" />
        </label>
        <label className="field">
          <span>聯絡方式</span>
          <textarea rows={3} value={s.shop_contact || ''} onChange={set('shop_contact')} placeholder={'顯示在分享頁底部，例：\nLINE ID：xxxx\n電話：09xx-xxx-xxx'} />
        </label>
        <label className="field">
          <span>文案範例（選填）</span>
          <small className="muted">貼 1–3 段你自己寫過的介紹，AI 會模仿語氣</small>
          <textarea rows={8} value={s.style_example || ''} onChange={set('style_example')} />
        </label>
        <button className="btn primary block" onClick={save} disabled={busy}>{busy ? '儲存中…' : '儲存設定'}</button>
        <button className="btn ghost block" onClick={onLogout}>登出</button>
      </div>
    </div>
  );
}
