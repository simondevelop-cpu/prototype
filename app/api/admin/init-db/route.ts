import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function initializeTables() {
  const client = await pool.connect();
  
  try {
    console.log('[DB Init] Starting database initialization...');
    
    // Add login_attempts column to users table if it doesn't exist
    try {
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'login_attempts'
      `);
      
      if (columnCheck.rows.length === 0) {
        console.log('[DB Init] Adding login_attempts column to users table...');
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN login_attempts INTEGER DEFAULT 0
        `);
        console.log('[DB Init] ✅ login_attempts column added');
      } else {
        console.log('[DB Init] ℹ️  login_attempts column already exists');
      }
    } catch (e: any) {
      console.log('[DB Init] Note: Could not add login_attempts column:', e.message);
      // Continue anyway - table might not exist yet
    }
    
    // Create admin_keywords table (NEW SCHEMA - no score/language)
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_keywords (
        id SERIAL PRIMARY KEY,
        keyword TEXT NOT NULL,
        category TEXT NOT NULL,
        label TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(keyword, category)
      )
    `);
    console.log('[DB Init] ✅ admin_keywords table created');
    
    // Create admin_merchants table (NEW SCHEMA - with alternate_patterns, no score)
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_merchants (
        id SERIAL PRIMARY KEY,
        merchant_pattern TEXT NOT NULL UNIQUE,
        alternate_patterns TEXT[],
        category TEXT NOT NULL,
        label TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[DB Init] ✅ admin_merchants table created');
    
    // Create categorization_learning table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS categorization_learning (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        description_pattern VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        label VARCHAR(100),
        frequency INTEGER DEFAULT 1,
        last_used TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, description_pattern)
      )
    `);
    console.log('[DB Init] ✅ categorization_learning table created');
    
    // Create l1_events table for login and dashboard access tracking (renamed from user_events)
    await client.query(`
      CREATE TABLE IF NOT EXISTS l1_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tokenized_user_id TEXT,
        event_type TEXT NOT NULL,
        event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB,
        is_admin BOOLEAN DEFAULT FALSE,
        session_id TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (tokenized_user_id) REFERENCES l0_user_tokenization(tokenized_user_id)
      )
    `);
    
    // Add session_id column if it doesn't exist (for existing tables)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'l1_events' AND column_name = 'session_id'
        ) THEN
          ALTER TABLE l1_events ADD COLUMN session_id TEXT;
        END IF;
      END $$;
    `);
    
    // Create index for session queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_l1_events_session_id 
      ON l1_events(session_id) 
      WHERE session_id IS NOT NULL;
    `);
    console.log('[DB Init] ✅ l1_events table created');
    
    // Populate tokenized_user_id for existing events
    await client.query(`
      UPDATE l1_events e
      SET tokenized_user_id = ut.tokenized_user_id
      FROM l0_user_tokenization ut
      WHERE ut.internal_user_id = e.user_id
        AND e.tokenized_user_id IS NULL
    `);
    
    // Create index for analytics queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_l1_events_tokenized_user_id 
      ON l1_events(tokenized_user_id) 
      WHERE tokenized_user_id IS NOT NULL
    `);
    
    // Create indexes for l1_events table
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_l1_events_user_id ON l1_events(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_l1_events_type ON l1_events(event_type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_l1_events_timestamp ON l1_events(event_timestamp)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_l1_events_user_type ON l1_events(user_id, event_type)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_l1_events_is_admin ON l1_events(is_admin) WHERE is_admin = TRUE
    `);
    console.log('[DB Init] ✅ l1_events indexes created');
    
    // Create onboarding_responses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS onboarding_responses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        
        -- Q1: Emotional calibration (multi-select, stored as array)
        emotional_state TEXT[],
        
        -- Q2: Financial context (multi-select, stored as array)
        financial_context TEXT[],
        
        -- Q3: Motivation/segmentation (single select)
        motivation TEXT,
        motivation_other TEXT,
        
        -- Q4: Acquisition source (single select)
        acquisition_source TEXT,
        acquisition_other TEXT,
        
        -- Q6: Insight preferences (multi-select, stored as array)
        insight_preferences TEXT[],
        insight_other TEXT,
        
        -- Note: PII fields (first_name, last_name, date_of_birth, recovery_phone, province_region)
        -- have been moved to l0_pii_users table for PII isolation
        
        -- Metadata
        last_step INTEGER DEFAULT 0,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[DB Init] ✅ onboarding_responses table created');
    
    // Create available_slots table for admin-managed booking availability
    await client.query(`
      CREATE TABLE IF NOT EXISTS available_slots (
        id SERIAL PRIMARY KEY,
        slot_date DATE NOT NULL,
        slot_time TIME NOT NULL,
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(slot_date, slot_time)
      )
    `);
    console.log('[DB Init] ✅ available_slots table created');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_available_slots_date_time ON available_slots(slot_date, slot_time)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_available_slots_available ON available_slots(is_available)
    `);
    console.log('[DB Init] ✅ available_slots indexes created');
    
    // Create chat_bookings table for user bookings
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_bookings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        booking_date DATE NOT NULL,
        booking_time TIME NOT NULL,
        preferred_method TEXT NOT NULL CHECK (preferred_method IN ('teams', 'google-meet', 'phone')),
        share_screen BOOLEAN,
        record_conversation BOOLEAN,
        notes TEXT,
          status TEXT DEFAULT 'requested' CHECK (status IN ('pending', 'requested', 'confirmed', 'cancelled', 'completed')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(booking_date, booking_time)
      )
    `);
    console.log('[DB Init] ✅ chat_bookings table created');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_bookings_user_id ON chat_bookings(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_bookings_date_time ON chat_bookings(booking_date, booking_time)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_bookings_status ON chat_bookings(status)
    `);
    console.log('[DB Init] ✅ chat_bookings indexes created');
    
    // Check if data exists
    const keywordCount = await client.query('SELECT COUNT(*) as count FROM admin_keywords');
    const merchantCount = await client.query('SELECT COUNT(*) as count FROM admin_merchants');
    
    const hasKeywords = parseInt(keywordCount.rows[0].count) > 0;
    const hasMerchants = parseInt(merchantCount.rows[0].count) > 0;
    
    if (hasKeywords && hasMerchants) {
      console.log('[DB Init] ✅ Data already seeded');
      return { tablesCreated: true, dataSeeded: false, message: 'Tables exist, data already seeded' };
    }
    
    // Seed keywords
    console.log('[DB Init] Seeding keywords...');
    const keywords = [
      // Housing
      ['RENT', 'Housing', 'Rent', 10, 'en'],
      ['LOYER', 'Housing', 'Rent', 10, 'fr'],
      ['MORTGAGE', 'Housing', 'Home', 10, 'en'],
      ['HYPOTHEQUE', 'Housing', 'Home', 10, 'fr'],
      ['VET', 'Housing', 'Pets', 10, 'both'],
      ['DAYCARE', 'Housing', 'Daycare', 10, 'en'],
      ['GARDERIE', 'Housing', 'Daycare', 10, 'fr'],
      
      // Bills
      ['HYDRO', 'Bills', 'Gas & Electricity', 10, 'both'],
      ['ELECTRIC', 'Bills', 'Gas & Electricity', 10, 'en'],
      ['UTIL', 'Bills', 'Gas & Electricity', 10, 'en'],
      ['BILLPAY', 'Bills', 'Other bills', 10, 'both'],
      ['PREAUTHORIZED', 'Bills', 'Other bills', 10, 'both'],
      ['AUTOPAY', 'Bills', 'Other bills', 10, 'both'],
      ['INSUR', 'Bills', 'Home insurance', 10, 'en'],
      ['ASSURANCE', 'Bills', 'Home insurance', 10, 'fr'],
      ['SERVICE CHARGE', 'Bills', 'Bank and other fees', 10, 'both'],
      ['BANK FEE', 'Bills', 'Bank and other fees', 10, 'both'],
      
      // Food
      ['GROCER', 'Food', 'Groceries', 10, 'en'],
      ['SUPER', 'Food', 'Groceries', 10, 'both'],
      ['DEPANNEUR', 'Food', 'Groceries', 10, 'fr'],
      ['COFFEE', 'Food', 'Coffee', 10, 'both'],
      ['CAFE', 'Food', 'Coffee', 10, 'both'],
      ['BURGER', 'Food', 'Eating Out', 10, 'both'],
      ['PIZZA', 'Food', 'Eating Out', 10, 'both'],
      ['RESTAURANT', 'Food', 'Eating Out', 10, 'both'],
      ['RESTO', 'Food', 'Eating Out', 10, 'fr'],
      ['BAR', 'Food', 'Eating Out', 10, 'both'],
      ['PUB', 'Food', 'Eating Out', 10, 'both'],
      ['SUSHI', 'Food', 'Eating Out', 10, 'both'],
      ['THAI', 'Food', 'Eating Out', 10, 'both'],
      
      // Travel
      ['HOTEL', 'Travel', 'Travel', 10, 'both'],
      ['FLIGHT', 'Travel', 'Travel', 10, 'en'],
      
      // Health
      ['PHARM', 'Health', 'Health', 10, 'both'],
      ['DRUG', 'Health', 'Health', 10, 'en'],
      ['MEDIC', 'Health', 'Health', 10, 'en'],
      ['CLINIC', 'Health', 'Health', 10, 'en'],
      ['CLINIQUE', 'Health', 'Health', 10, 'fr'],
      ['DOCTOR', 'Health', 'Health', 10, 'en'],
      ['DENT', 'Health', 'Health', 10, 'both'],
      ['HOSPITAL', 'Health', 'Health', 10, 'en'],
      ['HOPITAL', 'Health', 'Health', 10, 'fr'],
      
      // Transport
      ['TAXI', 'Transport', 'Transport', 10, 'both'],
      ['TRANSIT', 'Transport', 'Transport', 10, 'both'],
      ['BUS', 'Transport', 'Transport', 10, 'both'],
      ['OPUS', 'Transport', 'Transport', 10, 'both'],
      ['GAS', 'Transport', 'Car', 10, 'en'],
      ['FUEL', 'Transport', 'Car', 10, 'en'],
      ['PARKING', 'Transport', 'Transport', 10, 'en'],
      ['STATIONNEMENT', 'Transport', 'Transport', 10, 'fr'],
      
      // Education
      ['TUITION', 'Education', 'Education', 10, 'en'],
      ['SCHOOL', 'Education', 'Education', 10, 'en'],
      ['ECOLE', 'Education', 'Education', 10, 'fr'],
      ['UNIVERSITY', 'Education', 'Education', 10, 'en'],
      ['COLLEGE', 'Education', 'Education', 10, 'both'],
      ['TEXTBOOK', 'Education', 'Education', 10, 'en'],
      
      // Personal
      ['CINEMA', 'Personal', 'Entertainment', 10, 'both'],
      ['MOVIE', 'Personal', 'Entertainment', 10, 'en'],
      ['THEATRE', 'Personal', 'Entertainment', 10, 'both'],
      ['CONCERT', 'Personal', 'Entertainment', 10, 'both'],
      ['SPORT', 'Personal', 'Sport & Hobbies', 10, 'both'],
      ['GYM', 'Personal', 'Gym membership', 10, 'both'],
      ['YOGA', 'Personal', 'Sport & Hobbies', 10, 'both'],
      
      // Shopping
      ['GIFT CARD', 'Shopping', 'Shopping', 10, 'en'],
      ['CARTE CADEAU', 'Shopping', 'Shopping', 10, 'fr'],
      
      // Work
      ['OFFICE', 'Work', 'Work', 10, 'en'],
      ['BUREAU', 'Work', 'Work', 10, 'fr'],
      ['CONFERENCE', 'Work', 'Work', 10, 'both'],
    ];
    
    for (const [keyword, category, label, score, language] of keywords) {
      await client.query(
        'INSERT INTO admin_keywords (keyword, category, label, is_active) VALUES ($1, $2, $3, true) ON CONFLICT DO NOTHING',
        [keyword, category, label]
      );
    }
    console.log(`[DB Init] ✅ Seeded ${keywords.length} keywords`);
    
    // Seed merchants (abbreviated for space - include ALL ~200 from server.js)
    const merchants = [
      // Groceries
      ['LOBLAWS', 'Food', 'Groceries', 15],
      ['SUPERSTORE', 'Food', 'Groceries', 15],
      ['NO FRILLS', 'Food', 'Groceries', 15],
      ['NOFRILLS', 'Food', 'Groceries', 15],
      ['METRO', 'Food', 'Groceries', 12],
      ['SOBEYS', 'Food', 'Groceries', 15],
      ['IGA', 'Food', 'Groceries', 12],
      ['SAFEWAY', 'Food', 'Groceries', 15],
      ['WALMART', 'Food', 'Groceries', 12],
      ['COSTCO', 'Food', 'Groceries', 12],
      ['FOODBASICS', 'Food', 'Groceries', 15],
      ['FRESHCO', 'Food', 'Groceries', 15],
      ['MAXI', 'Food', 'Groceries', 12],
      ['PROVIGO', 'Food', 'Groceries', 15],
      ['SUPER C', 'Food', 'Groceries', 15],
      ['SAVE-ON-FOODS', 'Food', 'Groceries', 15],
      ['THRIFTY FOODS', 'Food', 'Groceries', 15],
      ['WHOLE FOODS', 'Food', 'Groceries', 15],
      ['FARMBOY', 'Food', 'Groceries', 15],
      ['FARM BOY', 'Food', 'Groceries', 15],
      ['CO-OP', 'Food', 'Groceries', 12],
      ['COOP', 'Food', 'Groceries', 12],
      
      // Coffee & Fast Food
      ['TIM', 'Food', 'Coffee', 15],
      ['TIMS', 'Food', 'Coffee', 15],
      ['STARBUCK', 'Food', 'Coffee', 15],
      ['SECOND CUP', 'Food', 'Coffee', 15],
      ['VAN HOUTTE', 'Food', 'Coffee', 15],
      ['BRIDGEHEAD', 'Food', 'Coffee', 15],
      ['MCDONALD', 'Food', 'Eating Out', 15],
      ['BURGER KING', 'Food', 'Eating Out', 15],
      ['WENDYS', 'Food', 'Eating Out', 15],
      ['A&W', 'Food', 'Eating Out', 12],
      ['HARVEY', 'Food', 'Eating Out', 15],
      ['FIVE GUYS', 'Food', 'Eating Out', 15],
      ['SUBWAY', 'Food', 'Eating Out', 15],
      ['QUIZNOS', 'Food', 'Eating Out', 15],
      ['MR SUB', 'Food', 'Eating Out', 15],
      ['POPEYES', 'Food', 'Eating Out', 15],
      ['KFC', 'Food', 'Eating Out', 12],
      ['TACO BELL', 'Food', 'Eating Out', 15],
      ['CHIPOTLE', 'Food', 'Eating Out', 15],
      ['QUESADA', 'Food', 'Eating Out', 15],
      ['FRESHII', 'Food', 'Eating Out', 15],
      ['PANERA', 'Food', 'Eating Out', 15],
      ['CORA', 'Food', 'Eating Out', 12],
      
      // Pizza
      ['PIZZA HUT', 'Food', 'Eating Out', 15],
      ['DOMINOS', 'Food', 'Eating Out', 15],
      ['PIZZA PIZZA', 'Food', 'Eating Out', 15],
      ['PAPA JOHNS', 'Food', 'Eating Out', 15],
      ['LITTLE CAESARS', 'Food', 'Eating Out', 15],
      ['BOSTON PIZZA', 'Food', 'Eating Out', 15],
      
      // Casual Dining
      ['SWISS CHALET', 'Food', 'Eating Out', 15],
      ['MONTANA', 'Food', 'Eating Out', 15],
      ['KELSEY', 'Food', 'Eating Out', 15],
      ['MILESTONES', 'Food', 'Eating Out', 15],
      ['EARLS', 'Food', 'Eating Out', 15],
      ['MOXIES', 'Food', 'Eating Out', 15],
      ['THE KEG', 'Food', 'Eating Out', 15],
      ['CACTUS CLUB', 'Food', 'Eating Out', 15],
      ['JOEY', 'Food', 'Eating Out', 12],
      ['ST-HUBERT', 'Food', 'Eating Out', 15],
      
      // Delivery
      ['UBER EATS', 'Food', 'Eating Out', 15],
      ['DOORDASH', 'Food', 'Eating Out', 15],
      ['SKIP', 'Food', 'Eating Out', 15],
      
      // Transport
      ['PRESTO', 'Transport', 'Transport', 15],
      ['TTC', 'Transport', 'Transport', 12],
      ['STM', 'Transport', 'Transport', 10],
      ['TRANSLINK', 'Transport', 'Transport', 15],
      ['GO TRANSIT', 'Transport', 'Transport', 15],
      ['OC TRANSPO', 'Transport', 'Transport', 15],
      ['BIXI', 'Transport', 'Transport', 15],
      ['VIA RAIL', 'Travel', 'Travel', 15],
      ['UBER', 'Transport', 'Transport', 12],
      ['LYFT', 'Transport', 'Transport', 12],
      
      // Gas Stations
      ['PETRO-CANADA', 'Transport', 'Car', 15],
      ['PETRO CANADA', 'Transport', 'Car', 15],
      ['SHELL', 'Transport', 'Car', 12],
      ['ESSO', 'Transport', 'Car', 12],
      ['CANADIAN TIRE GAS', 'Transport', 'Car', 20],
      ['HUSKY', 'Transport', 'Car', 12],
      ['ULTRAMAR', 'Transport', 'Car', 15],
      ['IRVING', 'Transport', 'Car', 12],
      
      // Telecom
      ['ROGERS', 'Bills', 'Phone', 15],
      ['BELL', 'Bills', 'Phone', 12],
      ['TELUS', 'Bills', 'Phone', 15],
      ['FIDO', 'Bills', 'Phone', 15],
      ['KOODO', 'Bills', 'Phone', 15],
      ['VIRGIN MOBILE', 'Bills', 'Phone', 15],
      ['FREEDOM', 'Bills', 'Phone', 15],
      ['VIDEOTRON', 'Bills', 'Internet', 15],
      ['SHAW', 'Bills', 'Internet', 12],
      ['COGECO', 'Bills', 'Internet', 15],
      
      // Utilities
      ['HYDRO ONE', 'Bills', 'Gas & Electricity', 15],
      ['HYDRO OTTAWA', 'Bills', 'Gas & Electricity', 15],
      ['HYDRO QUEBEC', 'Bills', 'Gas & Electricity', 15],
      ['TORONTO HYDRO', 'Bills', 'Gas & Electricity', 15],
      ['BC HYDRO', 'Bills', 'Gas & Electricity', 15],
      ['FORTISBC', 'Bills', 'Gas & Electricity', 15],
      ['FORTIS', 'Bills', 'Gas & Electricity', 12],
      ['ENBRIDGE', 'Bills', 'Gas & Electricity', 15],
      ['EPCOR', 'Bills', 'Gas & Electricity', 15],
      ['ATCO', 'Bills', 'Gas & Electricity', 12],
      
      // Subscriptions
      ['NETFLIX', 'Subscriptions', 'Subscriptions', 15],
      ['SPOTIFY', 'Subscriptions', 'Subscriptions', 15],
      ['APPLE.COM', 'Subscriptions', 'Subscriptions', 15],
      ['APPLE MUSIC', 'Subscriptions', 'Subscriptions', 15],
      ['APPLE TV', 'Subscriptions', 'Subscriptions', 15],
      ['AMAZON PRIME', 'Subscriptions', 'Subscriptions', 15],
      ['DISNEY', 'Subscriptions', 'Subscriptions', 15],
      ['HBO', 'Subscriptions', 'Subscriptions', 12],
      ['YOUTUBE PREMIUM', 'Subscriptions', 'Subscriptions', 15],
      ['CRAVE', 'Subscriptions', 'Subscriptions', 15],
      ['DAZN', 'Subscriptions', 'Subscriptions', 15],
      ['MICROSOFT 365', 'Subscriptions', 'Subscriptions', 15],
      ['ADOBE', 'Subscriptions', 'Subscriptions', 15],
      ['DROPBOX', 'Subscriptions', 'Subscriptions', 15],
      ['GOOGLE ONE', 'Subscriptions', 'Subscriptions', 15],
      ['ICLOUD', 'Subscriptions', 'Subscriptions', 15],
      ['ZOOM', 'Subscriptions', 'Subscriptions', 12],
      ['PATREON', 'Subscriptions', 'Subscriptions', 15],
      
      // Gyms
      ['GOODLIFE', 'Personal', 'Gym membership', 15],
      ['PLANET FITNESS', 'Personal', 'Gym membership', 15],
      ['FIT4LESS', 'Personal', 'Gym membership', 15],
      ['ANYTIME FITNESS', 'Personal', 'Gym membership', 15],
      
      // Shopping
      ['AMAZON', 'Shopping', 'Shopping', 15],
      ['AMZN', 'Shopping', 'Shopping', 15],
      ['EBAY', 'Shopping', 'Shopping', 12],
      ['ETSY', 'Shopping', 'Shopping', 12],
      ['CANADIAN TIRE', 'Shopping', 'Shopping', 15],
      ['HOME DEPOT', 'Shopping', 'Shopping', 15],
      ['LOWES', 'Shopping', 'Shopping', 15],
      ['RONA', 'Shopping', 'Shopping', 15],
      ['IKEA', 'Shopping', 'Shopping', 15],
      ['STRUCTUBE', 'Shopping', 'Shopping', 15],
      ['THE BRICK', 'Shopping', 'Shopping', 15],
      ['BEST BUY', 'Shopping', 'Shopping', 15],
      ['STAPLES', 'Shopping', 'Shopping', 15],
      ['DOLLARAMA', 'Shopping', 'Shopping', 15],
      ['DOLLAR TREE', 'Shopping', 'Shopping', 15],
      ['INDIGO', 'Shopping', 'Shopping', 15],
      ['CHAPTERS', 'Shopping', 'Shopping', 15],
      ['MICHAELS', 'Shopping', 'Shopping', 15],
      ['BULK BARN', 'Shopping', 'Shopping', 15],
      
      // Clothing
      ['WINNERS', 'Shopping', 'Clothes', 15],
      ['MARSHALLS', 'Shopping', 'Clothes', 15],
      ['H&M', 'Shopping', 'Clothes', 12],
      ['ZARA', 'Shopping', 'Clothes', 12],
      ['UNIQLO', 'Shopping', 'Clothes', 15],
      ['OLD NAVY', 'Shopping', 'Clothes', 15],
      ['GAP', 'Shopping', 'Clothes', 10],
      ['SPORTCHEK', 'Shopping', 'Clothes', 15],
      ['LULULEMON', 'Shopping', 'Clothes', 15],
      ['ROOTS', 'Shopping', 'Clothes', 12],
      ['ARITZIA', 'Shopping', 'Clothes', 15],
      ['SIMONS', 'Shopping', 'Clothes', 15],
      ['THE BAY', 'Shopping', 'Clothes', 15],
      ['NIKE', 'Shopping', 'Clothes', 12],
      ['ADIDAS', 'Shopping', 'Clothes', 12],
      ['ALDO', 'Shopping', 'Clothes', 12],
      
      // Pharmacy & Beauty
      ['SHOPPERS', 'Shopping', 'Beauty', 12],
      ['PHARMAPRIX', 'Shopping', 'Beauty', 15],
      ['SEPHORA', 'Shopping', 'Beauty', 15],
      ['JEAN COUTU', 'Shopping', 'Beauty', 15],
      ['REXALL', 'Shopping', 'Beauty', 15],
      ['LONDON DRUGS', 'Shopping', 'Beauty', 15],
      
      // Airlines & Hotels
      ['AIR CANADA', 'Travel', 'Travel', 15],
      ['WESTJET', 'Travel', 'Travel', 15],
      ['AIRBNB', 'Travel', 'Travel', 15],
      ['BOOKING', 'Travel', 'Travel', 15],
      ['EXPEDIA', 'Travel', 'Travel', 15],
    ];
    
    for (const [pattern, category, label, score] of merchants) {
      await client.query(
        'INSERT INTO admin_merchants (merchant_pattern, alternate_patterns, category, label, is_active) VALUES ($1, $2, $3, $4, true) ON CONFLICT DO NOTHING',
        [pattern, [], category, label]
      );
    }
    console.log(`[DB Init] ✅ Seeded ${merchants.length} merchants`);
    
    return {
      tablesCreated: true,
      dataSeeded: true,
      keywordCount: keywords.length,
      merchantCount: merchants.length,
      totalPatterns: keywords.length + merchants.length
    };
    
  } catch (error: any) {
    console.error('[DB Init] Error:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await initializeTables();
    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      ...result
    });
  } catch (error: any) {
    console.error('Database initialization error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to initialize database',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

