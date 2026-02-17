const { InlineKeyboard } = require('grammy');
const { db } = require('../core/database');
const { COINS, WEBAPP_URL } = require('../core/config');

async function handlePortfolio(ctx) {
  try {
    const profile = await db.getProfile(ctx.from.id);
    if (!profile) {
      const msg = 'Starte zuerst mit /start';
      return ctx.callbackQuery ? ctx.answerCallbackQuery(msg) : ctx.reply(msg);
    }

    const assets = await db.getAssets(profile.id);
    const prices = await db.getAllPrices();
    
    const priceMap = {};
    prices.forEach(p => priceMap[p.symbol] = Number(p.price_eur));

    let portfolioValue = 0;
    let assetsText = '';

    for (const asset of assets) {
      const amt = Number(asset.amount);
      if (amt <= 0) continue;

      const currentPrice = priceMap[asset.symbol] || 0;
      const avgBuy = Number(asset.avg_buy) || 0;
      const value = amt * currentPrice;
      const buyValue = amt * avgBuy;
      const pnl = value - buyValue;
      
      let pnlPercent = 0;
      if (avgBuy > 0) {
        pnlPercent = ((currentPrice - avgBuy) / avgBuy) * 100;
      }

      const pnlEmoji = pnl >= 0 ? '📈' : '📉';
      const sign = pnl >= 0 ? '+' : '';
      
      portfolioValue += value;
      
      const emoji = COINS[asset.symbol]?.emoji || '';
      const formattedValue = value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const formattedPnl = pnl.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      assetsText += `${emoji} <b>${asset.symbol}</b>: ${amt.toFixed(6)}\n` +
                    ` └ Wert: ${formattedValue}€ | ${pnlEmoji} ${sign}${formattedPnl}€ (${sign}${pnlPercent.toFixed(2)}%)\n\n`;
    }

    const netWorth = Number(profile.balance) + portfolioValue;

    const kb = new InlineKeyboard()
      .webApp('🎮 Jetzt traden', WEBAPP_URL)
      .row()
      .text('🔄 Aktualisieren', 'portfolio');

    const messageText = `📊 <b>Dein Portfolio</b>\n\n` +
      `💶 Kontostand: <b>${Number(profile.balance).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</b>\n` +
      `📦 Asset-Wert: <b>${portfolioValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</b>\n` +
      `💰 Gesamtvermögen: <b>${netWorth.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</b>\n` +
      `🔄 Handelsvolumen: ${Number(profile.total_volume || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€\n\n` +
      `━━ <b>Deine Assets</b> ━━\n\n` +
      (assetsText || '<i>Keine Assets im Besitz</i>\n') +
      `\n🕒 Stand: ${new Date().toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' })}`;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(messageText, { parse_mode: 'HTML', reply_markup: kb });
        await ctx.answerCallbackQuery('Portfolio aktualisiert! 🔄');
      } catch (e) {
        if (e.description && e.description.includes('message is not modified')) {
          await ctx.answerCallbackQuery();
        } else {
          throw e;
        }
      }
    } else {
      await ctx.reply(messageText, { parse_mode: 'HTML', reply_markup: kb });
    }
  } catch (err) {
    console.error('Portfolio Error:', err);
    if (ctx.callbackQuery) {
      ctx.answerCallbackQuery('❌ Fehler beim Laden.');
    } else {
      ctx.reply('❌ Fehler beim Laden deines Portfolios.');
    }
  }
}

module.exports = handlePortfolio;
