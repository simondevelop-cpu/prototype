/**
 * Canadian Insights - Smart Expense Categorization Engine
 * 
 * SIMPLIFIED FIRST-MATCH APPROACH
 * - Uses short keywords for maximum coverage
 * - Categories checked in priority order
 * - First match wins (no scoring needed)
 * - Database-driven with fallback to hardcoded patterns
 */

// Cache for database patterns (refreshed periodically)
let cachedKeywords: KeywordPattern[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch keyword patterns from database
 * Falls back to hardcoded patterns if database is unavailable
 */
export async function refreshCategorizationPatterns(): Promise<void> {
  const now = Date.now();
  
  // Use cache if still valid
  if (cachedKeywords && (now - lastFetchTime) < CACHE_TTL) {
    return;
  }

  try {
    // Fetch keywords from database
    const keywordsRes = await fetch('/api/admin/keywords');
    if (keywordsRes.ok) {
      const keywordsData = await keywordsRes.json();
      // Group keywords by category+label
      const keywordMap = new Map<string, string[]>();
      for (const kw of keywordsData.keywords) {
        const key = `${kw.category}|${kw.label}`;
        if (!keywordMap.has(key)) {
          keywordMap.set(key, []);
        }
        keywordMap.get(key)!.push(kw.keyword);
      }
      
      cachedKeywords = Array.from(keywordMap.entries()).map(([key, keywords]) => {
        const [category, label] = key.split('|');
        return {
          keywords,
          category,
          label,
          score: 10, // Not used in new logic
        };
      });
    }

    lastFetchTime = now;
    console.log(`[Categorization] Loaded ${cachedKeywords?.length || 0} keyword groups from database`);
  } catch (error) {
    console.warn('[Categorization] Failed to fetch from database, using hardcoded patterns:', error);
    cachedKeywords = null;
  }
}

// Category mappings (in priority order for categorization)
export const CATEGORIES = {
  Housing: ['Home', 'Rent', 'Pets', 'Daycare'],
  Bills: ['Bank and other fees', 'Other bills', 'Home insurance', 'Gas', 'Car insurance', 'Gas & Electricity', 'Phone', 'Internet'],
  Subscriptions: ['Subscriptions'],
  Food: ['Groceries', 'Eating Out', 'Coffee'],
  Travel: ['Travel'],
  Health: ['Health'],
  Transport: ['Transport', 'Car'],
  Education: ['Education'],
  Personal: ['Family & Personal', 'Sport & Hobbies', 'Entertainment', 'Gym membership'],
  Shopping: ['Shopping', 'Clothes', 'Beauty'],
  Work: ['Work'],
};

// Category priority order for first-match logic
const CATEGORY_PRIORITY = [
  'Housing',
  'Bills',
  'Subscriptions',
  'Food',
  'Travel',
  'Health',
  'Transport',
  'Education',
  'Personal',
  'Shopping',
  'Work',
];

/**
 * Clean merchant name by removing location/branch identifiers
 */
function cleanMerchantName(description: string): string {
  return description
    .toUpperCase()
    .replace(/#\d+/g, '') // Remove #1234
    .replace(/STORE\s*\d+/g, '') // Remove STORE 5678
    .replace(/[A-Z]{2}\s*\d{5}/g, '') // Remove postal codes like ON M5H1J
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// Keyword patterns - SHORT keywords for maximum coverage
// Includes merchants as keywords (e.g., "TIM" for Tim Hortons)
interface KeywordPattern {
  keywords: string[];
  category: string;
  label: string;
  score: number; // Not used in new logic, kept for database compatibility
}

const KEYWORD_PATTERNS: KeywordPattern[] = [
  // === HOUSING ===
  { keywords: ['RENT', 'LOYER', 'LANDLORD'], score: 10, category: 'Housing', label: 'Rent' },
  { keywords: ['MORTGAGE', 'HYPOTHEQUE'], score: 10, category: 'Housing', label: 'Home' },
  { keywords: ['VET', 'VETERINAR', 'PET'], score: 10, category: 'Housing', label: 'Pets' },
  { keywords: ['DAYCARE', 'GARDERIE', 'CHILDCARE'], score: 10, category: 'Housing', label: 'Daycare' },
  
  // === BILLS ===
  { keywords: ['BILL PAYMENT', 'BILLPAY', 'PREAUTHORIZED', 'PREAUTH', 'AUTOPAY'], score: 10, category: 'Bills', label: 'Other bills' },
  { keywords: ['UTIL', 'WATER', 'EAU', 'HYDRO', 'ELECTRIC', 'GAS BILL'], score: 10, category: 'Bills', label: 'Gas & Electricity' },
  { keywords: ['ROGERS', 'BELL', 'TELUS', 'FIDO', 'VIDEOTRON', 'FREEDOM'], score: 10, category: 'Bills', label: 'Phone' },
  { keywords: ['INTERNET', 'CABLE'], score: 10, category: 'Bills', label: 'Internet' },
  { keywords: ['INSURANCE', 'ASSURANCE'], score: 10, category: 'Bills', label: 'Home insurance' },
  { keywords: ['SERVICE CHARGE', 'BANK FEE', 'NSF', 'OVERDRAFT'], score: 10, category: 'Bills', label: 'Bank and other fees' },
  
  // === SUBSCRIPTIONS ===
  { keywords: ['NETFLIX', 'SPOTIFY', 'APPLE.COM', 'AMAZON PRIME', 'DISNEY'], score: 10, category: 'Subscriptions', label: 'Subscriptions' },
  { keywords: ['SUBSCRIPTION', 'RECURRING', 'MONTHLY', 'MENSUEL'], score: 8, category: 'Subscriptions', label: 'Subscriptions' },
  { keywords: ['GYM', 'FITNESS', 'YOGA', 'GOODLIFE', 'PLANET FITNESS'], score: 10, category: 'Subscriptions', label: 'Subscriptions' },
  
  // === FOOD ===
  // Groceries (short keywords + major chains)
  { keywords: ['GROCER', 'SUPERMARKET', 'MARKET', 'LOBLAWS', 'METRO', 'SOBEYS', 'IGA', 'PROVIGO'], score: 10, category: 'Food', label: 'Groceries' },
  { keywords: ['WALMART', 'COSTCO', 'NOFRILLS', 'FRESHCO', 'FOODBASICS'], score: 10, category: 'Food', label: 'Groceries' },
  { keywords: ['DEPANNEUR', 'CONVENIENCE', '7-ELEVEN', 'CIRCLE K'], score: 10, category: 'Food', label: 'Groceries' },
  
  // Coffee (short keywords)
  { keywords: ['TIM', 'STARBUCK', 'SECOND CUP', 'COFFEE', 'CAFE'], score: 10, category: 'Food', label: 'Coffee' },
  
  // Eating Out (short keywords + chains)
  { keywords: ['MCDONALD', 'BURGER KING', 'WENDY', 'A&W', 'KFC', 'SUBWAY', 'PIZZA'], score: 10, category: 'Food', label: 'Eating Out' },
  { keywords: ['RESTAURANT', 'RESTO', 'BAR', 'PUB', 'GRILL', 'BISTRO'], score: 8, category: 'Food', label: 'Eating Out' },
  { keywords: ['SUSHI', 'THAI', 'CHINESE', 'INDIAN', 'JAPANESE'], score: 8, category: 'Food', label: 'Eating Out' },
  
  // === TRAVEL ===
  { keywords: ['HOTEL', 'AIRBNB', 'BOOKING', 'EXPEDIA'], score: 10, category: 'Travel', label: 'Travel' },
  { keywords: ['AIRLINE', 'AIR CANADA', 'WESTJET', 'FLIGHT'], score: 10, category: 'Travel', label: 'Travel' },
  { keywords: ['TRAVEL', 'VOYAGE', 'VACATION'], score: 8, category: 'Travel', label: 'Travel' },
  
  // === HEALTH ===
  { keywords: ['PHARM', 'DRUG', 'SHOPPERS', 'JEAN COUTU', 'REXALL'], score: 10, category: 'Health', label: 'Health' },
  { keywords: ['MEDIC', 'CLINIC', 'DOCTOR', 'DENTIST', 'HOSPITAL'], score: 10, category: 'Health', label: 'Health' },
  { keywords: ['HEALTH', 'SANTE'], score: 8, category: 'Health', label: 'Health' },
  
  // === TRANSPORT ===
  { keywords: ['UBER', 'LYFT', 'TAXI'], score: 10, category: 'Transport', label: 'Transport' },
  { keywords: ['TRANSIT', 'BUS', 'METRO', 'TRAIN', 'PRESTO', 'OPUS'], score: 10, category: 'Transport', label: 'Transport' },
  { keywords: ['GAS', 'FUEL', 'ESSO', 'SHELL', 'PETRO', 'ULTRAMAR'], score: 10, category: 'Transport', label: 'Car' },
  { keywords: ['PARKING', 'STATIONNEMENT'], score: 10, category: 'Transport', label: 'Transport' },
  
  // === EDUCATION ===
  { keywords: ['TUITION', 'SCHOOL', 'UNIVERSITY', 'COLLEGE', 'ECOLE'], score: 10, category: 'Education', label: 'Education' },
  { keywords: ['BOOK', 'TEXTBOOK', 'COURSE'], score: 8, category: 'Education', label: 'Education' },
  
  // === PERSONAL ===
  { keywords: ['CINEMA', 'MOVIE', 'THEATRE', 'CONCERT'], score: 10, category: 'Personal', label: 'Entertainment' },
  { keywords: ['SPORT', 'GAME', 'ENTERTAINMENT', 'HOBBY'], score: 8, category: 'Personal', label: 'Sport & Hobbies' },
  
  // === SHOPPING ===
  { keywords: ['AMAZON', 'EBAY', 'ETSY'], score: 10, category: 'Shopping', label: 'Shopping' },
  { keywords: ['CANADIAN TIRE', 'HOME DEPOT', 'RONA', 'LOWES'], score: 10, category: 'Shopping', label: 'Shopping' },
  { keywords: ['BEST BUY', 'STAPLES', 'IKEA', 'WINNERS'], score: 10, category: 'Shopping', label: 'Shopping' },
  { keywords: ['SHOP', 'STORE', 'BOUTIQUE', 'RETAIL'], score: 6, category: 'Shopping', label: 'Shopping' },
  { keywords: ['CLOTHING', 'FASHION', 'SHOES'], score: 8, category: 'Shopping', label: 'Clothes' },
  { keywords: ['COSMETIC', 'BEAUTY', 'MAKEUP', 'SALON', 'SPA'], score: 8, category: 'Shopping', label: 'Beauty' },
  
  // === WORK ===
  { keywords: ['OFFICE', 'SUPPLIES', 'STAPLES', 'CONFERENCE'], score: 10, category: 'Work', label: 'Work' },
];

/**
 * Learned pattern interface
 */
export interface LearnedPattern {
  description_pattern: string;
  corrected_category: string;
  corrected_label: string;
  frequency: number;
}

/**
 * Main categorization function - SIMPLIFIED FIRST-MATCH APPROACH
 * 
 * Logic:
 * 1. Check learned patterns (user's corrections)
 * 2. Loop through categories in priority order
 * 3. For each category, check if ANY keyword matches
 * 4. Return FIRST match found
 * 5. If no match, return Uncategorised
 * 
 * @param description Transaction description
 * @param amount Transaction amount (not used in new logic)
 * @param learnedPatterns Optional array of user's learned patterns (prioritized)
 */
export function categorizeTransaction(
  description: string,
  amount: number,
  learnedPatterns?: LearnedPattern[]
): { category: string; label: string; confidence: number } {
  const cleaned = cleanMerchantName(description);
  const cleanedNoSpaces = cleaned.replace(/\s+/g, ''); // Space-insensitive matching
  
  // Step 1: User learned patterns (HIGHEST PRIORITY)
  if (learnedPatterns && learnedPatterns.length > 0) {
    for (const pattern of learnedPatterns) {
      const patternNoSpaces = pattern.description_pattern.replace(/\s+/g, '');
      if (cleaned.includes(pattern.description_pattern) || cleanedNoSpaces.includes(patternNoSpaces)) {
        // Very high confidence for learned patterns, boosted by frequency
        const confidenceBoost = Math.min(pattern.frequency * 2, 10);
        return {
          category: pattern.corrected_category,
          label: pattern.corrected_label,
          confidence: 95 + confidenceBoost,
        };
      }
    }
  }
  
  // Step 2: Loop through categories in priority order and check keywords
  // Use database keywords if available, otherwise fall back to hardcoded
  const keywordPatterns = cachedKeywords || KEYWORD_PATTERNS;
  
  for (const categoryName of CATEGORY_PRIORITY) {
    // Get all keyword patterns for this category
    const categoryPatterns = keywordPatterns.filter(p => p.category === categoryName);
    
    for (const pattern of categoryPatterns) {
      for (const keyword of pattern.keywords) {
        const keywordNoSpaces = keyword.replace(/\s+/g, '');
        
        // Check if keyword matches (with or without spaces)
        if (cleaned.includes(keyword) || cleanedNoSpaces.includes(keywordNoSpaces)) {
          // FIRST MATCH WINS - return immediately
          return {
            category: pattern.category,
            label: pattern.label,
            confidence: 85, // Good confidence for keyword matches
          };
        }
      }
    }
  }
  
  // Step 3: No match found - return Uncategorised
  return { category: 'Uncategorised', label: 'Uncategorised', confidence: 0 };
}

/**
 * Batch categorize multiple transactions
 * 
 * @param transactions Array of transactions to categorize
 * @param learnedPatterns Optional array of user's learned patterns
 */
export function categorizeBatch(
  transactions: Array<{ description: string; amount: number; id?: string }>,
  learnedPatterns?: LearnedPattern[]
): Array<{ category: string; label: string; confidence: number; id?: string }> {
  return transactions.map(tx => ({
    ...categorizeTransaction(tx.description, tx.amount, learnedPatterns),
    id: tx.id,
  }));
}

/**
 * Get labels for a category
 */
export function getLabelsForCategory(category: string): string[] {
  return CATEGORIES[category as keyof typeof CATEGORIES] || ['Uncategorised'];
}

/**
 * Get explanation of how categorization works
 */
export function getCategorizationExplanation(): string {
  return `Our categorization engine uses a simplified first-match approach:
  
1. **Your Personal Learning System** (Highest Priority): The engine remembers categories you've assigned to similar merchants.

2. **Keyword Matching in Priority Order**: We search through categories in this order:
   - Housing → Bills → Subscriptions → Food → Travel → Health → Transport → Education → Personal → Shopping → Work
   
3. **Short Keywords for Maximum Coverage**: We use short keywords like "PHARM" (matches Pharmacy, Pharmacie, Pharma), "TIM" (matches Tim Hortons), "GROCER" (matches Grocery, Grocers, Grocery Store).

4. **First Match Wins**: As soon as we find a keyword match, we categorize the transaction. This ensures fast, consistent results.

5. **Space-Insensitive**: We match keywords even if spaces are missing (e.g., "GROCERYSTORE" matches "GROCERY").

The more you use it and correct categories, the smarter it gets!`;
}

