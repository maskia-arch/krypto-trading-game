const { createClient } = require('@supabase/supabase-js');
const { supabaseConfig } = require('./config');

const supabase = createClient(supabaseConfig.url, supabaseConfig.key);

// Das zentrale db-Objekt mit der Datenbankverbindung
const db = { supabase };

// Hier laden wir alle ausgelagerten Module und hängen sie an das db-Objekt an.
// Wir übergeben (db) an jede Datei, damit sie untereinander auf ihre Funktionen zugreifen können.
Object.assign(db, require('./db/profiles')(db));
Object.assign(db, require('./db/assets')(db));
Object.assign(db, require('./db/transactions')(db));
Object.assign(db, require('./db/leaderboard')(db));
Object.assign(db, require('./db/realEstate')(db));
Object.assign(db, require('./db/pro')(db));

module.exports = { db };
