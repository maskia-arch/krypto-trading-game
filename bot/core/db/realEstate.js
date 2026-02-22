module.exports = (db) => ({
  async getRealEstateTypes() {
    const { data } = await db.supabase.from('real_estate_types').select('*').order('price_eur');
    return data || [];
  },

  async getUserRealEstate(profileId) {
    const { data } = await db.supabase
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
        await db.supabase.from('real_estate')
          .update({ last_collect: now.toISOString() })
          .eq('id', prop.id);
      }
    }

    if (totalRent > 0) {
      const { data: p } = await db.supabase.from('profiles')
        .select('balance, bonus_received').eq('id', profileId).single();
      
      // v0.3.2: Miete wird als "geschenktes Geld" getrackt (bonus_received)
      // damit es das Ranking nicht beeinflusst
      await db.supabase.from('profiles')
        .update({ 
          balance: Number(p.balance) + totalRent,
          bonus_received: Number(p.bonus_received || 0) + totalRent
        })
        .eq('id', profileId);
      
      await db.logTransaction(profileId, 'rent', null, null, null, 0, totalRent);
    }
    return totalRent;
  }
});
