// ============================================================
// KRYPTO TRADING GAME - Telegram Bot (grammY)
// ============================================================
require('dotenv').config();
const { Bot, InlineKeyboard, webhookCallback } = require('grammy');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const express = require('express');
const cors = require('cors');

const fs = require('fs');
const path = require('path');

// ── Version (Single Source of Truth) ─────────────────────────
let VERSION = '0.1';
try { VERSION = fs.readFileSync(path.join(__dirname, 'version.txt'), 'utf8').trim(); } catch (e) {
  try { VERSION = fs.readFileSync(path.join(__dirname, '..', 'version.txt'), 'utf8').trim(); } catch (e2) { /<b> fallback </b>/ }
}

// ── Config ───────────────────────────────────────────────────
const BOT_TOKEN   = process.env.BOT_TOKEN;
const ADMIN_ID    = Number(process.env.ADMIN_ID);
const WEBAPP_URL  = process.env.WEBAPP_URL || 'https://your-webapp.vercel.app';
const PORT        = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // Service-Key für Server-seitige Operationen
);

const bot = new Bot(BOT_TOKEN);

// ── Supported Coins ──────────────────────────────────────────
const COINS = {
  BTC: { name: 'Bitcoin',  gecko: 'bitcoin',  emoji: '₿' },
  ETH: { name: 'Ethereum', gecko: 'ethereum', emoji: 'Ξ' },
  LTC: { name: 'Litecoin', gecko: 'litecoin', emoji: 'Ł' }
};
const FEE_RATE = 0.005; // 0.5%

