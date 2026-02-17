module.exports = (db) => ({
  async logTransaction(profileId, type, symbol, amount, priceEur, feeEur, totalEur) {
    await db.supabase.from('transactions').insert({
      profile_id: profileId,
      type, symbol, amount,
      price_eur: priceEur,
      fee_eur: feeEur,
      total_eur: totalEur
    });
  },

  async addToFeePool(amount) {
    const { data } = await db.supabase.from('fee_pool').select('total_eur').eq('id', 1).maybeSingle();
    const currentPool = data ? Number(data.total_eur) : 0;
    await db.supabase
      .from('fee_pool')
      .update({ total_eur: currentPool + amount })
      .eq('id', 1);
  },

  async getFeePool() {
    const { data } = await db.supabase.from('fee_pool').select('total_eur').eq('id', 1).maybeSingle();
    return Number(data?.total_eur || 0);
  },

  async processBailout(profileId) {
    const { data: p } = await db.supabase
      .from('profiles')
      .select('balance, bailout_count, bailout_last')
      .eq('id', profileId)
      .single();

    if (Number(p.balance) > 50) return { ok: false, msg: 'Du bist nicht bankrott!' };

    const count = p.bailout_count || 0;

    if (count < 3) {
      const newBal = Number(p.balance) + 1000;
      await db.supabase.from('profiles').update({
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
      await db.supabase.from('profiles').update({
        balance: newBal,
        bailout_last: new Date().toISOString()
      }).eq('id', profileId);
      await db.logTransaction(profileId, 'bailout', null, null, null, 0, 50);
      return { ok: true, msg: `💸 Onkel schickt dir 50€ Taschengeld. (Max 500€)` };
    }
  }
});
