// Optimized, deduplicated keywords and merchants
// - Short, powerful keywords (e.g. "PHARM" instead of "PHARMACY", "PHARMACIE", "PHARMAPRIX")
// - Removed weak/generic words (score < 10)
// - Consolidated duplicates
// - Only most distinctive merchants

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

async function seedOptimizedPatterns() {
  console.log('[Seed] Starting optimized pattern migration...\n');
  
  try {
    // Create tables
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
        language TEXT DEFAULT 'both' CHECK (language IN ('en', 'fr', 'both')),
        is_active BOOLEAN DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('[DB] Tables created');
    
    // Clear existing data
    await pool.query('DELETE FROM admin_keywords');
    await pool.query('DELETE FROM admin_merchants');
    console.log('[DB] Cleared existing data\n');
    
    // OPTIMIZED KEYWORD PATTERNS
    // Short, powerful keywords - deduplicated and consolidated
    const keywords = [
      // === HOUSING ===
      { keyword: 'RENT', category: 'Housing', label: 'Rent', score: 10, language: 'en' },
      { keyword: 'LOYER', category: 'Housing', label: 'Rent', score: 10, language: 'fr' },
      { keyword: 'MORTGAGE', category: 'Housing', label: 'Home', score: 10, language: 'en' },
      { keyword: 'HYPOTHEQUE', category: 'Housing', label: 'Home', score: 10, language: 'fr' },
      { keyword: 'VET', category: 'Housing', label: 'Pets', score: 10, language: 'both' },
      { keyword: 'DAYCARE', category: 'Housing', label: 'Daycare', score: 10, language: 'en' },
      { keyword: 'GARDERIE', category: 'Housing', label: 'Daycare', score: 10, language: 'fr' },
      
      // === BILLS ===
      // Utilities
      { keyword: 'HYDRO', category: 'Bills', label: 'Gas & Electricity', score: 10, language: 'both' },
      { keyword: 'ELECTRIC', category: 'Bills', label: 'Gas & Electricity', score: 10, language: 'en' },
      { keyword: 'UTIL', category: 'Bills', label: 'Gas & Electricity', score: 10, language: 'en' },
      { keyword: 'ENBRIDGE', category: 'Bills', label: 'Gas & Electricity', score: 10, language: 'both' },
      { keyword: 'FORTIS', category: 'Bills', label: 'Gas & Electricity', score: 10, language: 'both' },
      
      // Telecom
      { keyword: 'ROGERS', category: 'Bills', label: 'Phone', score: 10, language: 'both' },
      { keyword: 'BELL', category: 'Bills', label: 'Phone', score: 10, language: 'both' },
      { keyword: 'TELUS', category: 'Bills', label: 'Phone', score: 10, language: 'both' },
      { keyword: 'FIDO', category: 'Bills', label: 'Phone', score: 10, language: 'both' },
      { keyword: 'VIDEOTRON', category: 'Bills', label: 'Internet', score: 10, language: 'both' },
      { keyword: 'KOODO', category: 'Bills', label: 'Phone', score: 10, language: 'both' },
      { keyword: 'VIRGIN MOBILE', category: 'Bills', label: 'Phone', score: 10, language: 'both' },
      { keyword: 'FREEDOM', category: 'Bills', label: 'Phone', score: 10, language: 'both' },
      { keyword: 'SHAW', category: 'Bills', label: 'Internet', score: 10, language: 'both' },
      { keyword: 'COGECO', category: 'Bills', label: 'Internet', score: 10, language: 'both' },
      
      // Bill Payments
      { keyword: 'BILLPAY', category: 'Bills', label: 'Other bills', score: 10, language: 'both' },
      { keyword: 'PREAUTHORIZED', category: 'Bills', label: 'Other bills', score: 10, language: 'both' },
      { keyword: 'AUTOPAY', category: 'Bills', label: 'Other bills', score: 10, language: 'both' },
      
      // Insurance & Fees
      { keyword: 'INSUR', category: 'Bills', label: 'Home insurance', score: 10, language: 'en' },
      { keyword: 'ASSURANCE', category: 'Bills', label: 'Home insurance', score: 10, language: 'fr' },
      { keyword: 'SERVICE CHARGE', category: 'Bills', label: 'Bank and other fees', score: 10, language: 'both' },
      { keyword: 'BANK FEE', category: 'Bills', label: 'Bank and other fees', score: 10, language: 'both' },
      
      // === SUBSCRIPTIONS ===
      { keyword: 'NETFLIX', category: 'Subscriptions', label: 'Subscriptions', score: 10, language: 'both' },
      { keyword: 'SPOTIFY', category: 'Subscriptions', label: 'Subscriptions', score: 10, language: 'both' },
      { keyword: 'APPLE.COM', category: 'Subscriptions', label: 'Subscriptions', score: 10, language: 'both' },
      { keyword: 'AMAZON PRIME', category: 'Subscriptions', label: 'Subscriptions', score: 10, language: 'both' },
      { keyword: 'DISNEY', category: 'Subscriptions', label: 'Subscriptions', score: 10, language: 'both' },
      { keyword: 'GYM', category: 'Subscriptions', label: 'Subscriptions', score: 10, language: 'both' },
      { keyword: 'GOODLIFE', category: 'Subscriptions', label: 'Subscriptions', score: 10, language: 'both' },
      { keyword: 'PLANET FITNESS', category: 'Subscriptions', label: 'Subscriptions', score: 10, language: 'both' },
      { keyword: 'CRAVE', category: 'Subscriptions', label: 'Subscriptions', score: 10, language: 'both' },
      
      // === FOOD ===
      // Groceries (short keywords)
      { keyword: 'GROCER', category: 'Food', label: 'Groceries', score: 10, language: 'en' },
      { keyword: 'SUPER', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'LOBLAWS', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'METRO', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'SOBEYS', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'IGA', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'PROVIGO', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'MAXI', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'WALMART', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'COSTCO', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'SAFEWAY', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'FRESHCO', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'NOFRILLS', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'FOODBASICS', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'WHOLE FOODS', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'FARMBOY', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'DEPANNEUR', category: 'Food', label: 'Groceries', score: 10, language: 'fr' },
      { keyword: '7-ELEVEN', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      { keyword: 'CIRCLE K', category: 'Food', label: 'Groceries', score: 10, language: 'both' },
      
      // Coffee (short keyword)
      { keyword: 'TIM', category: 'Food', label: 'Coffee', score: 10, language: 'both' },
      { keyword: 'STARBUCK', category: 'Food', label: 'Coffee', score: 10, language: 'both' },
      { keyword: 'SECOND CUP', category: 'Food', label: 'Coffee', score: 10, language: 'both' },
      { keyword: 'COFFEE', category: 'Food', label: 'Coffee', score: 10, language: 'both' },
      { keyword: 'CAFE', category: 'Food', label: 'Coffee', score: 10, language: 'both' },
      
      // Eating Out (short keywords)
      { keyword: 'MCDONALD', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'BURGER', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'PIZZA', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'SUBWAY', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'WENDYS', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'A&W', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'KFC', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'POPEYES', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'TACO BELL', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'CHIPOTLE', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'SWISS CHALET', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'BOSTON PIZZA', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'DOMINOS', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'ST-HUBERT', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'RESTAURANT', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'RESTO', category: 'Food', label: 'Eating Out', score: 10, language: 'fr' },
      { keyword: 'BAR', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'PUB', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'SUSHI', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'THAI', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'UBER EATS', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'DOORDASH', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      { keyword: 'SKIP', category: 'Food', label: 'Eating Out', score: 10, language: 'both' },
      
      // === TRAVEL ===
      { keyword: 'HOTEL', category: 'Travel', label: 'Travel', score: 10, language: 'both' },
      { keyword: 'AIRBNB', category: 'Travel', label: 'Travel', score: 10, language: 'both' },
      { keyword: 'AIR CANADA', category: 'Travel', label: 'Travel', score: 10, language: 'both' },
      { keyword: 'WESTJET', category: 'Travel', label: 'Travel', score: 10, language: 'both' },
      { keyword: 'VIA RAIL', category: 'Travel', label: 'Travel', score: 10, language: 'both' },
      { keyword: 'FLIGHT', category: 'Travel', label: 'Travel', score: 10, language: 'en' },
      { keyword: 'BOOKING', category: 'Travel', label: 'Travel', score: 10, language: 'both' },
      
      // === HEALTH ===
      { keyword: 'PHARM', category: 'Health', label: 'Health', score: 10, language: 'both' },
      { keyword: 'DRUG', category: 'Health', label: 'Health', score: 10, language: 'en' },
      { keyword: 'SHOPPERS', category: 'Health', label: 'Health', score: 10, language: 'both' },
      { keyword: 'JEAN COUTU', category: 'Health', label: 'Health', score: 10, language: 'both' },
      { keyword: 'REXALL', category: 'Health', label: 'Health', score: 10, language: 'both' },
      { keyword: 'MEDIC', category: 'Health', label: 'Health', score: 10, language: 'en' },
      { keyword: 'CLINIC', category: 'Health', label: 'Health', score: 10, language: 'en' },
      { keyword: 'CLINIQUE', category: 'Health', label: 'Health', score: 10, language: 'fr' },
      { keyword: 'DOCTOR', category: 'Health', label: 'Health', score: 10, language: 'en' },
      { keyword: 'DENT', category: 'Health', label: 'Health', score: 10, language: 'both' },
      { keyword: 'HOSPITAL', category: 'Health', label: 'Health', score: 10, language: 'en' },
      { keyword: 'HOPITAL', category: 'Health', label: 'Health', score: 10, language: 'fr' },
      
      // === TRANSPORT ===
      { keyword: 'UBER', category: 'Transport', label: 'Transport', score: 10, language: 'both' },
      { keyword: 'LYFT', category: 'Transport', label: 'Transport', score: 10, language: 'both' },
      { keyword: 'TAXI', category: 'Transport', label: 'Transport', score: 10, language: 'both' },
      { keyword: 'TRANSIT', category: 'Transport', label: 'Transport', score: 10, language: 'both' },
      { keyword: 'BUS', category: 'Transport', label: 'Transport', score: 10, language: 'both' },
      { keyword: 'PRESTO', category: 'Transport', label: 'Transport', score: 10, language: 'both' },
      { keyword: 'OPUS', category: 'Transport', label: 'Transport', score: 10, language: 'both' },
      { keyword: 'TTC', category: 'Transport', label: 'Transport', score: 10, language: 'both' },
      { keyword: 'STM', category: 'Transport', label: 'Transport', score: 10, language: 'both' },
      { keyword: 'TRANSLINK', category: 'Transport', label: 'Transport', score: 10, language: 'both' },
      { keyword: 'GAS', category: 'Transport', label: 'Car', score: 10, language: 'en' },
      { keyword: 'FUEL', category: 'Transport', label: 'Car', score: 10, language: 'en' },
      { keyword: 'ESSO', category: 'Transport', label: 'Car', score: 10, language: 'both' },
      { keyword: 'SHELL', category: 'Transport', label: 'Car', score: 10, language: 'both' },
      { keyword: 'PETRO', category: 'Transport', label: 'Car', score: 10, language: 'both' },
      { keyword: 'ULTRAMAR', category: 'Transport', label: 'Car', score: 10, language: 'both' },
      { keyword: 'PARKING', category: 'Transport', label: 'Transport', score: 10, language: 'en' },
      { keyword: 'STATIONNEMENT', category: 'Transport', label: 'Transport', score: 10, language: 'fr' },
      { keyword: 'CANADIAN TIRE GAS', category: 'Transport', label: 'Car', score: 10, language: 'both' },
      
      // === EDUCATION ===
      { keyword: 'TUITION', category: 'Education', label: 'Education', score: 10, language: 'en' },
      { keyword: 'SCHOOL', category: 'Education', label: 'Education', score: 10, language: 'en' },
      { keyword: 'ECOLE', category: 'Education', label: 'Education', score: 10, language: 'fr' },
      { keyword: 'UNIVERSITY', category: 'Education', label: 'Education', score: 10, language: 'en' },
      { keyword: 'COLLEGE', category: 'Education', label: 'Education', score: 10, language: 'both' },
      { keyword: 'TEXTBOOK', category: 'Education', label: 'Education', score: 10, language: 'en' },
      
      // === PERSONAL ===
      { keyword: 'CINEMA', category: 'Personal', label: 'Entertainment', score: 10, language: 'both' },
      { keyword: 'MOVIE', category: 'Personal', label: 'Entertainment', score: 10, language: 'en' },
      { keyword: 'THEATRE', category: 'Personal', label: 'Entertainment', score: 10, language: 'both' },
      { keyword: 'CONCERT', category: 'Personal', label: 'Entertainment', score: 10, language: 'both' },
      { keyword: 'SPORT', category: 'Personal', label: 'Sport & Hobbies', score: 10, language: 'both' },
      { keyword: 'GAME', category: 'Personal', label: 'Sport & Hobbies', score: 10, language: 'both' },
      { keyword: 'YOGA', category: 'Personal', label: 'Sport & Hobbies', score: 10, language: 'both' },
      
      // === SHOPPING ===
      { keyword: 'AMAZON', category: 'Shopping', label: 'Shopping', score: 10, language: 'both' },
      { keyword: 'AMZN', category: 'Shopping', label: 'Shopping', score: 10, language: 'both' },
      { keyword: 'CANADIAN TIRE', category: 'Shopping', label: 'Shopping', score: 10, language: 'both' },
      { keyword: 'HOME DEPOT', category: 'Shopping', label: 'Shopping', score: 10, language: 'both' },
      { keyword: 'RONA', category: 'Shopping', label: 'Shopping', score: 10, language: 'both' },
      { keyword: 'LOWES', category: 'Shopping', label: 'Shopping', score: 10, language: 'both' },
      { keyword: 'IKEA', category: 'Shopping', label: 'Shopping', score: 10, language: 'both' },
      { keyword: 'BEST BUY', category: 'Shopping', label: 'Shopping', score: 10, language: 'both' },
      { keyword: 'STAPLES', category: 'Shopping', label: 'Shopping', score: 10, language: 'both' },
      { keyword: 'DOLLARAMA', category: 'Shopping', label: 'Shopping', score: 10, language: 'both' },
      { keyword: 'WINNERS', category: 'Shopping', label: 'Clothes', score: 10, language: 'both' },
      { keyword: 'H&M', category: 'Shopping', label: 'Clothes', score: 10, language: 'both' },
      { keyword: 'ZARA', category: 'Shopping', label: 'Clothes', score: 10, language: 'both' },
      { keyword: 'OLD NAVY', category: 'Shopping', label: 'Clothes', score: 10, language: 'both' },
      { keyword: 'LULULEMON', category: 'Shopping', label: 'Clothes', score: 10, language: 'both' },
      { keyword: 'SPORTCHEK', category: 'Shopping', label: 'Clothes', score: 10, language: 'both' },
      { keyword: 'ROOTS', category: 'Shopping', label: 'Clothes', score: 10, language: 'both' },
      { keyword: 'THE BAY', category: 'Shopping', label: 'Clothes', score: 10, language: 'both' },
      { keyword: 'SEPHORA', category: 'Shopping', label: 'Beauty', score: 10, language: 'both' },
      { keyword: 'GIFT CARD', category: 'Shopping', label: 'Shopping', score: 10, language: 'en' },
      { keyword: 'CARTE CADEAU', category: 'Shopping', label: 'Shopping', score: 10, language: 'fr' },
      
      // === WORK ===
      { keyword: 'OFFICE', category: 'Work', label: 'Work', score: 10, language: 'en' },
      { keyword: 'BUREAU', category: 'Work', label: 'Work', score: 10, language: 'fr' },
      { keyword: 'CONFERENCE', category: 'Work', label: 'Work', score: 10, language: 'both' },
    ];
    
    console.log(`[Seed] Inserting ${keywords.length} optimized keywords...`);
    
    let count = 0;
    for (const kw of keywords) {
      try {
        await pool.query(
          `INSERT INTO admin_keywords (keyword, category, label, score, language, is_active) 
           VALUES ($1, $2, $3, $4, $5, true)`,
          [kw.keyword, kw.category, kw.label, kw.score, kw.language]
        );
        count++;
        if (count % 25 === 0) {
          console.log(`  Progress: ${count}/${keywords.length}...`);
        }
      } catch (err) {
        console.warn(`  Warning: Could not insert "${kw.keyword}":`, err.message);
      }
    }
    
    console.log(`✅ Inserted ${count} keywords\n`);
    
    // Show summary
    const result = await pool.query(`
      SELECT category, COUNT(*) as count 
      FROM admin_keywords 
      WHERE is_active = TRUE 
      GROUP BY category 
      ORDER BY category
    `);
    
    console.log('='.repeat(60));
    console.log('OPTIMIZED MIGRATION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total Keywords: ${count}`);
    console.log('\nBreakdown by category:');
    result.rows.forEach(row => {
      console.log(`  ${row.category.padEnd(20)} ${row.count} keywords`);
    });
    console.log('='.repeat(60));
    console.log('\n✅ Optimized patterns migrated to database!');
    console.log('✅ Short, powerful keywords (e.g. PHARM instead of PHARMACY/PHARMACIE)');
    console.log('✅ Removed weak/generic words');
    console.log('✅ Deduplicated and consolidated');
    console.log('✅ Admin dashboard ready at /admin\n');
    
  } catch (error) {
    console.error('[Error]', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seedOptimizedPatterns();

