const { createClient } = require('@supabase/supabase-js');
const { supabaseConfig } = require('./config');

const supabase = createClient(supabaseConfig.url, supabaseConfig.key);

const db = {
  supabase,

  async getProfile(telegramId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();
    return data;
  },

  async createProfile(telegramId, username, firstName) {
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        telegram_id: telegramId,
        username: username || null,
        first_name: firstName || 'Trader',
        balance: 10000.00,
        feedback_sent: false,
        story_bonus_claimed: false,
        created_at: new Date().toISOString()
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
      .update({ total_volume: Number(p.total_volume || 0) + amount })
      .eq('id', profileId);
  },

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
      .maybeSingle();
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

  async getCurrentPrice(symbol) {
    const { data } = await supabase
      .from('current_prices')
      .select('price_eur')
      .eq('symbol', symbol)
      .maybeSingle();
    return data ? Number(data.price_eur) : null;
  },

  async getAllPrices() {
    const { data } = await supabase
      .from('current_prices')
      .select('*');
    return data || [];
  },

  async logTransaction(profileId, type, symbol, amount, priceEur, feeEur, totalEur) {
    await supabase.from('transactions').insert({
      profile_id: profileId,
      type, symbol, amount,
      price_eur: priceEur,
      fee_eur: feeEur,
      total_eur: totalEur
    });
  },

  async addToFeePool(amount) {
    const { data } = await supabase.from('fee_pool').select('total_eur').eq('id', 1).maybeSingle();
    const currentPool = data ? Number(data.total_eur) : 0;
    await supabase
      .from('fee_pool')
      .update({ total_eur: currentPool + amount })
      .eq('id', 1);
  },

  async getFeePool() {
    const { data } = await supabase.from('fee_pool').select('total_eur').eq('id', 1).maybeSingle();
    return Number(data?.total_eur || 0);
  },

  async getLeaderboard(limit = 10) {
    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .limit(limit);
    return data || [];
  },

  async getActiveSeason() {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();
    return data;
  },

  async createProRequest(profileId) {
    await supabase.from('pro_requests').insert({ profile_id: profileId });
  },

  async approveProRequestForUser(profileId) {
    const proUntil = new Date();
    proUntil.setDate(proUntil.getDate() + 30);
    const { error } = await supabase
      .from('profiles')
      .update({ is_pro: true, pro_until: proUntil.toISOString() })
      .eq('id', profileId);
    
    if (!error) {
      await supabase.from('pro_requests').update({ status: 'approved' }).eq('profile_id', profileId);
      return true;
    }
    return false;
  },

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

  async processBailout(profileId) {
    const { data: p } = await supabase
      .from('profiles')
      .select('balance, bailout_count, bailout_last')
      .eq('id', profileId)
      .single();

    if (Number(p.balance) > 50) return { ok: false, msg: 'Du bist nicht bankrott!' };

    const count = p.bailout_count || 0;

    if (count < 3) {
      const newBal = Number(p.balance) + 1000;
      await supabase.from('profiles').update({
        balance: newBal,
        bailout_count: count + 1,
        bailout_last: new Date().toISOString()
      }).eq('id', profileId);
      await db.logTransaction(profileId, 'bailout', null, null, null, 0, 1000);
      return { ok: true, msg: `💰 Onkel hat dir 1.000€ geschickt! (${2 - count} Rettungen übrig)` };
    } else {
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
      return { ok: true, msg: `💸 Onkel schickt dir 50€ Taschengeld. (Max 500€)` };
    }
  },

  async getStats() {
    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: txCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true });
    return { userCount: userCount || 0, txCount: txCount || 0 };
  }
};

module.exports = { db };
