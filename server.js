const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
// If a Railway volume is mounted, DATA_DIR should point at it so the
// leaderboard survives restarts/redeploys. Falls back to a local folder.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(__dirname));

function filePath(type) {
  const safe = type === 'speed' ? 'speed' : 'score';
  return path.join(DATA_DIR, 'leaderboard_' + safe + '.json');
}

function loadBoard(type) {
  try {
    const raw = fs.readFileSync(filePath(type), 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) { /* file may not exist yet, that's fine */ }
  return [];
}

function saveBoard(type, list) {
  fs.writeFileSync(filePath(type), JSON.stringify(list));
}

function dedupeBest(list) {
  const byName = new Map();
  for (const entry of list) {
    const existing = byName.get(entry.name);
    if (!existing || entry.score > existing.score) byName.set(entry.name, entry);
  }
  return Array.from(byName.values()).sort((a, b) => b.score - a.score);
}

app.get('/api/leaderboard/:type', (req, res) => {
  const list = dedupeBest(loadBoard(req.params.type)).slice(0, 50);
  res.json(list);
});

app.post('/api/leaderboard/:type', (req, res) => {
  const { name, score, extra } = req.body || {};
  if (!name || typeof name !== 'string' || typeof score !== 'number' || !isFinite(score)) {
    return res.status(400).json({ error: 'invalid payload' });
  }
  const cleanName = name.slice(0, 16);
  let list = loadBoard(req.params.type);
  const existing = list.find(e => e.name === cleanName);
  if (existing) {
    if (score > existing.score) { existing.score = score; existing.extra = extra; existing.ts = Date.now(); }
  } else {
    list.push({ name: cleanName, score, extra, ts: Date.now() });
  }
  list = dedupeBest(list).slice(0, 50);
  saveBoard(req.params.type, list);
  res.json(list);
});

app.listen(PORT, () => {
  console.log('WORDFALL server running on port ' + PORT + ' (data dir: ' + DATA_DIR + ')');
});
