#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { parse } = require('csv-parse/sync');

function normaliseMerchant(description) {
  return description.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function loadCsv(filePath) {
  const fileBuffer = await fs.promises.readFile(filePath);
  return parse(fileBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required to refresh demo data.');
    process.exit(1);
  }

  const csvPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, 'demo-transactions.csv');

  const useSSL = process.env.DATABASE_SSL !== 'false';
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
  });

  const transactions = await loadCsv(csvPath);
  if (transactions.length === 0) {
    console.warn(`No transactions found in ${csvPath}. Nothing to import.`);
    await pool.end();
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE insight_feedback RESTART IDENTITY;');
    await client.query('TRUNCATE TABLE transactions RESTART IDENTITY;');

    const insertText = `
      INSERT INTO transactions
        (description, merchant, date, cashflow, account, category, label, amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (date, amount, merchant, cashflow) DO NOTHING;
    `;

    for (const row of transactions) {
      const description = row.description;
      const merchant = normaliseMerchant(description);
      const amount = Number.parseFloat(row.amount);

      await client.query(insertText, [
        description,
        merchant,
        row.date,
        row.cashflow,
        row.account,
        row.category,
        row.label || '',
        amount,
      ]);
    }

    await client.query('COMMIT');
    console.log(`Loaded ${transactions.length} transactions from ${csvPath}.`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to refresh demo data:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Unexpected error while refreshing demo data:', error);
  process.exit(1);
});
