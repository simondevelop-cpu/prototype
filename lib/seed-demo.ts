import dayjs from 'dayjs';

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@canadianinsights.ca';

export async function seedDemoTransactions(pool: any, userId: string) {
  console.log('[DB] Seeding 12 months of realistic Canadian demo transactions...');
  
  const transactions = [];
  const today = dayjs('2025-10-22'); // Current date: Oct 22, 2025
  const startDate = today.subtract(11, 'month').startOf('month');

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
      transactions.push({
        date: monthStart.add(dayOffset, 'day').format('YYYY-MM-DD'),
        description: ['Starbucks', 'Tim Hortons', 'Second Cup', 'Local Café'][Math.floor(Math.random() * 4)],
        merchant: ['Starbucks', 'Tim Hortons', 'Second Cup', 'Local Café'][Math.floor(Math.random() * 4)],
        amount: -(Math.floor(Math.random() * 10) + 5), // $5-15
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
      transactions.push({
        date: monthStart.add(dayOffset, 'day').format('YYYY-MM-DD'),
        description: ['Boston Pizza', 'Swiss Chalet', 'The Keg', 'Montréal Poutine', 'Sushi Shop'][Math.floor(Math.random() * 5)],
        merchant: ['Boston Pizza', 'Swiss Chalet', 'The Keg', 'Montréal Poutine', 'Sushi Shop'][Math.floor(Math.random() * 5)],
        amount: -(Math.floor(Math.random() * 60) + 30), // $30-90
        cashflow: 'expense',
        category: 'Dining',
        account: 'Credit Card',
        label: 'Restaurants'
      });
    }
  }
  
  // Insert all transactions
  for (const tx of transactions) {
    await pool.query(
      `INSERT INTO transactions (user_id, date, description, merchant, amount, cashflow, category, account, label, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [userId, tx.date, tx.description, tx.merchant, tx.amount, tx.cashflow, tx.category, tx.account, tx.label]
    );
  }
  
  console.log('[DB] Successfully seeded', transactions.length, 'demo transactions');
}

export async function ensureDemoDataExists(pool: any) {
  try {
    console.log('[DB] Checking if demo data exists for:', DEMO_EMAIL.toLowerCase());
    const demoUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [DEMO_EMAIL.toLowerCase()]
    );
    
    if (demoUser.rows.length > 0) {
      const userId = demoUser.rows[0].id;
      console.log('[DB] Demo user found, ID:', userId);
      
      const txCount = await pool.query(
        'SELECT COUNT(*) as count FROM transactions WHERE user_id = $1',
        [userId]
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

