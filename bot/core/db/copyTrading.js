module.exports = (db) => ({
  // Aktive Kopier-Abos für einen bestimmten Trader (target) laden
  async getActiveCopySubscriptions(targetProfileId) {
    const { data } = await db.supabase
      .from('copy_subscriptions')
      .select('*, copier:copier_id(id, telegram_id, username, balance)')
      .eq('target_id', targetProfileId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString());
    return data || [];
  },

  // Aktive Kopier-Abos die ein User (copier) hat
  async getMyCopySubscriptions(copierProfileId) {
    const { data } = await db.supabase
      .from('copy_subscriptions')
      .select('*, target:target_id(id, telegram_id, username, avatar_url)')
      .eq('copier_id', copierProfileId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString());
    return data || [];
  },

  // Kopier-Abo erstellen (inkl. Gebühr)
  async createCopySubscription(copierProfileId, targetProfileId, budget, durationHours) {
    // 1% Gebühr berechnen
    const fee = parseFloat((budget * 0.01).toFixed(2));
    const netBudget = parseFloat((budget - fee).toFixed(2));
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    // Copier: Budget + Fee vom Konto abziehen
    const { data: copier } = await db.supabase
      .from('profiles')
      .select('balance')
      .eq('id', copierProfileId)
      .single();
    
    if (!copier || Number(copier.balance) < budget) {
      throw new Error('Nicht genügend Guthaben');
    }

    const newCopierBalance = parseFloat((Number(copier.balance) - budget).toFixed(2));
    await db.supabase
      .from('profiles')
      .update({ balance: newCopierBalance })
      .eq('id', copierProfileId);

    // Gebühr dem Target gutschreiben (zählt als bonus_received, NICHT PnL-relevant)
    const { data: target } = await db.supabase
      .from('profiles')
      .select('balance, bonus_received')
      .eq('id', targetProfileId)
      .single();

    if (target) {
      await db.supabase
        .from('profiles')
        .update({ 
          balance: parseFloat((Number(target.balance) + fee).toFixed(2)),
          bonus_received: parseFloat((Number(target.bonus_received || 0) + fee).toFixed(2))
        })
        .eq('id', targetProfileId);
    }

    // Subscription erstellen
    const { data: sub, error } = await db.supabase
      .from('copy_subscriptions')
      .insert({
        copier_id: copierProfileId,
        target_id: targetProfileId,
        budget: netBudget,
        remaining: netBudget,
        fee_paid: fee,
        duration_hours: durationHours,
        expires_at: expiresAt.toISOString(),
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    // Transaktion loggen (Copier)
    await db.supabase.from('transactions').insert({
      profile_id: copierProfileId,
      type: 'copy_fee',
      total_eur: budget,
      fee_eur: fee,
      details: `Copy Trading Abo gestartet (Budget: ${netBudget}€, Gebühr: ${fee}€)`
    });

    // Transaktion loggen (Target - Gebühr erhalten)
    await db.supabase.from('transactions').insert({
      profile_id: targetProfileId,
      type: 'copy_fee_received',
      total_eur: fee,
      details: `Copy Trading Gebühr erhalten`
    });

    return sub;
  },

  // Kopierten Trade ausführen für alle aktiven Subscriber
  async executeCopyTrades(targetProfileId, symbol, action, percentageOfVolume, priceEur) {
    const subs = await this.getActiveCopySubscriptions(targetProfileId);
    if (!subs || subs.length === 0) return [];

    const results = [];

    for (const sub of subs) {
      try {
        // Prüfe ob Abo noch gültig
        if (new Date(sub.expires_at) <= new Date() || sub.status !== 'active') continue;

        const remaining = Number(sub.remaining);
        if (remaining <= 0) continue;

        // Proportionaler Betrag: percentage des Budgets
        const tradeAmount = parseFloat((sub.budget * percentageOfVolume).toFixed(2));
        const actualAmount = Math.min(tradeAmount, remaining);
        
        if (actualAmount < 0.01) continue;

        if (action === 'buy') {
          const cryptoAmount = actualAmount / priceEur;
          
          // Asset updaten
          await db.upsertAsset(sub.copier_id, symbol, cryptoAmount, priceEur);
          
          // Remaining reduzieren
          const newRemaining = parseFloat((remaining - actualAmount).toFixed(2));
          await db.supabase
            .from('copy_subscriptions')
            .update({ remaining: Math.max(0, newRemaining) })
            .eq('id', sub.id);

          // Copy Trade loggen
          await db.supabase.from('copy_trades').insert({
            subscription_id: sub.id,
            copier_id: sub.copier_id,
            symbol,
            action: 'buy',
            amount_eur: actualAmount,
            amount_crypto: cryptoAmount,
            price_eur: priceEur
          });

          // Transaktion loggen
          await db.supabase.from('transactions').insert({
            profile_id: sub.copier_id,
            type: 'copy_buy',
            symbol,
            amount: cryptoAmount,
            price_eur: priceEur,
            total_eur: actualAmount,
            details: `Copy Trade: ${cryptoAmount.toFixed(6)} ${symbol} gekauft`
          });

          results.push({ copier_id: sub.copier_id, action: 'buy', amount_eur: actualAmount, symbol });
        } else if (action === 'sell') {
          // Bei Verkauf: Proportional die gleiche % verkaufen
          const { data: asset } = await db.supabase
            .from('assets')
            .select('*')
            .eq('profile_id', sub.copier_id)
            .eq('symbol', symbol)
            .maybeSingle();

          if (!asset || Number(asset.amount) <= 0) continue;

          const sellCrypto = Number(asset.amount) * percentageOfVolume;
          if (sellCrypto <= 0.00000001) continue;

          const euroReceived = parseFloat((sellCrypto * priceEur).toFixed(2));
          const newAmount = Number(asset.amount) - sellCrypto;

          // Balance des Copiers erhöhen
          const { data: copierProfile } = await db.supabase
            .from('profiles')
            .select('balance')
            .eq('id', sub.copier_id)
            .single();

          if (copierProfile) {
            await db.supabase
              .from('profiles')
              .update({ balance: parseFloat((Number(copierProfile.balance) + euroReceived).toFixed(2)) })
              .eq('id', sub.copier_id);
          }

          // Asset updaten/löschen
          if (newAmount <= 0.00000001) {
            await db.supabase.from('assets').delete().eq('profile_id', sub.copier_id).eq('symbol', symbol);
          } else {
            await db.supabase.from('assets').update({ amount: newAmount }).eq('profile_id', sub.copier_id).eq('symbol', symbol);
          }

          // Copy Trade loggen
          await db.supabase.from('copy_trades').insert({
            subscription_id: sub.id,
            copier_id: sub.copier_id,
            symbol,
            action: 'sell',
            amount_eur: euroReceived,
            amount_crypto: sellCrypto,
            price_eur: priceEur
          });

          await db.supabase.from('transactions').insert({
            profile_id: sub.copier_id,
            type: 'copy_sell',
            symbol,
            amount: sellCrypto,
            price_eur: priceEur,
            total_eur: euroReceived,
            details: `Copy Trade: ${sellCrypto.toFixed(6)} ${symbol} verkauft`
          });

          results.push({ copier_id: sub.copier_id, action: 'sell', amount_eur: euroReceived, symbol });
        }
      } catch (err) {
        console.error(`Copy Trade Error for sub ${sub.id}:`, err.message);
      }
    }

    return results;
  },

  // Abgelaufene Subscriptions expiren und Budget zurückgeben
  async expireCopySubscriptions() {
    const { data: expired } = await db.supabase
      .from('copy_subscriptions')
      .select('*')
      .eq('status', 'active')
      .lte('expires_at', new Date().toISOString());

    if (!expired || expired.length === 0) return 0;

    let count = 0;
    for (const sub of expired) {
      try {
        // Verbleibendes Budget zurück an Copier
        const remaining = Number(sub.remaining);
        if (remaining > 0) {
          const { data: copier } = await db.supabase
            .from('profiles')
            .select('balance')
            .eq('id', sub.copier_id)
            .single();

          if (copier) {
            await db.supabase
              .from('profiles')
              .update({ balance: parseFloat((Number(copier.balance) + remaining).toFixed(2)) })
              .eq('id', sub.copier_id);

            await db.supabase.from('transactions').insert({
              profile_id: sub.copier_id,
              type: 'copy_refund',
              total_eur: remaining,
              details: `Copy Trading Restbudget zurückerstattet`
            });
          }
        }

        await db.supabase
          .from('copy_subscriptions')
          .update({ status: 'expired' })
          .eq('id', sub.id);

        count++;
      } catch (err) {
        console.error(`Expire sub ${sub.id} error:`, err.message);
      }
    }
    return count;
  },

  // Prüfe ob Free User Copy Trading nutzen darf (30 Tage Cooldown)
  async canFreeCopy(profileId) {
    const { data: profile } = await db.supabase
      .from('profiles')
      .select('last_free_copy')
      .eq('id', profileId)
      .single();

    if (!profile || !profile.last_free_copy) return true;

    const lastCopy = new Date(profile.last_free_copy);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return lastCopy <= thirtyDaysAgo;
  },

  // Free Copy genutzt markieren
  async markFreeCopyUsed(profileId) {
    await db.supabase
      .from('profiles')
      .update({ last_free_copy: new Date().toISOString() })
      .eq('id', profileId);
  },

  // Kopier-Abo abbrechen
  async cancelCopySubscription(subId, copierProfileId) {
    const { data: sub } = await db.supabase
      .from('copy_subscriptions')
      .select('*')
      .eq('id', subId)
      .eq('copier_id', copierProfileId)
      .eq('status', 'active')
      .single();

    if (!sub) throw new Error('Abo nicht gefunden');

    const remaining = Number(sub.remaining);
    if (remaining > 0) {
      const { data: copier } = await db.supabase
        .from('profiles')
        .select('balance')
        .eq('id', copierProfileId)
        .single();

      if (copier) {
        await db.supabase
          .from('profiles')
          .update({ balance: parseFloat((Number(copier.balance) + remaining).toFixed(2)) })
          .eq('id', copierProfileId);
      }
    }

    await db.supabase
      .from('copy_subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', subId);

    return { refunded: remaining };
  }
});
