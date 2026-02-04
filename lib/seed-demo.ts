import dayjs from 'dayjs';
import { ensureTokenizedForAnalytics } from './tokenization';

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@canadianinsights.ca';

export async function seedDemoTransactions(pool: any, userId: string | number) {
  console.log('[DB] Seeding 12 months of realistic Canadian demo transactions...');
  
  const transactions = [];
  const today = dayjs('2025-10-22'); // Current date: Oct 22, 2025
  // Start from Nov 2024, end at Oct 2025 (12 full months)
  const startDate = dayjs('2024-11-01'); // November 2024

  // Monthly recurring transactions
  for (let month = 0; month < 12; month++) {
    const monthStart = startDate.add(month, 'month');
    
    // Salary (15th of month)
    transactions.push({
      date: monthStart.add(14, 'day').format('YYYY-MM-DD'),
      description: 'Salary Deposit',
      merchant: 'Employer Inc',
      amount: 5000,
      cashflow: 'income',
      category: 'Employment',
      account: 'Checking',
      label: 'Regular Income'
    });
    
    // Rent (1st of month)
    transactions.push({
      date: monthStart.format('YYYY-MM-DD'),
      description: 'Rent Payment',
      merchant: 'Landlord',
      amount: -1650,
      cashflow: 'expense',
      category: 'Housing',
      account: 'Checking',
      label: 'Essential'
    });
    
    // Internet (5th)
    transactions.push({
      date: monthStart.add(4, 'day').format('YYYY-MM-DD'),
      description: 'Rogers Internet',
      merchant: 'Rogers',
      amount: -85,
      cashflow: 'expense',
      category: 'Utilities',
      account: 'Credit Card',
      label: 'Essential'
    });
    
    // Phone (5th)
    transactions.push({
      date: monthStart.add(4, 'day').format('YYYY-MM-DD'),
      description: 'Telus Mobile',
      merchant: 'Telus',
      amount: -65,
      cashflow: 'expense',
      category: 'Utilities',
      account: 'Credit Card',
      label: 'Essential'
    });
    
    // Hydro (10th)
    transactions.push({
      date: monthStart.add(9, 'day').format('YYYY-MM-DD'),
      description: 'Hydro-Québec',
      merchant: 'Hydro-Québec',
      amount: -(Math.floor(Math.random() * 60) + 90), // $90-150
      cashflow: 'expense',
      category: 'Utilities',
      account: 'Checking',
      label: 'Essential'
    });
    
    // Weekly groceries (4 times per month)
    for (let week = 0; week < 4; week++) {
      transactions.push({
        date: monthStart.add(week * 7 + 3, 'day').format('YYYY-MM-DD'),
        description: ['Loblaws', 'Metro', 'Sobeys', 'No Frills'][week % 4],
        merchant: ['Loblaws', 'Metro', 'Sobeys', 'No Frills'][week % 4],
        amount: -(Math.floor(Math.random() * 80) + 120), // $120-200
        cashflow: 'expense',
        category: 'Groceries',
        account: 'Credit Card',
        label: 'Food'
      });
    }
    
    // Transit pass (5th)
    transactions.push({
      date: monthStart.add(4, 'day').format('YYYY-MM-DD'),
      description: 'Presto Card Load',
      merchant: 'Presto',
      amount: -156,
      cashflow: 'expense',
      category: 'Transportation',
      account: 'Debit Card',
      label: 'Commute'
    });
    
    // Coffee/food (15-20 times per month)
    const coffeeCount = 15 + Math.floor(Math.random() * 6);
    for (let i = 0; i < coffeeCount; i++) {
      const dayOffset = Math.floor(Math.random() * 28);
      const coffeeVendors = ['Starbucks', 'Tim Hortons', 'Second Cup', 'Local Café'];
      const vendor = coffeeVendors[Math.floor(Math.random() * coffeeVendors.length)];
      // Add time-based variance to avoid duplicates
      const amount = -(Math.floor(Math.random() * 10) + 5 + (i * 0.01)); // $5-15 with micro-variance
      transactions.push({
        date: monthStart.add(dayOffset, 'day').format('YYYY-MM-DD'),
        description: `${vendor} #${i + 1}`,
        merchant: vendor,
        amount: Math.round(amount * 100) / 100, // Round to 2 decimals
        cashflow: 'expense',
        category: 'Dining',
        account: 'Credit Card',
        label: 'Coffee & Snacks'
      });
    }
    
    // Restaurants (8-12 per month)
    const restaurantCount = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < restaurantCount; i++) {
      const dayOffset = Math.floor(Math.random() * 28);
      const restaurants = ['Boston Pizza', 'Swiss Chalet', 'The Keg', 'Montréal Poutine', 'Sushi Shop'];
      const restaurant = restaurants[Math.floor(Math.random() * restaurants.length)];
      // Add index-based variance to avoid duplicates
      const amount = -(Math.floor(Math.random() * 60) + 30 + (i * 0.01)); // $30-90 with micro-variance
      transactions.push({
        date: monthStart.add(dayOffset, 'day').format('YYYY-MM-DD'),
        description: `${restaurant} #${i + 1}`,
        merchant: restaurant,
        amount: Math.round(amount * 100) / 100, // Round to 2 decimals
        cashflow: 'expense',
        category: 'Dining',
        account: 'Credit Card',
        label: 'Restaurants'
      });
    }
  }
  
  // Get tokenized user ID for inserts
  const internalUserId = typeof userId === 'string' ? parseInt(userId) : userId;
  const tokenizedUserId = await ensureTokenizedForAnalytics(internalUserId);
  if (!tokenizedUserId) {
    throw new Error('Failed to get tokenized user identifier for seeding');
  }
  
  // Insert all transactions into L1 fact table
  for (const tx of transactions) {
    await pool.query(
      `INSERT INTO l1_transaction_facts (tokenized_user_id, transaction_date, description, merchant, amount, cashflow, category, account, label, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [tokenizedUserId, tx.date, tx.description, tx.merchant, tx.amount, tx.cashflow, tx.category, tx.account, tx.label]
    );
  }
  
  console.log('[DB] Successfully seeded', transactions.length, 'demo transactions');
}

export async function ensureDemoDataExists(pool: any) {
  try {
    console.log('[DB] Checking if demo data exists for:', DEMO_EMAIL.toLowerCase());
    // Query l0_pii_users for email, then get id from l1_user_permissions
    const demoUser = await pool.query(
      `SELECT perm.id 
       FROM l0_pii_users pii
       JOIN l1_user_permissions perm ON pii.internal_user_id = perm.id
       WHERE pii.email = $1 LIMIT 1`,
      [DEMO_EMAIL.toLowerCase()]
    );
    
    if (demoUser.rows.length > 0) {
      const userId = demoUser.rows[0].id;
      console.log('[DB] Demo user found, ID:', userId);
      
      // Get tokenized user ID for checking
      const internalUserId = typeof userId === 'string' ? parseInt(userId) : userId;
      const tokenizedUserId = await ensureTokenizedForAnalytics(internalUserId);
      
      const txCount = await pool.query(
        'SELECT COUNT(*) as count FROM l1_transaction_facts WHERE tokenized_user_id = $1',
        [tokenizedUserId || userId] // Fallback to userId if tokenization fails (for backward compat during migration)
      );
      
      const count = parseInt(txCount.rows[0].count);
      console.log('[DB] Demo user transaction count:', count);
      
      if (count === 0) {
        console.log('[DB] Demo user has no transactions, seeding...');
        await seedDemoTransactions(pool, userId);
        console.log('[DB] Seeding completed!');
      } else {
        console.log('[DB] Demo user has transactions, skipping seed');
      }
    } else {
      console.log('[DB] Demo user not found in database');
    }
  } catch (error) {
    console.error('[DB] Error checking demo data:', error);
  }
}

