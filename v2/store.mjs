import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { cleanCard, duplicateCards } from './public/model.js';

export class Store {
  constructor(file) {
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS cards(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL, deleted_at TEXT);
      CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY, card_id TEXT, mime TEXT NOT NULL, bytes BLOB NOT NULL, drive_id TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, card_id TEXT, actor TEXT NOT NULL, action TEXT NOT NULL, at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS members(email TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('owner','staff')), active INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, email TEXT NOT NULL, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS oauth(state TEXT PRIMARY KEY, verifier TEXT NOT NULL, purpose TEXT NOT NULL, expires INTEGER NOT NULL, session_id TEXT);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  }
  list(includeDeleted=false) {
    return this.db.prepare('SELECT * FROM cards' + (includeDeleted ? '' : ' WHERE deleted_at IS NULL')).all().map(r=>({...JSON.parse(r.body), id:r.id, revision:r.revision, deletedAt:r.deleted_at})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }
  get(id) { const r=this.db.prepare('SELECT * FROM cards WHERE id=?').get(id); return r ? {...JSON.parse(r.body),id:r.id,revision:r.revision,deletedAt:r.deleted_at} : null; }
  save(input, actor, id=null, force=false) {
    const data=cleanCard(input); const old=id ? this.get(id) : null;
    if (id && (!old || old.deletedAt)) throw Object.assign(new Error('找不到這張名片。'),{status:404});
    if (old && old.revision !== input.revision) throw Object.assign(new Error('另一位同事剛修改了這張名片。請重新開啟後再編輯。'),{status:409});
    const duplicates=duplicateCards({...data,id},this.list());
    if (duplicates.length && !force) throw Object.assign(new Error('找到相同電話或 Email，請確認是否仍要新增。'),{status:409,duplicates:duplicates.map(c=>({id:c.id,name:c.name,company:c.company}))});
    const photoIds=Array.isArray(input.photoIds) ? [...new Set(input.photoIds)].slice(0,2) : old?.photoIds || [];
    for(const pid of photoIds) { const p=this.db.prepare('SELECT card_id FROM photos WHERE id=?').get(pid); if(!p || (p.card_id && p.card_id!==id)) throw Object.assign(new Error('照片不存在或已屬於其他名片。'),{status:400}); }
    const now=new Date().toISOString(); id ||= randomUUID();
    const body={...data,photoIds,createdAt:old?.createdAt || now,updatedAt:now,updatedBy:actor};
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if(old) { const r=this.db.prepare('UPDATE cards SET body=?,revision=revision+1 WHERE id=? AND revision=? AND deleted_at IS NULL').run(JSON.stringify(body),id,input.revision); if(!r.changes) throw Object.assign(new Error('資料已更新，請重新整理。'),{status:409}); }
      else this.db.prepare('INSERT INTO cards(id,revision,body) VALUES(?,1,?)').run(id,JSON.stringify(body));
      for(const pid of photoIds) this.db.prepare('UPDATE photos SET card_id=? WHERE id=?').run(id,pid);
      this.log(id,actor,old ? '修改名片' : '新增名片'); this.db.exec('COMMIT');
    } catch(e) { this.db.exec('ROLLBACK'); throw e; }
    return this.get(id);
  }
  trash(id,revision,actor,restore=false) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const r=this.db.prepare('UPDATE cards SET deleted_at=?,revision=revision+1 WHERE id=? AND revision=?').run(restore ? null : new Date().toISOString(),id,revision);
      if(!r.changes) throw Object.assign(new Error('資料已更新，請重新整理。'),{status:409});
      this.log(id,actor,restore?'還原名片':'移至回收筒'); this.db.exec('COMMIT');
    } catch(e) { this.db.exec('ROLLBACK'); throw e; }
  }
  log(id,actor,action) { this.db.prepare('INSERT INTO audit(card_id,actor,action,at) VALUES(?,?,?,?)').run(id,actor,action,new Date().toISOString()); }
  setting(key,value) { if(value!==undefined) this.db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,value); return this.db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value; }
  close() { this.db.close(); }
}
