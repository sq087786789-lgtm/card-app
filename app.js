// 名片管家 — 主邏輯
// IndexedDB + Tesseract.js OCR + 全文搜尋 + vCard 匯入/匯出

(() => {
  'use strict';

  // ---------- IndexedDB ----------
  const DB_NAME = 'card-app';
  const STORE = 'cards';
  let db;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) {
          const s = d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          s.createIndex('createdAt', 'createdAt');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function tx(mode) {
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  async function dbAll() {
    return new Promise((res, rej) => {
      const r = tx('readonly').getAll();
      r.onsuccess = () => res(r.result.sort((a, b) => b.createdAt - a.createdAt));
      r.onerror = () => rej(r.error);
    });
  }

  async function dbGet(id) {
    return new Promise((res, rej) => {
      const r = tx('readonly').get(Number(id));
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async function dbPut(card) {
    return new Promise((res, rej) => {
      const r = tx('readwrite').put(card);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async function dbDelete(id) {
    return new Promise((res, rej) => {
      const r = tx('readwrite').delete(Number(id));
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  }

  // ---------- OCR + 欄位解析 ----------
  // 解析 OCR 文字 → 嘗試抓出欄位
  function parseCardText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const result = { name: '', company: '', title: '', phone: '', email: '', website: '', address: '', note: '' };

    // Email
    const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (emailMatch) result.email = emailMatch[0];

    // 網站
    const urlMatch = text.match(/(https?:\/\/\S+|www\.\S+)/i);
    if (urlMatch) result.website = urlMatch[0];

    // 電話 — 台灣常見格式
    const phoneMatch = text.match(/(?:\+?886[-\s]?|0)(?:[\s-]?\d){7,10}/);
    if (phoneMatch) result.phone = phoneMatch[0].replace(/\s/g, '');

    // 電話（國際格式 fallback）
    if (!result.phone) {
      const intlMatch = text.match(/\+?\d{1,3}[-\s]?\(?\d{1,4}\)?[-\s]?\d{2,4}[-\s]?\d{2,6}/);
      if (intlMatch) result.phone = intlMatch[0];
    }

    // 地址 — 常見關鍵字
    const addrKeywords = ['路', '街', '段', '號', '樓', '市', '縣', '區', '郵遞區號'];
    for (const line of lines) {
      if (addrKeywords.some(k => line.includes(k)) && line.length < 60) {
        result.address = line;
        break;
      }
    }

    // 公司 — 常見關鍵字
    const companyKeywords = ['公司', '有限', '股份', 'Co.', 'Ltd', 'Inc', 'Corp', 'Group', '科技', '工業', '商行', '企業'];
    for (const line of lines) {
      if (companyKeywords.some(k => line.toLowerCase().includes(k.toLowerCase())) && line.length < 40) {
        result.company = line;
        break;
      }
    }

    // 職稱
    const titleKeywords = ['經理', '總監', '主任', '工程師', '專員', '協理', '副總', '總經理', '董事長', 'CEO', 'CTO', 'Manager', 'Director', 'Engineer'];
    for (const line of lines) {
      if (titleKeywords.some(k => line.includes(k)) && line.length < 30) {
        result.title = line;
        break;
      }
    }

    // 姓名 — 假設剩下的中文 2-4 字短行
    if (!result.name) {
      const candidates = lines.filter(l => /^[\u4e00-\u9fff]{2,4}$/.test(l));
      if (candidates.length) result.name = candidates[0];
    }
    if (!result.name) {
      const candidates = lines.filter(l => /^[A-Z][a-z]+\s[A-Z][a-z]+/.test(l));
      if (candidates.length) result.name = candidates[0];
    }

    // 沒抓到的全進 note
    result.note = lines.join('\n');
    return result;
  }

  async function runOCR(file) {
    const status = document.getElementById('ocrStatus');
    const statusText = document.getElementById('ocrText');
    status.classList.remove('hidden');

    try {
      statusText.textContent = '載入中文辨識引擎...';
      const { data: { text } } = await Tesseract.recognize(file, 'chi_tra+eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            statusText.textContent = `辨識中... ${Math.round(m.progress * 100)}%`;
          }
        }
      });
      status.classList.add('hidden');
      return text;
    } catch (err) {
      status.classList.add('hidden');
      console.error(err);
      alert('OCR 失敗：' + err.message);
      throw err;
    }
  }

  // LLM Vision API OCR（呼叫後端）
  async function runOCRviaAPI(file) {
    const status = document.getElementById('ocrStatus');
    const statusText = document.getElementById('ocrText');
    const apiUrl = getSetting('apiUrl');

    if (!apiUrl) {
      throw new Error('請先在「設定」裡填入後端 API URL');
    }

    status.classList.remove('hidden');
    statusText.textContent = '上傳到後端...';

    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await fetch(apiUrl.replace(/\/$/, '') + '/ocr', {
        method: 'POST',
        body: fd
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const data = await r.json();
      status.classList.add('hidden');
      return data;
    } catch (err) {
      status.classList.add('hidden');
      throw err;
    }
  }

  // 智能派工：依設定選擇引擎，API 失敗自動 fallback 到 Tesseract
  async function smartOCR(file) {
    const engine = getSetting('engine');
    if (engine === 'api') {
      try {
        const result = await runOCRviaAPI(file);
        return { source: 'api', ...result };
      } catch (err) {
        if (confirm(`LLM Vision 失敗：${err.message}\n\n要改用 Tesseract 離線辨識嗎？`)) {
          const text = await runOCR(file);
          const parsed = parseCardText(text);
          return { source: 'tesseract', ...parsed };
        }
        throw err;
      }
    }
    const text = await runOCR(file);
    const parsed = parseCardText(text);
    return { source: 'tesseract', ...parsed };
  }

  // ---------- 表單 ----------
  const form = document.getElementById('cardForm');
  const editPanel = document.getElementById('editPanel');
  const editTitle = document.getElementById('editTitle');
  let editingId = null;
  let pendingImage = null; // dataURL

  function showEdit(card = null, image = null) {
    editingId = card ? card.id : null;
    editTitle.textContent = card ? '編輯名片' : '新名片';
    pendingImage = image;
    document.getElementById('cardImagePreview').src = image || (card && card.image) || '';
    const fields = ['name', 'company', 'title', 'phone', 'email', 'address', 'website', 'note', 'rawText'];
    for (const f of fields) {
      form.elements[f].value = card && card[f] ? card[f] : '';
    }
    editPanel.classList.remove('hidden');
    editPanel.scrollIntoView({ behavior: 'smooth' });
  }

  function hideEdit() {
    editPanel.classList.add('hidden');
    editingId = null;
    pendingImage = null;
    form.reset();
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = {};
    for (const el of form.elements) {
      if (el.name) data[el.name] = el.value.trim();
    }
    if (!data.name && !data.company && !data.phone && !data.email) {
      alert('請至少填一個欄位');
      return;
    }
    const card = editingId
      ? { ...(await dbGet(editingId)), ...data }
      : { ...data, image: pendingImage || '', createdAt: Date.now() };
    if (pendingImage && editingId) card.image = pendingImage;
    await dbPut(card);
    hideEdit();
    renderList();
  });

  document.getElementById('btnCancel').addEventListener('click', hideEdit);

  // ---------- 拍照 / 上傳 ----------
  async function handleImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      const dataUrl = e.target.result;
      try {
        const result = await smartOCR(file);
        showEdit({ ...result, rawText: result.rawText || '' }, dataUrl);
      } catch {
        showEdit(null, dataUrl);
      }
    };
    reader.readAsDataURL(file);
  }

  document.getElementById('cameraInput').addEventListener('change', e => handleImage(e.target.files[0]));
  document.getElementById('fileInput').addEventListener('change', e => handleImage(e.target.files[0]));

  // ---------- 設定（localStorage） ----------
  const SETTINGS_KEY = 'card-app-settings';
  const DEFAULT_SETTINGS = { engine: 'tesseract', apiUrl: '' };

  function getSetting(key) {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return s[key] !== undefined ? s[key] : DEFAULT_SETTINGS[key];
    } catch { return DEFAULT_SETTINGS[key]; }
  }

  function setSetting(key, val) {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    s[key] = val;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  // 設定 Modal
  const settingsModal = document.getElementById('settingsModal');
  const engineSelect = document.getElementById('engineSelect');
  const apiSettings = document.getElementById('apiSettings');
  const apiUrlInput = document.getElementById('apiUrl');

  function openSettings() {
    engineSelect.value = getSetting('engine');
    apiUrlInput.value = getSetting('apiUrl');
    apiSettings.classList.toggle('hidden', engineSelect.value !== 'api');
    document.getElementById('apiTestResult').textContent = '';
    settingsModal.classList.remove('hidden');
  }

  function closeSettings() { settingsModal.classList.add('hidden'); }

  document.getElementById('btnSettings').addEventListener('click', openSettings);
  document.getElementById('settingsClose').addEventListener('click', closeSettings);
  settingsModal.addEventListener('click', e => { if (e.target === settingsModal) closeSettings(); });

  engineSelect.addEventListener('change', () => {
    setSetting('engine', engineSelect.value);
    apiSettings.classList.toggle('hidden', engineSelect.value !== 'api');
  });

  apiUrlInput.addEventListener('change', () => setSetting('apiUrl', apiUrlInput.value.trim()));

  document.getElementById('btnTestApi').addEventListener('click', async () => {
    const out = document.getElementById('apiTestResult');
    const url = apiUrlInput.value.trim();
    if (!url) { out.textContent = '❌ 請填 URL'; out.style.color = 'var(--danger)'; return; }
    out.textContent = '⏳ 測試中...'; out.style.color = 'var(--muted)';
    try {
      const r = await fetch(url.replace(/\/$/, '') + '/health');
      const d = await r.json();
      if (d.ok) {
        out.textContent = `✓ 連線 OK (API key ${d.hasKey ? '已設定' : '⚠️ 未設定'})`;
        out.style.color = d.hasKey ? 'var(--primary)' : 'var(--danger)';
      } else {
        out.textContent = '❌ 回應異常'; out.style.color = 'var(--danger)';
      }
    } catch (err) {
      out.textContent = `❌ 連線失敗：${err.message}`; out.style.color = 'var(--danger)';
    }
  });

  document.getElementById('btnClearAll').addEventListener('click', async () => {
    if (!confirm('真的要清空所有名片？此動作無法復原。')) return;
    const tx = db.transaction(STORE, 'readwrite').objectStore(STORE);
    await new Promise((res, rej) => {
      const r = tx.clear();
      r.onsuccess = res; r.onerror = rej;
    });
    closeSettings();
    await refresh();
  });

  document.getElementById('btnExport2').addEventListener('click', () => {
    closeSettings();
    document.getElementById('btnExport').click();
  });

  // ---------- 列表 + 搜尋 ----------
  const listEl = document.getElementById('cardList');
  const listTitle = document.getElementById('listTitle');
  const emptyHint = document.getElementById('emptyHint');
  let allCards = [];

  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    const q = query.toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return escapeHtml(text);
    return escapeHtml(text.slice(0, idx)) +
      '<mark>' + escapeHtml(text.slice(idx, idx + query.length)) + '</mark>' +
      escapeHtml(text.slice(idx + query.length));
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function renderList() {
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    const filtered = q
      ? allCards.filter(c => {
          const hay = [c.name, c.company, c.title, c.phone, c.email, c.address, c.website, c.note, c.rawText]
            .filter(Boolean).join(' ').toLowerCase();
          return hay.includes(q);
        })
      : allCards;

    listTitle.textContent = `名片列表 (${filtered.length})`;
    emptyHint.classList.toggle('hidden', filtered.length > 0);
    listEl.innerHTML = filtered.map(c => `
      <li class="card-item" data-id="${c.id}">
        <div class="card-avatar">${escapeHtml((c.name || c.company || '?').slice(0, 1))}</div>
        <div class="card-info">
          <div class="card-name">${highlight(c.name || c.company || '(未命名)', q)}</div>
          <div class="card-meta">${highlight([c.company, c.title].filter(Boolean).join(' · ') || c.phone || c.email || '—', q)}</div>
        </div>
      </li>
    `).join('');

    listEl.querySelectorAll('.card-item').forEach(el => {
      el.addEventListener('click', () => openDetail(Number(el.dataset.id)));
    });
  }

  document.getElementById('searchInput').addEventListener('input', renderList);

  // ---------- 詳情 Modal ----------
  const modal = document.getElementById('detailModal');
  const modalBody = document.getElementById('modalBody');

  function openDetail(id) {
    const card = allCards.find(c => c.id === id);
    if (!card) return;
    modalBody.innerHTML = `
      ${card.image ? `<img src="${card.image}" style="width:100%;max-height:240px;object-fit:contain;border-radius:8px;margin-bottom:16px">` : ''}
      <h2 style="margin:0 0 16px">${escapeHtml(card.name || '(未命名)')}</h2>
      ${field('公司', card.company)}
      ${field('職稱', card.title)}
      ${field('電話', card.phone, c => c.phone && `<a href="tel:${c.phone}">${escapeHtml(c.phone)}</a>`)}
      ${field('信箱', card.email, c => c.email && `<a href="mailto:${c.email}">${escapeHtml(c.email)}</a>`)}
      ${field('網站', card.website, c => c.website && `<a href="${escapeHtml(c.website)}" target="_blank">${escapeHtml(c.website)}</a>`)}
      ${field('地址', card.address)}
      ${field('備註', card.note)}
      <div class="detail-actions">
        <button class="secondary-btn" id="btnEdit">✏️ 編輯</button>
        <button class="danger-btn" id="btnDelete">🗑️ 刪除</button>
      </div>
    `;
    modalBody.querySelector('#btnEdit').onclick = () => {
      modal.classList.add('hidden');
      showEdit(card);
    };
    modalBody.querySelector('#btnDelete').onclick = async () => {
      if (!confirm('確定刪除這張名片？')) return;
      await dbDelete(id);
      modal.classList.add('hidden');
      await refresh();
    };
    modal.classList.remove('hidden');
  }

  function field(label, value, render) {
    if (!value) return '';
    return `<div class="detail-row">
      <div class="detail-label">${escapeHtml(label)}</div>
      <div class="detail-value">${render ? render({ [label.toLowerCase()]: value }) : escapeHtml(value)}</div>
    </div>`;
  }

  document.getElementById('modalClose').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

  // ---------- vCard 匯出 / 匯入 ----------
  function toVCard(c) {
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${c.name || ''}`,
      c.name && `N:${c.name};;;;`,
      c.company && `ORG:${c.company}`,
      c.title && `TITLE:${c.title}`,
      c.phone && `TEL;TYPE=CELL:${c.phone}`,
      c.email && `EMAIL:${c.email}`,
      c.website && `URL:${c.website}`,
      c.address && `ADR;TYPE=WORK:;;${c.address};;;;`,
      c.note && `NOTE:${c.note.replace(/\n/g, '\\n')}`,
      'END:VCARD'
    ].filter(Boolean);
    return lines.join('\r\n');
  }

  document.getElementById('btnExport').addEventListener('click', () => {
    if (!allCards.length) { alert('沒有名片可匯出'); return; }
    const vcf = allCards.map(toVCard).join('\r\n');
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cards-${new Date().toISOString().slice(0, 10)}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('vcfImportInput').click();
  });

  document.getElementById('vcfImportInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const cards = parseVCards(text);
    for (const c of cards) {
      await dbPut({ ...c, createdAt: Date.now() });
    }
    alert(`匯入 ${cards.length} 張名片`);
    await refresh();
    e.target.value = '';
  });

  function parseVCards(text) {
    const cards = [];
    const blocks = text.split(/(?=BEGIN:VCARD)/i);
    for (const block of blocks) {
      if (!/BEGIN:VCARD/i.test(block)) continue;
      const card = {};
      for (const line of block.split(/\r?\n/)) {
        const m = line.match(/^([^:;]+):?(.*)$/);
        if (!m) continue;
        const key = m[1].split(';')[0].toUpperCase();
        const val = m[2];
        if (key === 'FN') card.name = val;
        else if (key === 'ORG') card.company = val.split(';')[0];
        else if (key === 'TITLE') card.title = val;
        else if (key === 'TEL') card.phone = val;
        else if (key === 'EMAIL') card.email = val;
        else if (key === 'URL') card.website = val;
        else if (key === 'ADR') card.address = (val.split(';').filter(Boolean).slice(2, 4).join(' ')).trim();
        else if (key === 'NOTE') card.note = val.replace(/\\n/g, '\n');
      }
      if (card.name || card.company || card.phone) cards.push(card);
    }
    return cards;
  }

  // ---------- 啟動 ----------
  async function refresh() {
    allCards = await dbAll();
    renderList();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }

  (async () => {
    db = await openDB();
    await refresh();
  })();
})();