// 類別與欄位定義（前端表單、AI 判讀、分享頁共用）
// src: look = AI 可從照片判讀；cert = 只能依鑑定書或賣家提供；manual = 只由人工填寫
// group: look = 外觀特徵；spec = 規格；cert = 鑑定資訊

const COMMON_SPEC = [
  { key: 'size', label: '尺寸', src: 'cert', group: 'spec', hint: '依鑑定書或實測，例：內徑 56mm、條寬 12mm' },
  { key: 'weight', label: '重量', src: 'cert', group: 'spec', hint: '例：38.5g' },
];

const CERT = [
  { key: 'cert_org', label: '鑑定機構', src: 'cert', group: 'cert', hint: '只依鑑定書填寫' },
  { key: 'cert_no', label: '證書編號', src: 'cert', group: 'cert', hint: '只依鑑定書填寫' },
  { key: 'cert_result', label: '鑑定結果', src: 'cert', group: 'cert', hint: '例：天然翡翠（A貨）；只依鑑定書填寫' },
];

export const CATEGORIES = {
  jade: {
    label: '翡翠',
    subtypes: ['手鐲', '吊墜／掛件', '平安扣', '戒面／戒指', '耳飾', '手串／珠鍊', '雕件／擺件', '原石', '其他'],
    fields: [
      { key: 'color', label: '顏色', src: 'look', group: 'look', hint: '例：陽綠、晴水、紫羅蘭、黃翡、無色' },
      { key: 'texture', label: '種水', src: 'look', group: 'look', hint: '例：冰種、糯冰、糯種（照片判讀僅供參考）' },
      { key: 'theme', label: '題材', src: 'look', group: 'look', hint: '例：觀音、佛公、葫蘆、如意、竹節' },
      { key: 'craft', label: '雕工／工藝', src: 'look', group: 'look', hint: '例：圓雕、薄意雕、素面拋光' },
      { key: 'meaning', label: '寓意', src: 'look', group: 'look', hint: '依題材說明吉祥寓意' },
      ...COMMON_SPEC,
      ...CERT,
    ],
  },
  coral: {
    label: '珊瑚',
    subtypes: ['原枝', '雕件／擺件', '手串／珠鍊', '吊墜', '戒指', '耳飾', '其他'],
    fields: [
      { key: 'species', label: '種類', src: 'look', group: 'look', hint: '例：阿卡、沙丁、MOMO（照片判讀僅供參考）' },
      { key: 'color', label: '顏色', src: 'look', group: 'look', hint: '例：牛血紅、橘紅、粉紅、白' },
      { key: 'form', label: '形態', src: 'look', group: 'look', hint: '例：原枝、圓珠、桶珠、雕件' },
      { key: 'theme', label: '題材', src: 'look', group: 'look', hint: '雕件才需要，例：花鳥、彌勒' },
      { key: 'craft', label: '雕工／工藝', src: 'look', group: 'look' },
      { key: 'meaning', label: '寓意', src: 'look', group: 'look' },
      ...COMMON_SPEC,
      ...CERT,
    ],
  },
};

export const GROUP_LABELS = { look: '外觀特徵', spec: '規格', cert: '鑑定資訊' };

export function categoryOf(key) {
  return CATEGORIES[key] || CATEGORIES.jade;
}
