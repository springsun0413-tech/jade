import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORIES } from '../shared/categories.js';
import { api, resizeImage } from './lib.js';
import { useToast } from './App.jsx';

export function PhotoPickers({ onFiles, compact }) {
  const pick = (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (files.length) onFiles(files);
  };
  return (
    <div className={`pickers ${compact ? 'compact' : ''}`}>
      <label className="btn">
        拍照
        <input type="file" accept="image/*" capture="environment" onChange={pick} hidden />
      </label>
      <label className="btn ghost">
        從相簿選
        <input type="file" accept="image/*" multiple onChange={pick} hidden />
      </label>
    </div>
  );
}

export default function NewItem() {
  const [category, setCategory] = useState('jade');
  const [subtype, setSubtype] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]); // { file, url, kind }
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const nav = useNavigate();
  const cat = CATEGORIES[category];

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const add = (files) =>
    setPhotos((ps) => [...ps, ...files.map((f) => ({ file: f, url: URL.createObjectURL(f), kind: 'photo' }))].slice(0, 12));

  async function create() {
    try {
      setBusy('建立中…');
      const item = await api('POST', '/items', { category, subtype, notes });
      for (let i = 0; i < photos.length; i++) {
        setBusy(`上傳照片 ${i + 1}/${photos.length}…`);
        const blob = await resizeImage(photos[i].file);
        await api('POST', `/items/${item.id}/photos?kind=${photos[i].kind}`, blob, { raw: true });
      }
      nav(`/item/${item.id}?analyze=1`, { replace: true });
    } catch (e) {
      toast(e.message);
      setBusy('');
    }
  }

  return (
    <div className="page">
      <header className="bar">
        <Link to="/" className="back">‹ 返回</Link>
        <h1>新增作品</h1>
        <span />
      </header>

      <div className="section">
        <div className="label">類別</div>
        <div className="seg big">
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <button key={k} className={`${category === k ? 'on' : ''} ${k}`} onClick={() => { setCategory(k); setSubtype(''); }}>
              {v.label}
            </button>
          ))}
        </div>

        <div className="label">品項</div>
        <div className="chips">
          {cat.subtypes.map((s) => (
            <button key={s} className={subtype === s ? 'on' : ''} onClick={() => setSubtype(subtype === s ? '' : s)}>{s}</button>
          ))}
        </div>

        <div className="label">照片 <small className="muted">建議：正面、背面、透光各一張；有鑑定書也拍進來</small></div>
        {photos.length > 0 && (
          <div className="photo-grid">
            {photos.map((p, i) => (
              <div key={p.url} className="ph">
                <img src={p.url} alt="" />
                <button
                  className={`kind ${p.kind}`}
                  onClick={() => setPhotos((ps) => ps.map((x, j) => (j === i ? { ...x, kind: x.kind === 'cert' ? 'photo' : 'cert' } : x)))}
                >
                  {p.kind === 'cert' ? '鑑定書' : '商品照'}
                </button>
                <button className="x" aria-label="移除" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
        )}
        <PhotoPickers onFiles={add} />
        {photos.length > 0 && <p className="muted small">點照片下方標籤可切換「商品照／鑑定書」</p>}

        <label className="field">
          <span>補充說明（選填）</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="例：內徑 56mm、重 38g、客人偏好綠色、來源…" />
        </label>
      </div>

      <div className="dock">
        <button className="btn primary block" disabled={!photos.length || !!busy} onClick={create}>
          {busy || '建立並 AI 判讀'}
        </button>
      </div>
    </div>
  );
}
