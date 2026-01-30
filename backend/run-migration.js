import pool from './src/db/pool.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration(filename) {
  const migrationPath = path.join(__dirname, 'migrations', filename);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log(`\n[Migration] Executando: ${filename}`);

  try {
    await pool.query(sql);
    console.log(`[Migration] ✓ ${filename} executada com sucesso`);
    return true;
  } catch (error) {
    console.error(`[Migration] ✗ Erro ao executar ${filename}:`, error.message);
    return false;
  }
}

async function main() {
  const migrationFile = process.argv[2] || '003_add_password_reset_tokens.sql';

  console.log('[Migration] Conectando ao banco de dados...');

  const success = await runMigration(migrationFile);

  await pool.end();

  if (success) {
    console.log('\n[Migration] Concluída com sucesso!\n');
    process.exit(0);
  } else {
    console.log('\n[Migration] Falhou. Verifique os erros acima.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
