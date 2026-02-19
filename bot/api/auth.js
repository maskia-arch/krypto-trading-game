const { db } = require('../core/database');

const activeCache = new Map();

function parseTelegramUser(req) {
  const tgId = req.headers['x-telegram-id'] || req.query.telegram_id;
  const parsedId = tgId ? Number(tgId) : null;

  if (parsedId && db && db.supabase) {
    const now = Date.now();
    const lastUpdate = activeCache.get(parsedId) || 0;
    
    if (now - lastUpdate > 300000) {
      activeCache.set(parsedId, now);
      db.supabase.from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('telegram_id', parsedId)
        .then(() => {})
        .catch(() => {});
    }
  }

  return parsedId;
}

module.exports = { parseTelegramUser };
