// ============================================================
// COMMAND: PORTFOLIO (commands/portfolio.js)
// ============================================================

const { InlineKeyboard } = require('grammy');
const { db } = require('../core/database');
const { COINS, WEBAPP_URL } = require('../core/config');

/**
 * Haupt-Handler für den /portfolio Befehl
 * Wird auch vom Callback-Handler aufgerufen
 */
async function handlePortfolio(ctx) {
  try {
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) return ctx.reply('Starte zuerst mit /start');

    const assets = await db.getAssets(profile.id);
    const prices = await db.getAllPrices();
    
    // Preis-Map für schnellen Zugriff erstellen
    const priceMap = {};
    prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

    let portfolioValue = 0;
    let assetsText = '';

    // Assets durchlaufen und Werte berechnen
    for (const asset of assets) {
      const amt = Number(asset.amount);
      if (amt <= 0) continue;

      const currentPrice = priceMap[asset.symbol] || 0;
      const value = amt * currentPrice;
      const buyValue = amt * Number(asset.avg_buy);
      const pnl = value - buyValue;
      const pnlEmoji = pnl >= 0 ? '📈' : '📉';
      
      portfolioValue += value;
      
      const emoji = COINS[asset.symbol]?.emoji || '';
      assetsText += `${emoji} <b>${asset.symbol}</b>: ${amt.toFixed(6)}\n` +
                    `   Wert: ${value.toFixed(2)}€ | P&L: ${pnlEmoji} ${pnl.toFixed(2)}€\n`;
    }

    const netWorth = Number(profile.balance) + portfolioValue;

    const kb = new InlineKeyboard()
      .webApp('📈 Jetzt traden', WEBAPP_URL)
      .row()
      .text('🔄 Aktualisieren', 'portfolio');

    return ctx.reply(
      `📊 <b>Dein Portfolio</b>\n\n` +
      `💶 Kontostand: <b>${Number(profile.balance).toFixed(2)}€</b>\n` +
      `📦 Asset-Wert: <b>${portfolioValue.toFixed(2)}€</b>\n` +
      `💰 Gesamtvermögen: <b>${netWorth.toFixed(2)}€</b>\n` +
      `📈 Handelsvolumen: ${Number(profile.total_volume).toFixed(2)}€\n\n` +
      (assetsText || '<i>Keine Assets im Besitz</i>\n') +
      `\n🕐 Stand: ${new Date().toLocaleTimeString('de-DE')}`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  } catch (err) {
    console.error('Portfolio Error:', err);
    ctx.reply('❌ Fehler beim Laden deines Portfolios.');
  }
}

module.exports = handlePortfolio;
