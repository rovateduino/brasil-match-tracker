import dotenv from 'dotenv';

dotenv.config();

const required = [
  'PORT',
  'API_FOOTBALL_BASE_URL',
  'API_FOOTBALL_DAYS_PAST',
  'API_FOOTBALL_DAYS_FUTURE',
  'CACHE_TTL',
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Variáveis de ambiente faltando:', missing.join(', '));
  console.error('📋 Consulte .env.example para configuração correta.');
  process.exit(1);
}

console.log('✅ Variáveis de ambiente validadas.');
