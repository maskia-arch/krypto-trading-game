const { createClient } = require('@supabase/supabase-js');
const { supabaseConfig } = require('./config');

const supabase = createClient(supabaseConfig.url, supabaseConfig.key);

const db = { supabase };

Object.assign(db, require('./db/profiles')(db));
Object.assign(db, require('./db/assets')(db));
Object.assign(db, require('./db/transactions')(db));
Object.assign(db, require('./db/leaderboard')(db));
Object.assign(db, require('./db/realEstate')(db));
Object.assign(db, require('./db/pro')(db));
Object.assign(db, require('./db/achievements')(db));

module.exports = { db };
