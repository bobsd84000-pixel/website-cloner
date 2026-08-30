const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ClaudeMem {
  constructor(storagePath = '.claude-mem') {
    this.storagePath = storagePath;
    this.memoryFile = path.join(storagePath, 'memory.json');
    this.indexFile = path.join(storagePath, 'index.json');
    this.ensureStorage();
  }

  ensureStorage() {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  save(key, value, metadata = {}) {
    const memory = this.loadMemory();
    const hash = crypto.createHash('sha256').update(key).digest('hex');

    memory[hash] = {
      key,
      value,
      timestamp: new Date().toISOString(),
      sessionId: process.env.SESSION_ID || 'unknown',
      metadata,
      hash
    };

    fs.writeFileSync(this.memoryFile, JSON.stringify(memory, null, 2));
    this.updateIndex(hash, key);

    return hash;
  }

  get(key) {
    const memory = this.loadMemory();
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return memory[hash] || null;
  }

  search(pattern) {
    const memory = this.loadMemory();
    const regex = new RegExp(pattern, 'i');
    return Object.values(memory).filter(entry =>
      regex.test(entry.key) || regex.test(JSON.stringify(entry.value))
    );
  }

  getAllBySession(sessionId) {
    const memory = this.loadMemory();
    return Object.values(memory).filter(entry => entry.sessionId === sessionId);
  }

  delete(key) {
    const memory = this.loadMemory();
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    delete memory[hash];
    fs.writeFileSync(this.memoryFile, JSON.stringify(memory, null, 2));
    this.removeFromIndex(hash);
  }

  clear() {
    fs.writeFileSync(this.memoryFile, JSON.stringify({}, null, 2));
    fs.writeFileSync(this.indexFile, JSON.stringify({}, null, 2));
  }

  loadMemory() {
    if (!fs.existsSync(this.memoryFile)) {
      return {};
    }
    const content = fs.readFileSync(this.memoryFile, 'utf-8');
    return content ? JSON.parse(content) : {};
  }

  updateIndex(hash, key) {
    const index = this.loadIndex();
    index[key] = hash;
    fs.writeFileSync(this.indexFile, JSON.stringify(index, null, 2));
  }

  removeFromIndex(hash) {
    const index = this.loadIndex();
    Object.keys(index).forEach(key => {
      if (index[key] === hash) {
        delete index[key];
      }
    });
    fs.writeFileSync(this.indexFile, JSON.stringify(index, null, 2));
  }

  loadIndex() {
    if (!fs.existsSync(this.indexFile)) {
      return {};
    }
    const content = fs.readFileSync(this.indexFile, 'utf-8');
    return content ? JSON.parse(content) : {};
  }

  export() {
    return {
      memory: this.loadMemory(),
      index: this.loadIndex(),
      exportDate: new Date().toISOString()
    };
  }

  import(data) {
    fs.writeFileSync(this.memoryFile, JSON.stringify(data.memory, null, 2));
    fs.writeFileSync(this.indexFile, JSON.stringify(data.index, null, 2));
  }

  getStats() {
    const memory = this.loadMemory();
    const entries = Object.values(memory);

    return {
      totalEntries: entries.length,
      oldestEntry: entries.length ? Math.min(...entries.map(e => new Date(e.timestamp).getTime())) : null,
      newestEntry: entries.length ? Math.max(...entries.map(e => new Date(e.timestamp).getTime())) : null,
      sessionCount: new Set(entries.map(e => e.sessionId)).size,
      storageSize: fs.existsSync(this.memoryFile) ? fs.statSync(this.memoryFile).size : 0
    };
  }
}

module.exports = ClaudeMem;
