const { db } = require('../core/database');

const activeCache = new Map();
const proCache = new Map(); // Neuer Cache für Pro/Admin Status (spart DB-Queries in leverageRoutes)

async function parseTelegramUser(req) {
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

  // 3. Activity Tracking & Pro-Status Validation
  if (parsedId && db && db.supabase) {
    const now = Date.now();
    const lastUpdate = activeCache.get(parsedId) || 0;
    
    // Alle 5 Minuten last_active in DB aktualisieren
    if (now - lastUpdate > 300000) {
      activeCache.set(parsedId, now);
      
      // Update last_active und hole gleichzeitig Admin/Pro Status
      db.supabase.from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('telegram_id', parsedId)
        .select('is_admin, is_pro, pro_until')
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const isPro = data.is_admin || (data.is_pro && new Date(data.pro_until) > new Date());
            proCache.set(parsedId, { isPro, isAdmin: !!data.is_admin });
          }
        })
        .catch((err) => console.error("Auth: DB Sync failed", err));
    }
  }

  return parsedId;
}

// Hilfsfunktion für Routes, um schnell Rechte zu prüfen
function getUserPermissions(tgId) {
  return proCache.get(Number(tgId)) || { isPro: false, isAdmin: false };
}

module.exports = { parseTelegramUser, getUserPermissions };
