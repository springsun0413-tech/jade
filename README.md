# 珠寶介紹工具（翡翠・珊瑚）

手機拍照 → AI 判讀並寫介紹 → 編輯 → 定版發佈成分享網頁（單件或作品集）。

- 前端：React + Vite（PWA，可加到手機主畫面）
- 後端：Cloudflare Workers，照片存 R2，資料存 D1
- AI：Claude API（看圖判讀、讀鑑定書、寫文案）

## 功能

| 頁面 | 說明 |
|---|---|
| 作品 | 列表、搜尋、依類別篩選；「選取建立作品集」可勾多件產生一個分享網址 |
| 新增 | 選翡翠／珊瑚、品項，拍照或從相簿選；照片可標成「鑑定書」 |
| 編輯 | AI 判讀並填入欄位與介紹；欄位分外觀、規格、鑑定資訊；短介紹（LINE）與完整介紹 |
| 定版發佈 | 分享頁只顯示最後一次定版的內容，之後修改要按「更新定版」才會生效 |
| 作品集 | 複製連結、開啟、刪除 |
| 設定 | 店名、聯絡方式（顯示在分享頁）、文案範例（AI 模仿語氣） |

分享網址：單件 `/p/<id>`，作品集 `/c/<id>`。鑑定書照片不會出現在分享頁，分享頁也不顯示價格。

AI 規則：沒有鑑定書照片時，鑑定機構、證書編號、鑑定結果一律留空；AI 不從照片判定 A/B/C 貨或珊瑚是否天然。

## 本機開發（PowerShell）

```powershell
cd C:\path\to\jade-coral-tool
npm install
Copy-Item .dev.vars.example .dev.vars   # 編輯 .dev.vars：設定密碼；MOCK_AI=1 可不花 API 費用測介面
npm run db:init:local
npm run dev                             # 開 http://127.0.0.1:8787
```

改前端時可另開一個視窗跑 `npm run dev:ui`（Vite 熱更新，API 自動轉到 8787）。

## 部署到 Cloudflare（PowerShell）

D1 資料庫 `jade-coral-db`、R2 `jade-coral-photos` 和資料表已在 Springsun0413 帳號建好，`wrangler.jsonc` 已填入帳號和資料庫 ID。

```powershell
cd C:\path\to\jade-coral-tool
npm install
npx wrangler login                            # 用 springsun0413 登入
npm run deploy
npx wrangler secret put EDIT_PASSWORD         # 編輯密碼
npx wrangler secret put ANTHROPIC_API_KEY     # Claude API 金鑰
```

網址：https://jade-coral-tool.springsun0413.workers.dev

之後改程式只要再跑 `npm run deploy`。新增資料表欄位時，在 `migrations/` 加新檔再跑 `npm run db:init:remote`。

AI 模型在 `wrangler.jsonc` 的 `vars.MODEL` 設定（預設 `claude-sonnet-5-5`）。

## 檔案結構

```
shared/categories.js   類別、品項、欄位定義（前後端共用，要加欄位改這裡）
worker/index.js        API 與路由
worker/ai.js           Claude 判讀與提示詞
worker/pages.js        分享頁 HTML
migrations/            D1 資料表
src/                   前端（App / NewItem / EditItem）
```
