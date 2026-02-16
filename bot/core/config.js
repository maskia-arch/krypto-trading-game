// ============================================================
// CORE CONFIGURATION (core/config.js)
// ============================================================
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// --- Versionierung (Single Source of Truth) ---
let VERSION = '0.1';
try {
  // Wir suchen die version.txt im Root-Verzeichnis
  VERSION = fs.readFileSync(path.join(__dirname, '..', '..', 'version.txt'), 'utf8').trim();
} catch (e) {
  // Fallback, falls die Datei nicht gelesen werden kann
}

// --- Bot & Server Config ---
const botConfig = {
  token: process.env.BOT_TOKEN,
  port: process.env.PORT || 3000,
};

const ADMIN_ID = Number(process.env.ADMIN_ID);
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://your-webapp.vercel.app';

// --- Supabase Config ---
const supabaseConfig = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_KEY, // Service-Key für Server-Operationen
};

// --- Spiel-Parameter (Balancing) ---
const COINS = {
  BTC: { name: 'Bitcoin',  gecko: 'bitcoin',  emoji: '₿' },
  ETH: { name: 'Ethereum', gecko: 'ethereum', emoji: 'Ξ' },
  LTC: { name: 'Litecoin', gecko: 'litecoin', emoji: 'Ł' }
};

const FEE_RATE = 0.005; // 0,5% Handelsgebühr

module.exports = {
  VERSION,
  botConfig,
  ADMIN_ID,
  WEBAPP_URL,
  supabaseConfig,
  COINS,
  FEE_RATE
};
