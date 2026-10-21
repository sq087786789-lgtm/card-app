export const fields = ['name','company','title','mobile','phone','extension','fax','email','website','line','address','category','note','rawText'];
export const categories = ['未分類','客戶','供應商','合作夥伴','其他'];
export function cleanCard(input) {
  const out = {};
  for (const k of fields) out[k] = typeof input[k] === 'string' ? input[k].trim().slice(0, k === 'rawText' || k === 'note' ? 12000 : 500) : '';
  if (!categories.includes(out.category)) out.category = '未分類';
  out.reviewed = input.reviewed === true;
  if (!out.name && !out.company && !out.phone && !out.mobile && !out.email) throw new Error('至少填寫姓名、公司、電話或 Email 其中一項。');
  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw new Error('Email 格式不正確，請確認。');
  if (out.website) {
    if (!/^https?:\/\//i.test(out.website)) out.website = 'https://' + out.website;
    try { const u = new URL(out.website); if (!['http:','https:'].includes(u.protocol) || !u.hostname.includes('.')) throw 0; } catch { throw new Error('網站網址格式不正確。'); }
  }
  return out;
}
export function duplicateCards(card, cards) {
  const digits = s => (s || '').replace(/\D/g,'').replace(/^8860?/, '0');
  const phones = [card.phone,card.mobile].map(digits).filter(Boolean);
  return cards.filter(c => c.id !== card.id && !c.deletedAt && ((card.email && card.email.toLowerCase() === (c.email || '').toLowerCase()) || [c.phone,c.mobile].map(digits).some(p=>p && phones.includes(p))));
}
export function vcf(cards) {
  const esc = s => (s || '').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  return cards.map(c => ['BEGIN:VCARD','VERSION:3.0','FN:'+esc(c.name || c.company),'N:'+esc(c.name)+';;;;',c.company && 'ORG:'+esc(c.company),c.title && 'TITLE:'+esc(c.title),c.mobile && 'TEL;TYPE=CELL:'+esc(c.mobile),c.phone && 'TEL;TYPE=WORK:'+esc(c.phone)+(c.extension ? ';ext='+esc(c.extension) : ''),c.fax && 'TEL;TYPE=FAX:'+esc(c.fax),c.email && 'EMAIL:'+esc(c.email),c.website && 'URL:'+esc(c.website),c.address && 'ADR;TYPE=WORK:;;'+esc(c.address)+';;;;',c.note && 'NOTE:'+esc(c.note),'END:VCARD'].filter(Boolean).join('\r\n')).join('\r\n');
}
export function parseVCF(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g,'');
  const unesc = v => v.replace(/\\n/gi,'\n').replace(/\\([,;\\])/g,'$1');
  return unfolded.split(/BEGIN:VCARD/i).slice(1).map(block=>{
    const c = {};
    for (const line of block.split(/\r?\n/)) {
      const i = line.indexOf(':'); if (i < 0) continue;
      const key = line.slice(0,i).toUpperCase(); const val = unesc(line.slice(i+1));
      if (key === 'FN') c.name = val;
      if (key === 'ORG') c.company = val;
      if (key === 'TITLE') c.title = val;
      if (key.startsWith('TEL')) c[/FAX/.test(key) ? 'fax' : /CELL/.test(key) ? 'mobile' : 'phone'] = val;
      if (key.startsWith('EMAIL')) c.email = val;
      if (key === 'URL') c.website = val;
      if (key.startsWith('ADR')) c.address = val.replace(/^;;/,'').replace(/;+/g,' ').trim();
      if (key === 'NOTE') c.note = val;
    }
    return c;
  }).filter(c=>c.name || c.company || c.phone || c.mobile || c.email);
}
