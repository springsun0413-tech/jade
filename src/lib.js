const PW_KEY = 'jc_edit_pw';

export const getPw = () => {
  try { return localStorage.getItem(PW_KEY) || ''; } catch { return ''; }
};
export const setPw = (v) => {
  try { v ? localStorage.setItem(PW_KEY, v) : localStorage.removeItem(PW_KEY); } catch {}
};

export async function api(method, path, body, { raw } = {}) {
  const headers = { Authorization: `Bearer ${getPw()}` };
  let payload;
  if (raw) {
    headers['content-type'] = 'image/jpeg';
    payload = body;
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    setPw('');
    window.dispatchEvent(new Event('jc-logout'));
  }
  if (!res.ok) throw new Error(data.error || `錯誤 ${res.status}`);
  return data;
}

// 手機照片壓縮：長邊 1600px、JPEG 0.85，並依 EXIF 轉正
export async function resizeImage(file, max = 1600) {
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bmp = await new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => fail(new Error('無法讀取照片格式'));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bmp.width, h = bmp.height;
  const s = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * s);
  canvas.height = Math.round(h * s);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export const shareUrl = (kind, id) => `${location.origin}/${kind}/${id}`;

export function itemStatus(it) {
  if (!it.published_at) return { key: 'draft', label: '草稿' };
  if (it.updated_at > it.published_at) return { key: 'dirty', label: '有未發佈修改' };
  return { key: 'pub', label: '已發佈' };
}

export const imgUrl = (pid) => `/img/${pid}.jpg`;
