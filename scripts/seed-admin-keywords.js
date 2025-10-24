// Seed admin_keywords and admin_merchants tables with initial data
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

async function seedAdminKeywords() {
  console.log('[Seed] Starting admin keywords migration...');

  try {
    // First, ensure tables exist
    console.log('[Seed] Creating admin tables if they don\'t exist...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_merchants (
        id SERIAL PRIMARY KEY,
        merchant_pattern TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        label TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 10,
        is_active BOOLEAN DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_keywords (
        id SERIAL PRIMARY KEY,
        keyword TEXT NOT NULL,
        category TEXT NOT NULL,
        label TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 8,
        language TEXT DEFAULT 'en' CHECK (language IN ('en', 'fr', 'both')),
        is_active BOOLEAN DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('[Seed] Tables created/verified');

    // Clear existing data
    await pool.query('DELETE FROM admin_keywords');
    await pool.query('DELETE FROM admin_merchants');
    console.log('[Seed] Cleared existing data');

    // Seed keywords from lib/categorization-engine.ts
    const keywords = [
      // Housing
      { keyword: 'RENT', category: 'Housing', label: 'Rent', score: 10, language: 'both' },
      { keyword: 'MORTGAGE', category: 'Housing', label: 'Mortgage', score: 10, language: 'en' },
      { keyword: 'HYPOTHEQUE', category: 'Housing', label: 'Mortgage', score: 10, language: 'fr' },
      { keyword: 'PROPERTY TAX', category: 'Housing', label: 'Property Tax', score: 10, language: 'en' },
      { keyword: 'CONDO FEE', category: 'Housing', label: 'Condo Fees', score: 10, language: 'en' },
      { keyword: 'HOME INSURANCE', category: 'Housing', label: 'Home Insurance', score: 10, language: 'en' },
      
      // Bills - Utilities
      { keyword: 'HYDRO', category: 'Bills', label: 'Utilities', score: 10, language: 'both' },
      { keyword: 'ELECTRIC', category: 'Bills', label: 'Utilities', score: 9, language: 'en' },
      { keyword: 'GAS NATURAL', category: 'Bills', label: 'Utilities', score: 9, language: 'en' },
      { keyword: 'WATER', category: 'Bills', label: 'Utilities', score: 8, language: 'en' },
      { keyword: 'INTERNET', category: 'Bills', label: 'Internet', score: 10, language: 'both' },
      { keyword: 'BELL', category: 'Bills', label: 'Telecom', score: 10, language: 'both' },
      { keyword: 'ROGERS', category: 'Bills', label: 'Telecom', score: 10, language: 'both' },
      { keyword: 'TELUS', category: 'Bills', label: 'Telecom', score: 10, language: 'both' },
      { keyword: 'FIDO', category: 'Bills', label: 'Telecom', score: 10, language: 'both' },
      { keyword: 'VIDEOTRON', category: 'Bills', label: 'Telecom', score: 10, language: 'both' },
      { keyword: 'KOODO', category: 'Bills', label: 'Telecom', score: 10, language: 'both' },
      
      // Subscriptions
      { keyword: 'NETFLIX', category: 'Subscriptions', label: 'Streaming', score: 10, language: 'both' },
      { keyword: 'SPOTIFY', category: 'Subscriptions', label: 'Streaming', score: 10, language: 'both' },
      { keyword: 'AMAZON PRIME', category: 'Subscriptions', label: 'Streaming', score: 10, language: 'both' },
      { keyword: 'DISNEY', category: 'Subscriptions', label: 'Streaming', score: 10, language: 'both' },
      { keyword: 'GYM', category: 'Subscriptions', label: 'Fitness', score: 9, language: 'en' },
      { keyword: 'FITNESS', category: 'Subscriptions', label: 'Fitness', score: 8, language: 'en' },
      
      // Food - Groceries
      { keyword: 'GROCER', category: 'Food', label: 'Groceries', score: 9, language: 'en' },
      { keyword: 'SUPER', category: 'Food', label: 'Groceries', score: 7, language: 'both' },
      { keyword: 'LOBLAWS', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'METRO', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'SOBEYS', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'IGA', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'PROVIGO', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'MAXI', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'WALMART', category: 'Food', label: 'Groceries', score: 9, language: 'both' },
      { keyword: 'COSTCO', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      
      // Food - Restaurants
      { keyword: 'TIM', category: 'Food', label: 'Coffee Shop', score: 10, language: 'both' },
      { keyword: 'STARBUCKS', category: 'Food', label: 'Coffee Shop', score: 10, language: 'both' },
      { keyword: 'MCDONALD', category: 'Food', label: 'Fast Food', score: 10, language: 'both' },
      { keyword: 'BURGER', category: 'Food', label: 'Fast Food', score: 8, language: 'both' },
      { keyword: 'PIZZA', category: 'Food', label: 'Fast Food', score: 9, language: 'both' },
      { keyword: 'RESTAURANT', category: 'Food', label: 'Dining', score: 8, language: 'both' },
      { keyword: 'UBER EATS', category: 'Food', label: 'Delivery', score: 10, language: 'both' },
      { keyword: 'DOORDASH', category: 'Food', label: 'Delivery', score: 10, language: 'both' },
      { keyword: 'SKIP', category: 'Food', label: 'Delivery', score: 10, language: 'both' },
      
      // Transport
      { keyword: 'STM', category: 'Transport', label: 'Public Transit', score: 10, language: 'both' },
      { keyword: 'TTC', category: 'Transport', label: 'Public Transit', score: 10, language: 'both' },
      { keyword: 'TRANSLINK', category: 'Transport', label: 'Public Transit', score: 10, language: 'both' },
      { keyword: 'PRESTO', category: 'Transport', label: 'Public Transit', score: 10, language: 'both' },
      { keyword: 'UBER', category: 'Transport', label: 'Ride Share', score: 10, language: 'both' },
      { keyword: 'LYFT', category: 'Transport', label: 'Ride Share', score: 10, language: 'both' },
      { keyword: 'GAS', category: 'Transport', label: 'Gas', score: 7, language: 'both' },
      { keyword: 'PETRO', category: 'Transport', label: 'Gas', score: 9, language: 'both' },
      { keyword: 'ESSO', category: 'Transport', label: 'Gas', score: 10, language: 'both' },
      { keyword: 'SHELL', category: 'Transport', label: 'Gas', score: 10, language: 'both' },
      { keyword: 'PARKING', category: 'Transport', label: 'Parking', score: 9, language: 'both' },
      
      // Health
      { keyword: 'PHARM', category: 'Health', label: 'Pharmacy', score: 10, language: 'both' },
      { keyword: 'DRUG', category: 'Health', label: 'Pharmacy', score: 8, language: 'en' },
      { keyword: 'SHOPPERS', category: 'Health', label: 'Pharmacy', score: 10, language: 'both' },
      { keyword: 'REXALL', category: 'Health', label: 'Pharmacy', score: 10, language: 'both' },
      { keyword: 'JEAN COUTU', category: 'Health', label: 'Pharmacy', score: 10, language: 'both' },
      { keyword: 'DOCTOR', category: 'Health', label: 'Medical', score: 9, language: 'en' },
      { keyword: 'CLINIC', category: 'Health', label: 'Medical', score: 9, language: 'en' },
      { keyword: 'DENTAL', category: 'Health', label: 'Dental', score: 10, language: 'en' },
      
      // Shopping
      { keyword: 'AMAZON', category: 'Shopping', label: 'Online Shopping', score: 10, language: 'both' },
      { keyword: 'AMZN', category: 'Shopping', label: 'Online Shopping', score: 10, language: 'both' },
      { keyword: 'CANADIAN TIRE', category: 'Shopping', label: 'General Retail', score: 10, language: 'both' },
      { keyword: 'DOLLARAMA', category: 'Shopping', label: 'General Retail', score: 10, language: 'both' },
      { keyword: 'WINNERS', category: 'Shopping', label: 'Clothing', score: 10, language: 'both' },
      { keyword: 'H&M', category: 'Shopping', label: 'Clothing', score: 10, language: 'both' },
      { keyword: 'ZARA', category: 'Shopping', label: 'Clothing', score: 10, language: 'both' },
      
      // Work
      { keyword: 'OFFICE', category: 'Work', label: 'Office Supplies', score: 8, language: 'en' },
      { keyword: 'STAPLES', category: 'Work', label: 'Office Supplies', score: 10, language: 'both' },
      { keyword: 'BUREAU', category: 'Work', label: 'Office Supplies', score: 8, language: 'fr' },
    ];

    console.log(`[Seed] Inserting ${keywords.length} keywords...`);
    
    for (const kw of keywords) {
      await pool.query(
        `INSERT INTO admin_keywords (keyword, category, label, score, language, is_active) 
         VALUES ($1, $2, $3, $4, $5, true)`,
        [kw.keyword, kw.category, kw.label, kw.score, kw.language]
      );
    }

    console.log(`[Seed] ✅ Successfully inserted ${keywords.length} keywords`);
    
    // Show summary
    const result = await pool.query(`
      SELECT category, COUNT(*) as count 
      FROM admin_keywords 
      WHERE is_active = TRUE 
      GROUP BY category 
      ORDER BY category
    `);
    
    console.log('\n[Seed] Keywords by category:');
    result.rows.forEach(row => {
      console.log(`  ${row.category}: ${row.count} keywords`);
    });
    
    console.log('\n[Seed] ✅ Admin keywords migration complete!');
    console.log('[Seed] You can now view and edit these in the admin dashboard.');
    
  } catch (error) {
    console.error('[Seed] Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedAdminKeywords();

