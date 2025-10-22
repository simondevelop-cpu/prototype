#!/usr/bin/env node

/**
 * Database initialization script for Vercel deployment
 * Run this once after connecting your Neon database
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL or POSTGRES_URL environment variable is required');
  console.error('Please set it in your Vercel environment variables');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function initDatabase() {
  console.log('🚀 Starting database initialization...\n');

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Create users table
    console.log('📋 Creating users table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created\n');

    // Create transactions table
    console.log('📋 Creating transactions table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        date DATE NOT NULL,
        description TEXT,
        amount NUMERIC(12, 2) NOT NULL,
        cashflow TEXT NOT NULL,
        category TEXT,
        account TEXT,
        label TEXT,
        CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Transactions table created\n');

    // Create indexes
    console.log('📋 Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_cashflow ON transactions(cashflow);
    `);
    console.log('✅ Indexes created\n');

    // Check if demo user exists
    console.log('👤 Checking for demo user...');
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', ['demo-user']);
    
    if (userCheck.rows.length === 0) {
      console.log('👤 Creating demo user...');
      const crypto = require('crypto');
      const demoPassword = 'northstar-demo';
      const passwordHash = crypto.createHash('sha256').update(demoPassword).digest('hex');
      
      await pool.query(
        'INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4)',
        ['demo-user', 'Taylor Nguyen', 'demo@canadianinsights.ca', passwordHash]
      );
      console.log('✅ Demo user created\n');
    } else {
      console.log('✅ Demo user already exists\n');
    }

    // Check if sample data exists
    console.log('📊 Checking for sample data...');
    const dataCheck = await pool.query(
      'SELECT COUNT(*) as count FROM transactions WHERE user_id = $1',
      ['demo-user']
    );
    
    if (parseInt(dataCheck.rows[0].count) === 0) {
      console.log('📊 Seeding sample transactions...');
      
      const sampleTransactions = [
        { date: '2024-01-15', description: 'Salary Deposit', amount: 5000, cashflow: 'income', category: 'Employment', account: 'Chequing', label: 'Regular Income' },
        { date: '2024-01-16', description: 'Grocery Store', amount: -150.50, cashflow: 'expense', category: 'Groceries', account: 'Credit Card', label: 'Weekly Shopping' },
        { date: '2024-01-18', description: 'Gas Station', amount: -65.00, cashflow: 'expense', category: 'Transportation', account: 'Credit Card', label: 'Fuel' },
        { date: '2024-01-20', description: 'Restaurant', amount: -85.25, cashflow: 'expense', category: 'Dining', account: 'Credit Card', label: 'Date Night' },
        { date: '2024-01-22', description: 'Electric Bill', amount: -120.00, cashflow: 'expense', category: 'Utilities', account: 'Chequing', label: 'Monthly Bills' },
        { date: '2024-01-25', description: 'Freelance Payment', amount: 800, cashflow: 'income', category: 'Self-Employment', account: 'Chequing', label: 'Side Hustle' },
        { date: '2024-02-01', description: 'Rent Payment', amount: -1500, cashflow: 'expense', category: 'Housing', account: 'Chequing', label: 'Monthly Rent' },
        { date: '2024-02-05', description: 'Grocery Store', amount: -175.80, cashflow: 'expense', category: 'Groceries', account: 'Credit Card', label: 'Weekly Shopping' },
        { date: '2024-02-10', description: 'Online Shopping', amount: -89.99, cashflow: 'expense', category: 'Shopping', account: 'Credit Card', label: 'Clothing' },
        { date: '2024-02-15', description: 'Salary Deposit', amount: 5000, cashflow: 'income', category: 'Employment', account: 'Chequing', label: 'Regular Income' },
      ];

      for (const tx of sampleTransactions) {
        await pool.query(
          `INSERT INTO transactions (user_id, date, description, amount, cashflow, category, account, label)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          ['demo-user', tx.date, tx.description, tx.amount, tx.cashflow, tx.category, tx.account, tx.label]
        );
      }
      
      console.log(`✅ Seeded ${sampleTransactions.length} sample transactions\n`);
    } else {
      console.log(`✅ Sample data already exists (${dataCheck.rows[0].count} transactions)\n`);
    }

    console.log('🎉 Database initialization complete!\n');
    console.log('📝 Summary:');
    console.log('   - Users table: ✅');
    console.log('   - Transactions table: ✅');
    console.log('   - Demo user: ✅');
    console.log('   - Sample data: ✅');
    console.log('\nYou can now use the application! 🚀\n');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();

