const express = require('express');
const router = express.Router();
const { db } = require('../../core/database');
const { TRADING_LIMITS, LEVERAGE_TIERS } = require('../../core/config');

// Helper: Berechne effektive Policy
function getEffectivePolicy(isPro, isAdmin) {
  const isMonday = new Date().getDay() === 1;
  const effectivelyPro = isPro || isAdmin;

  let limits;
  if (effectivelyPro) {
    limits = TRADING_LIMITS.PRO;
  } else if (isMonday) {
    limits = TRADING_LIMITS.FREE_MONDAY;
  } else {
    limits = TRADING_LIMITS.FREE;
  }

  return {
    maxLeverage: limits.MAX_LEVERAGE,
    maxPositions: limits.MAX_POSITIONS,
    maxMarginPercent: limits.MARGIN_LIMIT_FACTOR,
    isPro: effectivelyPro,
    isAdmin: !!isAdmin,
    isMonday,
    standardLeverages: LEVERAGE_TIERS.STANDARD,
    zockerLeverages: limits.ZOCKER_LEVERAGES,
    zockerEnabled: limits.ZOCKER_LEVERAGES.length > 0
  };
}

router.get('/positions', async (req, res) => {
  try {
    const profile = await db.getProfile(req.tgId);
    if (!profile) return res.status(404).json({ error: 'Profil nicht gefunden' });

    const positions = await db.getOpenLeveragedPositions(profile.id);
    const history = await db.getLeverageHistory ? await db.getLeverageHistory(profile.id) : [];
    
    const policy = getEffectivePolicy(req.permissions.isPro, req.permissions.isAdmin);

    res.json({ positions, history, policy });
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Positionen' });
  }
});

router.post('/open', async (req, res) => {
  const { symbol, direction, collateral, leverage, stop_loss, take_profit, limit_price, trailing_stop } = req.body;
  
  if (!symbol || !direction || !collateral || !leverage) {
    return res.status(400).json({ error: 'Fehlende Basis-Parameter' });
  }

  try {
    const profile = await db.getProfile(req.tgId);
    const isPro = req.permissions.isPro || req.permissions.isAdmin;
    const policy = getEffectivePolicy(req.permissions.isPro, req.permissions.isAdmin);

    // Hebel validieren
    const levNum = Number(leverage);
    const allAllowed = [...policy.standardLeverages, ...policy.zockerLeverages];
    if (!allAllowed.includes(levNum)) {
      return res.status(403).json({ error: `Hebel ${levNum}x ist für dich nicht verfügbar.` });
    }
    if (levNum > policy.maxLeverage) {
      return res.status(403).json({ error: `Max. Hebel: ${policy.maxLeverage}x` });
    }
    
    if (!isPro && (stop_loss || take_profit || limit_price || trailing_stop)) {
      return res.status(403).json({ error: 'Diese Funktionen sind nur für Pro-Mitglieder verfügbar.' });
    }

    const prices = await db.getAllPrices();
    const currentPriceObj = prices.find(p => p.symbol === symbol.toUpperCase());
    if (!currentPriceObj) return res.status(400).json({ error: 'Coin nicht gefunden' });

    const options = {
      stop_loss: stop_loss ? Number(stop_loss) : null,
      take_profit: take_profit ? Number(take_profit) : null,
      limit_price: limit_price ? Number(limit_price) : null,
      trailing_stop: !!trailing_stop
    };

    const newPosition = await db.openLeveragedPosition(
      profile.id,
      symbol.toUpperCase(),
      direction,
      Number(collateral),
      levNum,
      currentPriceObj.price_eur,
      options
    );

    // v0.3.2: Telegram-Benachrichtigung bei Hebel-Eröffnung
    if (req.bot) {
      const isZocker = levNum >= 20;
      const emoji = isZocker ? '🎰' : '⚡';
      const tag = isZocker ? 'ZOCKER-TRADE' : 'HEBEL-TRADE';
      let msg = options.limit_price 
        ? `⏳ <b>LIMIT-ORDER PLATZIERT</b>\n\n`
        : `${emoji} <b>${tag} GESTARTET</b>\n\n`;
      msg += `<b>${symbol.toUpperCase()} ${direction}</b>\n`;
      msg += `Hebel: <b>${levNum}x</b>\n`;
      msg += `Margin: <b>${Number(collateral).toFixed(2)}€</b>\n`;
      msg += `Einstieg: <b>${Number(currentPriceObj.price_eur).toLocaleString('de-DE')}€</b>`;
      
      req.bot.api.sendMessage(profile.telegram_id, msg, { parse_mode: 'HTML' }).catch(() => {});
    }

    res.json({ success: true, position: newPosition });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/partial-close', async (req, res) => {
  const { position_id, percentage } = req.body;
  
  try {
    const profile = await db.getProfile(req.tgId);
    const result = await db.partialCloseLeveragedPosition(position_id, profile.id, percentage || 0.5);

    // v0.3.2: Telegram-Benachrichtigung bei Teilschließung
    if (req.bot) {
      const pct = ((percentage || 0.5) * 100).toFixed(0);
      const msg = `✂️ <b>TEILSCHLIESSUNG</b>\n\n` +
        `Du hast <b>${pct}%</b> deiner Position geschlossen.\n` +
        `Payout: <b>${result.payout.toFixed(2)}€</b>\n` +
        `Rest-Margin: <b>${result.new_collateral.toFixed(2)}€</b>`;
      req.bot.api.sendMessage(profile.telegram_id, msg, { parse_mode: 'HTML' }).catch(() => {});
    }

    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/close', async (req, res) => {
  const { position_id } = req.body;

  try {
    const profile = await db.getProfile(req.tgId);
    const { data: pos } = await db.supabase
      .from('leveraged_positions')
      .select('symbol, profile_id, leverage, direction')
      .eq('id', position_id)
      .single();

    if (!pos || pos.profile_id !== profile.id) {
      return res.status(403).json({ error: 'Position nicht gefunden oder Zugriff verweigert' });
    }

    const prices = await db.getAllPrices();
    const currentPriceObj = prices.find(p => p.symbol === pos.symbol);
    
    const result = await db.closeLeveragedPosition(position_id, currentPriceObj.price_eur, false);

    // v0.3.2: Telegram-Benachrichtigung bei Hebel-Schließung
    if (req.bot) {
      const emoji = result.pnl >= 0 ? '💰' : '📉';
      const msg = `${emoji} <b>HEBEL-TRADE GESCHLOSSEN</b>\n\n` +
        `Symbol: <b>${pos.symbol}</b>\n` +
        `Hebel: <b>${pos.leverage}x ${pos.direction}</b>\n` +
        `Kurs: <b>${Number(currentPriceObj.price_eur).toLocaleString('de-DE')}€</b>\n` +
        `PnL: <b>${result.pnl >= 0 ? '+' : ''}${result.pnl.toFixed(2)}€</b>\n` +
        `Auszahlung: <b>${result.payout.toFixed(2)}€</b>`;
      req.bot.api.sendMessage(profile.telegram_id, msg, { parse_mode: 'HTML' }).catch(() => {});
    }

    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
