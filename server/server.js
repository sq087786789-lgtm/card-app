// 名片管家後端 - 接收圖片，呼叫 LLM Vision API，回傳結構化名片 JSON
// 支援任何 OpenAI 相容 API（MiniMax、MiniMax、OpenAI、本地 Ollama 等）
//
// 環境變數：
//   LLM_API_KEY      必填，你的 API key
//   LLM_BASE_URL     選填，預設 https://api.minimax.chat/v1
//   LLM_MODEL        選填，預設 MiniMax-VL-01（或 abab6.5s-chat 含 vision）
//   ALLOWED_ORIGIN   選填，CORS 來源，預設 *（GitHub Pages 用）

const express = require('express');
const multer = require('multer');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

app.use(express.json({ limit: '1mb' }));

const API_KEY    = process.env.LLM_API_KEY || '';
const BASE_URL   = (process.env.LLM_BASE_URL || 'https://api.minimax.chat/v1').replace(/\/$/, '');
const MODEL      = process.env.LLM_MODEL    || 'MiniMax-VL-01';
const ORIGIN     = process.env.ALLOWED_ORIGIN || '*';

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/', (req, res) => res.json({
  service: 'card-app-ocr',
  model: MODEL,
  status: API_KEY ? 'ready' : 'no_api_key'
}));

app.get('/health', (req, res) => res.json({ ok: true, hasKey: !!API_KEY }));

// OCR endpoint: 上傳圖片，回傳結構化名片 JSON
app.post('/ocr', upload.single('image'), async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'LLM_API_KEY not configured' });
  if (!req.file) return res.status(400).json({ error: 'no image file' });

  const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

  const prompt = `你是一張名片 OCR 引擎。請仔細讀圖片上的所有文字，並以 JSON 格式回傳欄位。

回傳格式（只回 JSON，不要 markdown、不要解釋）：
{
  "name": "姓名或主要聯絡人（沒就空字串）",
  "company": "公司名稱",
  "title": "職稱 / 頭銜",
  "phone": "電話號碼（含國碼，去空白，原樣輸出）",
  "email": "Email",
  "website": "網站 URL",
  "address": "地址",
  "note": "其他補充資訊（如傳真、分機、其他電話、營業項目）",
  "rawText": "圖片上讀到的全部原文，照順序換行"
}

注意：
- 電話可能有多支（手機、公司電話、傳真），都放 note
- 找不到的欄位就空字串
- rawText 一定要填，這是 fallback 用的
- 一定是合法 JSON`;

  try {
    const r = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: prompt }
          ]
        }],
        temperature: 0.1,
        max_tokens: 800
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('LLM API error', r.status, errText.slice(0, 500));
      return res.status(502).json({ error: `LLM ${r.status}`, detail: errText.slice(0, 300) });
    }

    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || '';

    // 解析 JSON（容忍模型偶爾包 ```json ```）
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'LLM returned no JSON', content });
    }
    let parsed;
    try { parsed = JSON.parse(jsonMatch[0]); }
    catch (e) { return res.status(502).json({ error: 'JSON parse failed', content }); }

    // 補預設值
    const fields = ['name', 'company', 'title', 'phone', 'email', 'website', 'address', 'note', 'rawText'];
    for (const f of fields) if (typeof parsed[f] !== 'string') parsed[f] = '';

    res.json(parsed);
  } catch (err) {
    console.error('OCR error', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`card-app-ocr listening on :${PORT}, model=${MODEL}, key=${API_KEY ? 'set' : 'MISSING'}`);
});