// HTML-Escape für Telegram (verhindert Crashes bei Sonderzeichen in Namen)
function esc(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// HELPER: Supabase DB Functions
// ============================================================
const db = {
  // --- Profile ---
  async getProfile(telegramId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    return data;
  },

  async createProfile(telegramId, username, firstName) {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        telegram_id: telegramId,
        username: username || null,
        first_name: firstName || 'Trader',
        balance: 10000.00
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateBalance(profileId, newBalance) {
    await supabase
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', profileId);
  },

  async addVolume(profileId, amount) {
    const { data: p } = await supabase
      .from('profiles')
      .select('total_volume')
      .eq('id', profileId)
      .single();
    await supabase
      .from('profiles')
      .update({ total_volume: Number(p.total_volume) + amount })
      .eq('id', profileId);
  },

  // --- Assets ---
  async getAssets(profileId) {
    const { data } = await supabase
      .from('assets')
      .select('*')
      .eq('profile_id', profileId);
    return data || [];
  },

  async getAsset(profileId, symbol) {
    const { data } = await supabase
      .from('assets')
      .select('*')
      .eq('profile_id', profileId)
      .eq('symbol', symbol)
      .single();
    return data;
  },

  async upsertAsset(profileId, symbol, amount, avgBuy) {
    const existing = await db.getAsset(profileId, symbol);
    if (existing) {
      const newAmount = Number(existing.amount) + amount;
      const newAvg = amount > 0
        ? ((Number(existing.amount) * Number(existing.avg_buy)) + (amount * avgBuy)) / newAmount
        : existing.avg_buy;
      await supabase
        .from('assets')
        .update({ amount: newAmount, avg_buy: newAvg })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('assets')
        .insert({
          profile_id: profileId,
          symbol,
          amount,
          avg_buy: avgBuy,
          first_buy: new Date().toISOString()
        });
    }
  },

  // --- Prices ---
  async getCurrentPrice(symbol) {
    const { data } = await supabase
      .from('current_prices')
      .select('price_eur')
      .eq('symbol', symbol)
      .single();
    return data ? Number(data.price_eur) : null;
  },

  async getAllPrices() {
    const { data } = await supabase
      .from('current_prices')
      .select('*');
    return data || [];
  },

  // --- Transactions ---
  async logTransaction(profileId, type, symbol, amount, priceEur, feeEur, totalEur) {
    await supabase.from('transactions').insert({
      profile_id: profileId,
      type, symbol, amount,
      price_eur: priceEur,
      fee_eur: feeEur,
      total_eur: totalEur
    });
  },

  // --- Fee Pool ---
  async addToFeePool(amount) {
    const { data } = await supabase.from('fee_pool').select('total_eur').eq('id', 1).single();
    await supabase
      .from('fee_pool')
      .update({ total_eur: Number(data.total_eur) + amount })
      .eq('id', 1);
  },

  async getFeePool() {
    const { data } = await supabase.from('fee_pool').select('total_eur').eq('id', 1).single();
    return Number(data?.total_eur || 0);
  },

  // --- Leaderboard ---
  async getLeaderboard(limit = 10) {
    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .limit(limit);
    return data || [];
  },

  // --- Season ---
  async getActiveSeason() {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .single();
    return data;
  },

  // --- Pro Requests ---
  async createProRequest(profileId) {
    await supabase.from('pro_requests').insert({ profile_id: profileId });
  },

  async approveProRequest(requestId) {
    const { data: req } = await supabase
      .from('pro_requests')
      .select('profile_id')
      .eq('id', requestId)
      .single();
    if (!req) return false;
    const proUntil = new Date();
    proUntil.setDate(proUntil.getDate() + 30);
    await supabase
      .from('profiles')
      .update({ is_pro: true, pro_until: proUntil.toISOString() })
      .eq('id', req.profile_id);
    await supabase
      .from('pro_requests')
      .update({ status: 'approved' })
      .eq('id', requestId);
    return req.profile_id;
  },

  // --- Bailout ---
  async processBailout(profileId) {
    const { data: p } = await supabase
      .from('profiles')
      .select('balance, bailout_count, bailout_last')
      .eq('id', profileId)
      .single();

    if (Number(p.balance) > 50) return { ok: false, msg: 'Du bist nicht bankrott!' };

    const count = p.bailout_count || 0;

    if (count < 3) {
      // Erste 3x: 1000€
      const newBal = Number(p.balance) + 1000;
      await supabase.from('profiles').update({
        balance: newBal,
        bailout_count: count + 1,
        bailout_last: new Date().toISOString()
      }).eq('id', profileId);
      await db.logTransaction(profileId, 'bailout', null, null, null, 0, 1000);
      return { ok: true, amount: 1000, remaining: 2 - count, msg: `💰 Onkel hat dir 1.000€ geschickt! (${3 - count - 1} Rettungen übrig)` };
    } else {
      // Danach: 50€ alle 30 Min
      if (p.bailout_last) {
        const last = new Date(p.bailout_last);
        const diff = (Date.now() - last.getTime()) / 1000 / 60;
        if (diff < 30) {
          const wait = Math.ceil(30 - diff);
          return { ok: false, msg: `⏳ Onkel braucht noch ${wait} Minuten...` };
        }
      }
      const newBal = Math.min(Number(p.balance) + 50, 500);
      await supabase.from('profiles').update({
        balance: newBal,
        bailout_last: new Date().toISOString()
      }).eq('id', profileId);
      await db.logTransaction(profileId, 'bailout', null, null, null, 0, 50);
      return { ok: true, amount: 50, msg: `💸 Onkel schickt dir 50€ Taschengeld. (Max 500€)` };
    }
  },

  // --- Real Estate ---
  async getRealEstateTypes() {
    const { data } = await supabase.from('real_estate_types').select('*').order('price_eur');
    return data || [];
  },

  async getUserRealEstate(profileId) {
    const { data } = await supabase
      .from('real_estate')
      .select('*, real_estate_types(*)')
      .eq('profile_id', profileId);
    return data || [];
  },

  async collectRent(profileId) {
    const properties = await db.getUserRealEstate(profileId);
    let totalRent = 0;
    const now = new Date();

    for (const prop of properties) {
      const last = new Date(prop.last_collect);
      const hoursElapsed = (now - last) / 1000 / 60 / 60;
      if (hoursElapsed >= 24) {
        const days = Math.floor(hoursElapsed / 24);
        const rent = days * Number(prop.real_estate_types.daily_rent);
        totalRent += rent;
        await supabase.from('real_estate')
          .update({ last_collect: now.toISOString() })
          .eq('id', prop.id);
      }
    }

    if (totalRent > 0) {
      const { data: p } = await supabase.from('profiles')
        .select('balance').eq('id', profileId).single();
      await supabase.from('profiles')
        .update({ balance: Number(p.balance) + totalRent })
        .eq('id', profileId);
      await db.logTransaction(profileId, 'rent', null, null, null, 0, totalRent);
    }
    return totalRent;
  },

  // --- Stats ---
  async getStats() {
    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
    const pool = await db.getFeePool();
    return { userCount, txCount, feePool: pool };
  }
};

// ============================================================
// PRICE FETCHER (CoinGecko → Supabase)
// ============================================================
async function fetchAndStorePrices() {
  try {
    const ids = Object.values(COINS).map(c => c.gecko).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur`;
    const res = await fetch(url);
    const data = await res.json();

    for (const [symbol, info] of Object.entries(COINS)) {
      const price = data[info.gecko]?.eur;
      if (!price) continue;

      // Update current_prices
      await supabase
        .from('current_prices')
        .upsert({ symbol, price_eur: price, updated_at: new Date().toISOString() });

      // Append to market_history
      await supabase
        .from('market_history')
        .insert({ symbol, price_eur: price });
    }
    console.log(`✅ Preise aktualisiert: ${new Date().toISOString()}`);
  } catch (err) {
    console.error('❌ Preis-Fetch Fehler:', err.message);
  }
}

// Check Leverage Liquidations
async function checkLiquidations() {
  const prices = await db.getAllPrices();
  const priceMap = {};
  prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

  const { data: positions } = await supabase
    .from('leverage_positions')
    .select('*, profiles(telegram_id, balance)')
    .eq('is_open', true);

  if (!positions) return;

  for (const pos of positions) {
    const currentPrice = priceMap[pos.symbol];
    if (!currentPrice) continue;

    const isLiquidated = pos.direction === 'long'
      ? currentPrice <= Number(pos.liquidation)
      : currentPrice >= Number(pos.liquidation);

    if (isLiquidated) {
      await supabase.from('leverage_positions')
        .update({
          is_open: false,
          exit_price: currentPrice,
          pnl: -Number(pos.amount_eur),
          closed_at: new Date().toISOString()
        })
        .eq('id', pos.id);

      try {
        await bot.api.sendMessage(pos.profiles.telegram_id,
          `💥 <b>LIQUIDIERT!</b>\n\nDeine ${pos.leverage}x ${pos.direction.toUpperCase()} Position auf ${pos.symbol} wurde liquidiert!\nVerlust: -${Number(pos.amount_eur).toFixed(2)}€`,
          { parse_mode: 'HTML' }
        );
      } catch (e) { /<b> User hat Bot blockiert </b>/ }
    }
  }
}

// Check Price Alerts (Pro)
async function checkPriceAlerts() {
  const prices = await db.getAllPrices();
  const priceMap = {};
  prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

  const { data: alerts } = await supabase
    .from('price_alerts')
    .select('*, profiles(telegram_id)')
    .eq('triggered', false);

  if (!alerts) return;

  for (const alert of alerts) {
    const current = priceMap[alert.symbol];
    if (!current) continue;

    const triggered = alert.direction === 'above'
      ? current >= Number(alert.target_price)
      : current <= Number(alert.target_price);

    if (triggered) {
      await supabase.from('price_alerts')
        .update({ triggered: true })
        .eq('id', alert.id);

      try {
        const dir = alert.direction === 'above' ? '📈 über' : '📉 unter';
        await bot.api.sendMessage(alert.profiles.telegram_id,
          `🔔 <b>PREIS-ALARM!</b>\n\n${alert.symbol} ist ${dir} ${Number(alert.target_price).toFixed(2)}€!\nAktuell: ${current.toFixed(2)}€`,
          { parse_mode: 'HTML' }
        );
      } catch (e) { /<b> Ignore </b>/ }
    }
  }
}

// ============================================================
// BOT COMMANDS
// ============================================================

// /start - Onboarding
bot.command('start', async (ctx) => {
  const tgId = ctx.from.id;
  let profile = await db.getProfile(tgId);

  if (profile) {
    const kb = new InlineKeyboard()
      .webApp('🎮 Trading starten', WEBAPP_URL)
      .row()
      .text('📊 Portfolio', 'portfolio')
      .text('🏆 Rangliste', 'leaderboard');
    return ctx.reply(
      `Willkommen zurück, <b>${esc(profile.first_name)}</b>! 💰\n\nDein Kontostand: <b>${Number(profile.balance).toFixed(2)}€</b>\n🎮 v${VERSION}`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  // Neuer User → Registrierung
  profile = await db.createProfile(tgId, ctx.from.username, ctx.from.first_name);

  // "Brief vom Onkel" → Anpinnen
  const welcomeMsg = await ctx.reply(
    `📨 <b>Ein Brief von Onkel Heinrich</b>\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `<i>Mein lieber ${esc(profile.first_name)},</i>\n\n` +
    `<i>Ich habe dir 10.000€ auf dein Konto überwiesen. Mach was Kluges daraus – ` +
    `investiere in Krypto, kauf dir Immobilien, werde reich!</i>\n\n` +
    `<i>Aber sei vorsichtig... wenn du alles verlierst, kann ich dir nur noch begrenzt helfen.</i>\n\n` +
    `<i>Dein Onkel Heinrich</i> 👴\n\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `💰 <b>Startkapital: 10.000,00€</b>\n` +
    `📈 Verfügbare Coins: BTC, ETH, LTC\n` +
    `💸 Trading-Fee: 0,5%\n\n` +
    `Tippe den Button um loszulegen! 👇`,
    { parse_mode: 'HTML' }
  );

  // Nachricht anpinnen
  try {
    await ctx.api.pinChatMessage(ctx.chat.id, welcomeMsg.message_id);
  } catch (e) { /<b> Kann in Gruppen fehlschlagen </b>/ }

  // Buttons nach kurzer Pause
  setTimeout(async () => {
    const kb = new InlineKeyboard()
      .webApp('🎮 Jetzt traden!', WEBAPP_URL)
      .row()
      .text('📊 Portfolio', 'portfolio')
      .text('ℹ️ Hilfe', 'help');
    await ctx.reply('Bereit zum Traden? 🚀', { reply_markup: kb });
  }, 2000);

  // Admin benachrichtigen
  try {
    await bot.api.sendMessage(ADMIN_ID,
      `🆕 Neuer Spieler!\n👤 ${esc(profile.first_name)} (@${profile.username || 'kein Username'})\n🆔 ${tgId}`
    );
  } catch (e) { /<b> Admin nicht erreichbar </b>/ }
});

// /portfolio
bot.command('portfolio', async (ctx) => handlePortfolio(ctx));

// /rank
bot.command('rank', async (ctx) => handleLeaderboard(ctx));

// /bailout - Rettungsschirm
bot.command('bailout', async (ctx) => {
  const profile = await db.getProfile(ctx.from.id);
  if (!profile) return ctx.reply('Starte zuerst mit /start');

  const result = await db.processBailout(profile.id);
  return ctx.reply(result.msg);
});

// /pro - Pro Version
bot.command('pro', async (ctx) => {
  const profile = await db.getProfile(ctx.from.id);
  if (!profile) return ctx.reply('Starte zuerst mit /start');

  if (profile.is_pro) {
    const until = new Date(profile.pro_until).toLocaleDateString('de-DE');
    return ctx.reply(`✅ Du bist bereits Pro-Mitglied!\nAktiv bis: ${until}`);
  }

  const kb = new InlineKeyboard()
    .text('💳 Pro kaufen (5€/Monat)', 'buy_pro')
    .row()
    .text('❌ Abbrechen', 'close');

  return ctx.reply(
    `⭐ <b>PRO VERSION - 5€/Monat</b>\n\n` +
    `Features:\n` +
    `🔥 Hebelwetten (2x-10x)\n` +
    `🔔 Preis-Alarme bei Dips\n` +
    `🎨 Exklusive Themes\n` +
    `📊 Erweiterte Charts\n` +
    `⚡ Priority Support`,
    { parse_mode: 'HTML', reply_markup: kb }
  );
});

// /rent - Miete einsammeln
bot.command('rent', async (ctx) => {
  const profile = await db.getProfile(ctx.from.id);
  if (!profile) return ctx.reply('Starte zuerst mit /start');

  const rent = await db.collectRent(profile.id);
  if (rent > 0) {
    return ctx.reply(`🏠 Mieteinnahmen eingesammelt: +${rent.toFixed(2)}€`);
  }
  return ctx.reply('⏳ Noch keine Miete verfügbar. (24h-Intervall)');
});

// ============================================================
// ADMIN COMMANDS
// ============================================================
bot.command('admin', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  const stats = await db.getStats();
  const pool = await db.getFeePool();

  const kb = new InlineKeyboard()
    .text('👥 Alle User', 'admin_users')
    .text('💰 Fee Pool', 'admin_pool')
    .row()
    .text('🏆 Season starten', 'admin_new_season')
    .text('🎁 Season auswerten', 'admin_end_season')
    .row()
    .text('📊 Preis-Check', 'admin_prices')
    .text('🔄 Preise fetchen', 'admin_fetch');

  return ctx.reply(
    `🔧 <b>ADMIN DASHBOARD</b> (v${VERSION})\n\n` +
    `👥 User: ${stats.userCount}\n` +
    `📝 Transaktionen: ${stats.txCount}\n` +
    `💰 Fee Pool: ${pool.toFixed(2)}€\n\n` +
    `Letzte Aktualisierung: ${new Date().toLocaleString('de-DE')}`,
    { parse_mode: 'HTML', reply_markup: kb }
  );
});

// Admin: User-Info
bot.command('user', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('Usage: /user <telegram_id>');

  const tgId = Number(args[1]);
  const profile = await db.getProfile(tgId);
  if (!profile) return ctx.reply('User nicht gefunden.');

  const assets = await db.getAssets(profile.id);
  const assetsText = assets
    .filter(a => Number(a.amount) > 0)
    .map(a => `  ${a.symbol}: ${Number(a.amount).toFixed(6)}`)
    .join('\n') || '  (keine)';

  return ctx.reply(
    `👤 <b>User Info</b>\n\n` +
    `Name: ${esc(profile.first_name)}\n` +
    `Username: @${profile.username || '-'}\n` +
    `Telegram ID: ${profile.telegram_id}\n` +
    `Balance: ${Number(profile.balance).toFixed(2)}€\n` +
    `Umsatz: ${Number(profile.total_volume).toFixed(2)}€\n` +
    `Pro: ${profile.is_pro ? '✅' : '❌'}\n` +
    `Bailouts: ${profile.bailout_count}/3\n` +
    `Registriert: ${new Date(profile.created_at).toLocaleDateString('de-DE')}\n\n` +
    `📦 Assets:\n${assetsText}`,
    { parse_mode: 'HTML' }
  );
});

// Admin: Balance setzen
bot.command('setbalance', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const args = ctx.message.text.split(' ');
  if (args.length < 3) return ctx.reply('Usage: /setbalance <telegram_id> <amount>');

  const tgId = Number(args[1]);
  const amount = Number(args[2]);
  const profile = await db.getProfile(tgId);
  if (!profile) return ctx.reply('User nicht gefunden.');

  await db.updateBalance(profile.id, amount);
  return ctx.reply(`✅ Balance von ${esc(profile.first_name)} auf ${amount}€ gesetzt.`);
});

// Admin: Broadcast
bot.command('broadcast', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const text = ctx.message.text.replace('/broadcast ', '');
  if (!text || text === '/broadcast') return ctx.reply('Usage: /broadcast <nachricht>');

  const { data: users } = await supabase.from('profiles').select('telegram_id');
  let sent = 0;
  for (const u of users) {
    try {
      await bot.api.sendMessage(u.telegram_id, `📢 <b>Ankündigung</b>\n\n${text}`, { parse_mode: 'HTML' });
      sent++;
    } catch (e) { /<b> User hat Bot blockiert </b>/ }
  }
  return ctx.reply(`✅ Nachricht an ${sent}/${users.length} User gesendet.`);
});

// ============================================================
// CALLBACK QUERIES (Inline Buttons)
// ============================================================
bot.callbackQuery('portfolio', async (ctx) => {
  await ctx.answerCallbackQuery();
  await handlePortfolio(ctx);
});

bot.callbackQuery('leaderboard', async (ctx) => {
  await ctx.answerCallbackQuery();
  await handleLeaderboard(ctx);
});

bot.callbackQuery('help', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    `📖 <b>Hilfe & Befehle</b>\n\n` +
    `/start - Spiel starten\n` +
    `/portfolio - Dein Portfolio\n` +
    `/rank - Rangliste\n` +
    `/bailout - Rettungsschirm\n` +
    `/rent - Miete einsammeln\n` +
    `/pro - Pro-Version\n\n` +
    `💡 Nutze die Web App zum Traden!`,
    { parse_mode: 'HTML' }
  );
});

bot.callbackQuery('buy_pro', async (ctx) => {
  await ctx.answerCallbackQuery();
  const profile = await db.getProfile(ctx.from.id);
  if (!profile) return;

  await db.createProRequest(profile.id);

  // Admin benachrichtigen
  const kb = new InlineKeyboard()
    .text('✅ Freischalten', `approve_pro:${profile.id}`)
    .text('❌ Ablehnen', `reject_pro:${profile.id}`);

  await bot.api.sendMessage(ADMIN_ID,
    `💳 <b>PRO-ANFRAGE</b>\n\n` +
    `👤 ${esc(profile.first_name)} (@${profile.username || '-'})\n` +
    `🆔 ${profile.telegram_id}\n\n` +
    `Freischalten?`,
    { parse_mode: 'HTML', reply_markup: kb }
  );

  await ctx.reply('✅ Anfrage gesendet! Du wirst benachrichtigt sobald dein Pro-Zugang aktiviert wird.');
});

// Admin: Pro freischalten
bot.callbackQuery(/^approve_pro:/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCallbackQuery('❌');
  const profileId = ctx.callbackQuery.data.split(':')[1];

  const { data: req } = await supabase
    .from('pro_requests')
    .select('id')
    .eq('profile_id', profileId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (req) {
    await db.approveProRequest(req.id);
  } else {
    // Direkt freischalten
    const proUntil = new Date();
    proUntil.setDate(proUntil.getDate() + 30);
    await supabase.from('profiles')
      .update({ is_pro: true, pro_until: proUntil.toISOString() })
      .eq('id', profileId);
  }

  const { data: p } = await supabase.from('profiles')
    .select('telegram_id, first_name')
    .eq('id', profileId)
    .single();

  if (p) {
    try {
      await bot.api.sendMessage(p.telegram_id,
        `⭐ <b>PRO AKTIVIERT!</b>\n\nHerzlichen Glückwunsch! Deine Pro-Version ist jetzt 30 Tage aktiv.\n\n` +
        `Neue Features:\n🔥 Hebelwetten\n🔔 Preis-Alarme\n🎨 Themes`,
        { parse_mode: 'HTML' }
      );
    } catch (e) { /<b> </b>/ }
  }

  await ctx.answerCallbackQuery('✅ Freigeschaltet!');
  await ctx.editMessageText(`✅ Pro für ${esc(p?.first_name)} aktiviert.`);
});

bot.callbackQuery(/^reject_pro:/, async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCallbackQuery('❌');
  await ctx.answerCallbackQuery('❌ Abgelehnt');
  await ctx.editMessageText('❌ Pro-Anfrage abgelehnt.');
});

// Admin: Buttons
bot.callbackQuery('admin_users', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  const { data: users } = await supabase
    .from('profiles')
    .select('first_name, username, telegram_id, balance')
    .order('balance', { ascending: false })
    .limit(20);

  const list = users.map((u, i) =>
    `${i + 1}. ${u.first_name} (@${u.username || '-'}) - ${Number(u.balance).toFixed(0)}€`
  ).join('\n');

  await ctx.reply(`👥 <b>Top 20 User</b>\n\n${list}`, { parse_mode: 'HTML' });
});

bot.callbackQuery('admin_fetch', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery('Fetching...');
  await fetchAndStorePrices();
  const prices = await db.getAllPrices();
  const text = prices.map(p => `${p.symbol}: ${Number(p.price_eur).toFixed(2)}€`).join('\n');
  await ctx.reply(`✅ Preise aktualisiert:\n\n${text}`);
});

bot.callbackQuery('admin_prices', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();
  const prices = await db.getAllPrices();
  const text = prices.map(p =>
    `${COINS[p.symbol]?.emoji || ''} ${p.symbol}: ${Number(p.price_eur).toFixed(2)}€ (${new Date(p.updated_at).toLocaleTimeString('de-DE')})`
  ).join('\n');
  await ctx.reply(`📊 <b>Aktuelle Kurse</b>\n\n${text}`, { parse_mode: 'HTML' });
});

bot.callbackQuery('admin_new_season', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();

  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);

  await supabase.from('seasons').update({ is_active: false }).eq('is_active', true);
  await supabase.from('seasons').insert({
    name: `Season ${start.toLocaleDateString('de-DE')}`,
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    is_active: true
  });
  await supabase.from('fee_pool').update({ total_eur: 0 }).eq('id', 1);

  await ctx.reply(`🏆 Neue Season gestartet!\nEnde: ${end.toLocaleDateString('de-DE')}`);
});

bot.callbackQuery('admin_end_season', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  await ctx.answerCallbackQuery();

  const season = await db.getActiveSeason();
  if (!season) return ctx.reply('Keine aktive Season.');

  const pool = await db.getFeePool();
  const leaders = await db.getLeaderboard(4);

  if (leaders.length === 0) return ctx.reply('Keine Spieler vorhanden.');

  const dist = [0.40, 0.25, 0.15, 0.20]; // 40%, 25%, 15%, 20% (Rest)
  const winners = {};
  let text = `🏆 <b>SEASON ENDE</b>\n\n💰 Fee Pool: ${pool.toFixed(2)}€\n\n`;

  for (let i = 0; i < Math.min(leaders.length, 4); i++) {
    const prize = pool * dist[i];
    const p = leaders[i];
    winners[i + 1] = { id: p.id, telegram_id: p.telegram_id, amount: prize };

    const medal = ['🥇', '🥈', '🥉', '🎖️'][i];
    text += `${medal} ${esc(p.first_name)}: +${prize.toFixed(2)}€\n`;

    // Auszahlen
    const { data: profile } = await supabase.from('profiles')
      .select('balance').eq('id', p.id).single();
    await supabase.from('profiles')
      .update({ balance: Number(profile.balance) + prize })
      .eq('id', p.id);

    try {
      await bot.api.sendMessage(p.telegram_id,
        `${medal} <b>Glückwunsch!</b> Du hast Platz ${i + 1} belegt!\n\n💰 Gewinn: +${prize.toFixed(2)}€`,
        { parse_mode: 'HTML' }
      );
    } catch (e) { /<b> </b>/ }
  }

  await supabase.from('seasons')
    .update({ is_active: false, fee_pool: pool, winners })
    .eq('id', season.id);
  await supabase.from('fee_pool').update({ total_eur: 0 }).eq('id', 1);

  await ctx.reply(text, { parse_mode: 'HTML' });
});

bot.callbackQuery('close', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.deleteMessage();
});

// ============================================================
// HANDLER FUNCTIONS
// ============================================================
async function handlePortfolio(ctx) {
  const profile = await db.getProfile(ctx.from.id);
  if (!profile) return ctx.reply('Starte zuerst mit /start');

  const assets = await db.getAssets(profile.id);
  const prices = await db.getAllPrices();
  const priceMap = {};
  prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

  let portfolioValue = 0;
  let assetsText = '';

  for (const asset of assets) {
    const amt = Number(asset.amount);
    if (amt <= 0) continue;
    const price = priceMap[asset.symbol] || 0;
    const value = amt * price;
    const pnl = value - (amt * Number(asset.avg_buy));
    const pnlEmoji = pnl >= 0 ? '📈' : '📉';
    portfolioValue += value;
    assetsText += `${COINS[asset.symbol]?.emoji || ''} *${asset.symbol}*: ${amt.toFixed(6)}\n` +
      `   Wert: ${value.toFixed(2)}€ | P&L: ${pnlEmoji} ${pnl.toFixed(2)}€\n`;
  }

  const netWorth = Number(profile.balance) + portfolioValue;

  const kb = new InlineKeyboard()
    .webApp('📈 Jetzt traden', WEBAPP_URL)
    .row()
    .text('🔄 Aktualisieren', 'portfolio');

  await ctx.reply(
    `📊 <b>Dein Portfolio</b>\n\n` +
    `💶 Kontostand: *${Number(profile.balance).toFixed(2)}€*\n` +
    `📦 Portfolio: *${portfolioValue.toFixed(2)}€*\n` +
    `💰 Gesamt: *${netWorth.toFixed(2)}€*\n` +
    `📈 Umsatz: ${Number(profile.total_volume).toFixed(2)}€\n\n` +
    (assetsText || '_Keine Assets_\n') +
    `\n🕐 ${new Date().toLocaleTimeString('de-DE')}`,
    { parse_mode: 'HTML', reply_markup: kb }
  );
}

async function handleLeaderboard(ctx) {
  const leaders = await db.getLeaderboard(10);
  const pool = await db.getFeePool();
  const season = await db.getActiveSeason();

  let text = `🏆 <b>RANGLISTE</b>\n\n`;

  if (season) {
    const end = new Date(season.end_date);
    const days = Math.ceil((end - Date.now()) / 1000 / 60 / 60 / 24);
    text += `📅 Season endet in ${days} Tagen\n💰 Fee Pool: ${pool.toFixed(2)}€\n\n`;
  }

  text += `━━ 💎 Reichste Spieler ━━\n`;
  leaders.forEach((l, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
    text += `${medal} ${esc(l.first_name)}: ${Number(l.net_worth).toFixed(0)}€\n`;
  });

  // Meister Gewinn / Verlust
  const { data: topProfit } = await supabase
    .from('transactions')
    .select('profile_id, profiles(first_name)')
    .eq('type', 'sell')
    .order('total_eur', { ascending: false })
    .limit(1)
    .single();

  if (topProfit) {
    text += `\n🏅 Meister-Trader: ${esc(topProfit.profiles?.first_name || '?'}`;
  }

  await ctx.reply(text, { parse_mode: 'HTML' });
}

// ============================================================
// EXPRESS API (für Web App)
// ============================================================
const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', game: 'Krypto Trading Game', version: VERSION }));

// Version endpoint
app.get('/api/version', (req, res) => res.json({ version: VERSION }));

// Auth: Telegram WebApp Data validieren
function parseTelegramUser(req) {
  // In Production: initData validieren!
  // Für Development: telegram_id aus Header/Query
  const tgId = req.headers['x-telegram-id'] || req.query.telegram_id;
  return tgId ? Number(tgId) : null;
}

// GET /api/profile
app.get('/api/profile', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  const profile = await db.getProfile(tgId);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

  const assets = await db.getAssets(profile.id);
  const prices = await db.getAllPrices();

  res.json({ profile, assets, prices });
});

// GET /api/prices
app.get('/api/prices', async (req, res) => {
  const prices = await db.getAllPrices();
  res.json({ prices });
});

// GET /api/chart/:symbol?range=3h|12h|24h
app.get('/api/chart/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const range = req.query.range || '3h';

  const hours = { '3h': 3, '12h': 12, '24h': 24 }[range] || 3;
  const since = new Date(Date.now() - hours <b> 60 </b> 60 * 1000).toISOString();

  const { data } = await supabase
    .from('market_history')
    .select('price_eur, recorded_at')
    .eq('symbol', symbol.toUpperCase())
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true });

  res.json({ symbol: symbol.toUpperCase(), range, data: data || [] });
});

// POST /api/trade (Buy/Sell)
app.post('/api/trade', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  const { action, symbol, amount_eur, amount_crypto } = req.body;

  if (!['buy', 'sell'].includes(action)) return res.status(400).json({ error: 'Ungültige Aktion' });
  if (!COINS[symbol]) return res.status(400).json({ error: 'Unbekannter Coin' });

  const profile = await db.getProfile(tgId);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

  const price = await db.getCurrentPrice(symbol);
  if (!price) return res.status(500).json({ error: 'Kein Kurs verfügbar' });

  try {
    if (action === 'buy') {
      const euroAmount = Number(amount_eur);
      if (euroAmount <= 0) return res.status(400).json({ error: 'Ungültiger Betrag' });

      const fee = euroAmount * FEE_RATE;
      const netAmount = euroAmount - fee;
      const cryptoAmount = netAmount / price;

      if (euroAmount > Number(profile.balance)) {
        return res.status(400).json({ error: 'Nicht genug Guthaben' });
      }

      // Balance abziehen
      await db.updateBalance(profile.id, Number(profile.balance) - euroAmount);
      // Asset gutschreiben
      await db.upsertAsset(profile.id, symbol, cryptoAmount, price);
      // Fee Pool
      await db.addToFeePool(fee);
      // Volume
      await db.addVolume(profile.id, euroAmount);
      // Log
      await db.logTransaction(profile.id, 'buy', symbol, cryptoAmount, price, fee, euroAmount);

      res.json({
        success: true,
        action: 'buy',
        symbol,
        crypto_amount: cryptoAmount,
        euro_spent: euroAmount,
        fee,
        new_balance: Number(profile.balance) - euroAmount
      });

    } else {
      // SELL
      const asset = await db.getAsset(profile.id, symbol);
      if (!asset || Number(asset.amount) <= 0) {
        return res.status(400).json({ error: 'Kein Bestand' });
      }

      const sellAmount = amount_crypto
        ? Math.min(Number(amount_crypto), Number(asset.amount))
        : Number(asset.amount); // Alles verkaufen

      const grossEuro = sellAmount * price;
      const fee = grossEuro * FEE_RATE;
      const netEuro = grossEuro - fee;

      // Asset reduzieren
      await db.upsertAsset(profile.id, symbol, -sellAmount, 0);
      // Balance gutschreiben
      await db.updateBalance(profile.id, Number(profile.balance) + netEuro);
      // Fee Pool
      await db.addToFeePool(fee);
      // Volume
      await db.addVolume(profile.id, grossEuro);
      // Log
      await db.logTransaction(profile.id, 'sell', symbol, sellAmount, price, fee, netEuro);

      res.json({
        success: true,
        action: 'sell',
        symbol,
        crypto_amount: sellAmount,
        euro_received: netEuro,
        fee,
        new_balance: Number(profile.balance) + netEuro
      });
    }
  } catch (err) {
    console.error('Trade error:', err);
    res.status(500).json({ error: 'Trade fehlgeschlagen' });
  }
});

// GET /api/leaderboard
app.get('/api/leaderboard', async (req, res) => {
  const leaders = await db.getLeaderboard(20);
  const pool = await db.getFeePool();
  const season = await db.getActiveSeason();
  res.json({ leaders, pool, season });
});

// GET /api/realestate/types
app.get('/api/realestate/types', async (req, res) => {
  const types = await db.getRealEstateTypes();
  res.json({ types });
});

// GET /api/realestate/mine
app.get('/api/realestate/mine', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });
  const profile = await db.getProfile(tgId);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

  const props = await db.getUserRealEstate(profile.id);
  res.json({ properties: props });
});

// POST /api/realestate/buy
app.post('/api/realestate/buy', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });

  const profile = await db.getProfile(tgId);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

  const { type_id } = req.body;
  const { data: reType } = await supabase
    .from('real_estate_types')
    .select('*')
    .eq('id', type_id)
    .single();

  if (!reType) return res.status(404).json({ error: 'Immobilientyp nicht gefunden' });
  if (Number(profile.total_volume) < Number(reType.min_volume)) {
    return res.status(400).json({ error: `Mindest-Umsatz: ${reType.min_volume}€ (du hast: ${profile.total_volume}€)` });
  }
  if (Number(profile.balance) < Number(reType.price_eur)) {
    return res.status(400).json({ error: 'Nicht genug Guthaben' });
  }

  await db.updateBalance(profile.id, Number(profile.balance) - Number(reType.price_eur));
  await supabase.from('real_estate').insert({ profile_id: profile.id, type_id });

  res.json({ success: true, property: reType.name, cost: reType.price_eur });
});

// POST /api/realestate/collect
app.post('/api/realestate/collect', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });
  const profile = await db.getProfile(tgId);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

  const rent = await db.collectRent(profile.id);
  const updated = await db.getProfile(tgId);
  res.json({ rent_collected: rent, new_balance: Number(updated.balance) });
});

// GET /api/collectibles/types
app.get('/api/collectibles/types', async (req, res) => {
  const { data } = await supabase.from('collectible_types').select('*').order('price_eur');
  res.json({ types: data });
});

// GET /api/collectibles/mine
app.get('/api/collectibles/mine', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });
  const profile = await db.getProfile(tgId);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

  const { data } = await supabase
    .from('collectibles')
    .select('*, collectible_types(*)')
    .eq('profile_id', profile.id);
  res.json({ collectibles: data });
});

// POST /api/collectibles/buy
app.post('/api/collectibles/buy', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });
  const profile = await db.getProfile(tgId);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

  const { type_id } = req.body;
  const { data: cType } = await supabase
    .from('collectible_types')
    .select('*')
    .eq('id', type_id)
    .single();

  if (!cType) return res.status(404).json({ error: 'Typ nicht gefunden' });
  if (Number(profile.total_volume) < Number(cType.min_volume)) {
    return res.status(400).json({ error: `Mindest-Umsatz: ${cType.min_volume}€` });
  }

  // Haltedauer-Check: User muss min_hold_h Stunden lang Assets gehalten haben
  const { data: assets } = await supabase
    .from('assets')
    .select('first_buy')
    .eq('profile_id', profile.id)
    .not('first_buy', 'is', null)
    .order('first_buy', { ascending: true })
    .limit(1);

  if (!assets || assets.length === 0) {
    return res.status(400).json({ error: 'Du musst zuerst Krypto kaufen und halten' });
  }

  const holdHours = (Date.now() - new Date(assets[0].first_buy).getTime()) / 1000 / 60 / 60;
  if (holdHours < cType.min_hold_h) {
    return res.status(400).json({ error: `Mindest-Haltedauer: ${cType.min_hold_h}h (du: ${holdHours.toFixed(1)}h)` });
  }

  if (Number(profile.balance) < Number(cType.price_eur)) {
    return res.status(400).json({ error: 'Nicht genug Guthaben' });
  }

  await db.updateBalance(profile.id, Number(profile.balance) - Number(cType.price_eur));
  await supabase.from('collectibles').insert({ profile_id: profile.id, type_id });

  res.json({ success: true, item: cType.name, cost: cType.price_eur });
});

// POST /api/leverage/open (Pro only)
app.post('/api/leverage/open', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });
  const profile = await db.getProfile(tgId);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });
  if (!profile.is_pro) return res.status(403).json({ error: 'Pro-Version benötigt' });

  const { symbol, direction, leverage, amount_eur } = req.body;
  if (!COINS[symbol]) return res.status(400).json({ error: 'Unbekannter Coin' });
  if (!['long', 'short'].includes(direction)) return res.status(400).json({ error: 'long oder short' });
  if (leverage < 2 || leverage > 10) return res.status(400).json({ error: 'Hebel: 2-10' });
  if (Number(amount_eur) > Number(profile.balance)) return res.status(400).json({ error: 'Nicht genug Guthaben' });

  const price = await db.getCurrentPrice(symbol);
  if (!price) return res.status(500).json({ error: 'Kein Kurs' });

  const liqPrice = direction === 'long'
    ? price <b> (1 - 1 / leverage)
    : price </b> (1 + 1 / leverage);

  await db.updateBalance(profile.id, Number(profile.balance) - Number(amount_eur));

  const { data: pos } = await supabase.from('leverage_positions').insert({
    profile_id: profile.id,
    symbol, direction, leverage,
    entry_price: price,
    amount_eur: Number(amount_eur),
    liquidation: liqPrice
  }).select().single();

  await db.logTransaction(profile.id, 'leverage', symbol, null, price, 0, Number(amount_eur));

  res.json({ success: true, position: pos });
});

// POST /api/leverage/close
app.post('/api/leverage/close', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });
  const profile = await db.getProfile(tgId);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

  const { position_id } = req.body;
  const { data: pos } = await supabase
    .from('leverage_positions')
    .select('*')
    .eq('id', position_id)
    .eq('profile_id', profile.id)
    .eq('is_open', true)
    .single();

  if (!pos) return res.status(404).json({ error: 'Position nicht gefunden' });

  const price = await db.getCurrentPrice(pos.symbol);
  const priceDiff = price - Number(pos.entry_price);
  const pnlMultiplier = pos.direction === 'long' ? 1 : -1;
  const pnlPercent = (priceDiff / Number(pos.entry_price)) <b> pos.leverage </b> pnlMultiplier;
  const pnl = Number(pos.amount_eur) * pnlPercent;
  const payout = Math.max(0, Number(pos.amount_eur) + pnl);

  await supabase.from('leverage_positions').update({
    is_open: false,
    exit_price: price,
    pnl,
    closed_at: new Date().toISOString()
  }).eq('id', pos.id);

  await db.updateBalance(profile.id, Number(profile.balance) + payout);

  res.json({ success: true, pnl, payout, exit_price: price });
});

// GET /api/leverage/positions
app.get('/api/leverage/positions', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });
  const profile = await db.getProfile(tgId);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

  const { data } = await supabase
    .from('leverage_positions')
    .select('*')
    .eq('profile_id', profile.id)
    .eq('is_open', true);

  const prices = await db.getAllPrices();
  const priceMap = {};
  prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

  const positions = (data || []).map(pos => {
    const currentPrice = priceMap[pos.symbol] || Number(pos.entry_price);
    const priceDiff = currentPrice - Number(pos.entry_price);
    const pnlMultiplier = pos.direction === 'long' ? 1 : -1;
    const pnlPercent = (priceDiff / Number(pos.entry_price)) <b> pos.leverage </b> pnlMultiplier;
    const pnl = Number(pos.amount_eur) * pnlPercent;
    return { ...pos, current_price: currentPrice, unrealized_pnl: pnl };
  });

  res.json({ positions });
});

// POST /api/alert (Pro only)
app.post('/api/alert', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });
  const profile = await db.getProfile(tgId);
  if (!profile || !profile.is_pro) return res.status(403).json({ error: 'Pro benötigt' });

  const { symbol, target_price, direction } = req.body;
  await supabase.from('price_alerts').insert({
    profile_id: profile.id, symbol, target_price, direction
  });
  res.json({ success: true });
});

// GET /api/transactions
app.get('/api/transactions', async (req, res) => {
  const tgId = parseTelegramUser(req);
  if (!tgId) return res.status(401).json({ error: 'Nicht autorisiert' });
  const profile = await db.getProfile(tgId);
  if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50);

  res.json({ transactions: data || [] });
});

// ============================================================
// CRON JOBS
// ============================================================

// Preise alle 60 Sekunden aktualisieren
cron.schedule('<b> </b> <b> </b> *', async () => {
  await fetchAndStorePrices();
  await checkLiquidations();
  await checkPriceAlerts();
});

// Alte Market History aufräumen (älter als 7 Tage)
cron.schedule('0 3 <b> </b> *', async () => {
  const cutoff = new Date(Date.now() - 7 <b> 24 </b> 60 <b> 60 </b> 1000).toISOString();
  await supabase.from('market_history').delete().lt('recorded_at', cutoff);
  console.log('🧹 Alte Markt-Daten bereinigt');
});

// Season-Check (automatisches Ende)
cron.schedule('0 0 <b> </b> *', async () => {
  const season = await db.getActiveSeason();
  if (season && new Date(season.end_date) <= new Date()) {
    console.log('🏆 Season automatisch beendet - Admin muss /admin → Season auswerten klicken');
    try {
      await bot.api.sendMessage(ADMIN_ID, '🏆 Die aktuelle Season ist abgelaufen! Bitte auswerten via /admin');
    } catch (e) { /<b> </b>/ }
  }
});

// ============================================================
// ERROR HANDLER (verhindert Crashes bei alten Callbacks etc.)
// ============================================================
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`❌ Fehler bei Update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e.description?.includes('query is too old')) {
    console.log('  → Alte Callback-Query ignoriert (normal nach Neustart)');
  } else {
    console.error('  →', e.message || e);
  }
});

// ============================================================
// START
// ============================================================
async function start() {
  // Initial price fetch
  await fetchAndStorePrices();
  console.log('✅ Initiale Preise geladen');

  // Express Server starten
  app.listen(PORT, () => {
    console.log(`🌐 API Server läuft auf Port ${PORT}`);
  });

  // Bot starten – drop_pending_updates überspringt alte Nachrichten vom letzten Crash
  bot.start({
    drop_pending_updates: true,
    onStart: (info) => console.log(`🤖 Bot gestartet: @${info.username}`)
  });
}

start().catch(console.error);

// Graceful Shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
