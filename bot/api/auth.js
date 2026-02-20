const { db } = require('../core/database');

const activeCache = new Map();
const proCache = new Map();

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

  // 2. Fallback auf direkten Header oder Query
  if (!tgId) {
    tgId = req.headers['x-telegram-id'] || req.query.telegram_id;
  }

  const parsedId = tgId ? Number(tgId) : null;
  if (!parsedId) return null;

  // 3. Activity Tracking & Berechtigungs-Sync (Synchronisiert für v0.3.0)
  try {
    const now = Date.now();
    const lastUpdate = activeCache.get(parsedId) || 0;
    
    // WICHTIG: Wenn kein Cache existiert ODER die 5 Minuten um sind, müssen wir WARTEN (await)
    if (!proCache.has(parsedId) || (now - lastUpdate > 300000)) {
      const { data, error } = await db.supabase
        .from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('telegram_id', parsedId)
        .select('is_admin, is_pro, pro_until')
        .maybeSingle();

      if (data) {
        const isPro = data.is_admin || (data.is_pro && new Date(data.pro_until) > new Date());
        proCache.set(parsedId, { isPro, isAdmin: !!data.is_admin });
        activeCache.set(parsedId, now);
      } else if (error) {
        console.error("Auth DB Sync Error:", error.message);
      }
    }
  } catch (err) {
    console.error("Critical Auth Error:", err);
  }

  return parsedId;
}

function getUserPermissions(tgId) {
  return proCache.get(Number(tgId)) || { isPro: false, isAdmin: false };
}

module.exports = { parseTelegramUser, getUserPermissions };
