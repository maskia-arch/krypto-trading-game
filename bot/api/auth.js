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

  // 3. v0.3.24: Berechtigungs-Sync (SELECT getrennt von UPDATE)
  try {
    const now = Date.now();
    const lastUpdate = activeCache.get(parsedId) || 0;
    
    if (!proCache.has(parsedId) || (now - lastUpdate > 300000)) {
      // ERST: Berechtigungen laden (darf nicht an Update-Fehler scheitern)
      const { data, error } = await db.supabase
        .from('profiles')
        .select('is_admin, is_pro, pro_until')
        .eq('telegram_id', parsedId)
        .maybeSingle();

      if (data) {
        // v0.3.24: Admin-Status auch via ADMIN_ID env var erkennen
        const envAdmin = Number(process.env.ADMIN_ID) === parsedId;
        const isAdmin = !!data.is_admin || envAdmin;
        const isPro = isAdmin || (data.is_pro && new Date(data.pro_until) > new Date());
        
        proCache.set(parsedId, { isPro, isAdmin });
        activeCache.set(parsedId, now);

        // v0.3.24: is_admin in DB synchronisieren falls nötig
        if (envAdmin && !data.is_admin) {
          db.supabase.from('profiles').update({ is_admin: true }).eq('telegram_id', parsedId).then(() => {});
        }
      } else if (error) {
        console.error("Auth DB Read Error:", error.message);
      }

      // DANN: Activity-Tracking (fire-and-forget, darf fehlschlagen)
      db.supabase
        .from('profiles')
        .update({ last_active: new Date().toISOString() })
        .eq('telegram_id', parsedId)
        .then(() => {})
        .catch(() => {});
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
