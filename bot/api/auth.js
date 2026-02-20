const { db } = require('../core/database');

const activeCache = new Map();

function parseTelegramUser(req) {
  let tgId = null;

  // 1. Suche nach InitData (Standard für Telegram Mini Apps)
  const initDataHeader = req.headers['x-telegram-init-data'];
  if (initDataHeader) {
    try {
      const searchParams = new URLSearchParams(initDataHeader);
      const userJSON = searchParams.get('user');
      if (userJSON) {
        const user = JSON.parse(userJSON);
        tgId = user.id;
      }
    } catch (e) {
      console.error("Auth: Error parsing initDataHeader", e);
    }
  }

  // 2. Fallback auf direkten Header oder Query (für Legacy/Debugging)
  if (!tgId) {
    tgId = req.headers['x-telegram-id'] || req.query.telegram_id;
  }

  const parsedId = tgId ? Number(tgId) : null;

  // 3. Activity Tracking & DB Update
  if (parsedId && db && db.supabase) {
    const now = Date.now();
    const lastUpdate = activeCache.get(parsedId) || 0;
    
    if (now - lastUpdate > 300000) {
      activeCache.set(parsedId, now);
      db.supabase.from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('telegram_id', parsedId)
        .then(() => {})
        .catch((err) => console.error("Auth: DB Update failed", err));
    }
  }

  return parsedId;
}

module.exports = { parseTelegramUser };
