import { categoryOf } from '../shared/categories.js';

// 呼叫 Claude API 看圖判讀，回傳建議內容（不直接寫入資料庫，由前端套用後儲存）
export async function analyzeItem(env, item, settings) {
  const cat = categoryOf(item.category);
  const photos = (item.photos || []).slice(0, 8);
  if (!photos.length) throw httpError(400, '請先上傳至少一張照片');
  const hasCert = photos.some((p) => p.kind === 'cert');

  if (env.MOCK_AI === '1') return sanitize(mockResult(item, cat, hasCert), cat, hasCert);
  if (!env.ANTHROPIC_API_KEY) throw httpError(500, '尚未設定 ANTHROPIC_API_KEY');

  const content = [];
  for (let i = 0; i < photos.length; i++) {
    const obj = await env.PHOTOS.get(`p/${photos[i].id}.jpg`);
    if (!obj) continue;
    const b64 = Buffer.from(await obj.arrayBuffer()).toString('base64');
    content.push({ type: 'text', text: `圖${i + 1}（${photos[i].kind === 'cert' ? '鑑定書' : '商品照'}）` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } });
  }

  const fieldLines = cat.fields
    .map((f) => `- ${f.key}（${f.label}）：${f.src === 'look' ? '可依照片判讀' : '只能依鑑定書照片或賣家補充填寫，否則留空'}${f.hint ? `；${f.hint}` : ''}`)
    .join('\n');

  const prompt = `你是協助台灣珠寶銷售員整理商品資料的助理。請看上面的照片，為這件${cat.label}整理資料並撰寫介紹。

類別：${cat.label}
賣家選的品項：${item.subtype || '未選'}（可選值：${cat.subtypes.join('、')}）
賣家補充：${item.notes?.trim() || '（無）'}

欄位：
${fieldLines}

規則：
1. 一律用繁體中文、台灣用語。
2. 照片無法判定真偽、是否處理過（A/B/C 貨）、珊瑚是否天然或染色。除非鑑定書照片上寫明，否則不要寫出這類判定，介紹文案也不要暗示。
3. 尺寸、重量、鑑定機構、證書編號、鑑定結果只能取自鑑定書照片或賣家補充，看不到就留空字串，不要估計。
4. 種水、珊瑚種類等從照片判讀有不確定性的，填你最可能的判斷，並在 uncertain 說明需要賣家確認的地方。
5. title：簡潔的商品名稱，例如「冰種陽綠觀音吊墜」。
6. intro_short：40–70 字，適合直接貼到 LINE 的一段話。
7. intro_long：150–300 字，分 2–3 段（段落間空一行），描述外觀、質地、雕工題材與寓意、適合的佩戴或收藏情境。語氣優雅真誠，不誇大，不提價格，不用「投資保值」「必漲」之類字眼。
${settings.style_example ? `\n參考以下賣家過去的文案語氣（只模仿語氣，不要照抄內容）：\n"""\n${settings.style_example}\n"""` : ''}

請呼叫 save_item 工具回傳結果。`;

  content.push({ type: 'text', text: prompt });

  const fieldProps = Object.fromEntries(cat.fields.map((f) => [f.key, { type: 'string', description: f.label }]));
  const body = {
    model: env.MODEL || 'claude-sonnet-5-5',
    max_tokens: 3000,
    tools: [
      {
        name: 'save_item',
        description: '儲存判讀後的商品資料',
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            subtype: { type: 'string', enum: cat.subtypes },
            fields: { type: 'object', properties: fieldProps },
            intro_short: { type: 'string' },
            intro_long: { type: 'string' },
            uncertain: { type: 'array', items: { type: 'string' }, description: '需要賣家確認或照片無法判斷的事項' },
          },
          required: ['title', 'fields', 'intro_short', 'intro_long', 'uncertain'],
        },
      },
    ],
    // 部分新模型不支援強制指定工具，用 auto 並在提示詞要求呼叫
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content }],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('Claude API error', res.status, text);
    throw httpError(502, `AI 服務錯誤（${res.status}），請稍後再試`);
  }
  const data = await res.json();
  const tool = (data.content || []).find((b) => b.type === 'tool_use' && b.name === 'save_item');
  if (tool) return sanitize(tool.input, cat, hasCert);
  // 備援：模型直接回 JSON 文字
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return sanitize(JSON.parse(m[0]), cat, hasCert);
    } catch {}
  }
  console.error('Claude no tool_use', JSON.stringify(data).slice(0, 2000));
  throw httpError(502, 'AI 沒有回傳結果，請再試一次');
}

function sanitize(r, cat, hasCert) {
  const fields = {};
  for (const f of cat.fields) {
    let v = typeof r.fields?.[f.key] === 'string' ? r.fields[f.key].trim() : '';
    // 沒有鑑定書照片時，鑑定欄位一律不採用 AI 結果
    if (f.group === 'cert' && !hasCert) v = '';
    fields[f.key] = v;
  }
  return {
    title: String(r.title || '').trim(),
    subtype: cat.subtypes.includes(r.subtype) ? r.subtype : undefined,
    fields,
    intro_short: String(r.intro_short || '').trim(),
    intro_long: String(r.intro_long || '').trim(),
    uncertain: Array.isArray(r.uncertain) ? r.uncertain.map(String) : [],
  };
}

function mockResult(item, cat, hasCert) {
  const jade = item.category !== 'coral';
  return {
    title: jade ? '冰種淡綠觀音吊墜' : '阿卡牛血紅珊瑚手串',
    subtype: item.subtype || cat.subtypes[0],
    fields: jade
      ? { color: '淡綠帶白底', texture: '冰種', theme: '觀音', craft: '圓雕，開臉細緻', meaning: '觀音寓意平安護佑、心境祥和', cert_org: hasCert ? '測試鑑定所' : '', cert_result: hasCert ? '天然翡翠（A貨）' : '' }
      : { species: '阿卡', color: '牛血紅', form: '圓珠', meaning: '紅珊瑚象徵吉祥、喜氣', cert_result: hasCert ? '天然珊瑚' : '' },
    intro_short: jade
      ? '冰種淡綠觀音，質地清透溫潤，開臉慈祥細緻，日常佩戴低調耐看，也很適合作為祝福的禮物。'
      : '色澤濃郁的牛血紅珊瑚手串，珠形圓潤飽滿，光澤溫和，日常搭配素色衣著格外亮眼。',
    intro_long: jade
      ? '這件觀音吊墜以冰種翡翠雕琢，底色清透，帶著柔和的淡綠，光線下呈現溫潤的水感。\n\n觀音採圓雕手法，面容慈祥，衣紋線條流暢，細節處理用心。觀音在傳統寓意中象徵平安護佑，適合自己佩戴，也適合送給長輩或重要的人。'
      : '這串珊瑚手串色澤為濃郁的牛血紅，顏色均勻，表面拋光細緻，散發溫和光澤。\n\n紅珊瑚自古被視為吉祥之物，象徵喜氣與好運。尺寸適中，日常配戴或特別場合都很合適。',
    uncertain: ['種水與種類由照片判讀，建議以實物或鑑定書確認', hasCert ? '' : '未上傳鑑定書，鑑定欄位已留空'].filter(Boolean),
  };
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
