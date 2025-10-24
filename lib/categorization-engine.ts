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
let cachedMerchants: MerchantPattern[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds (reduced from 5 minutes for faster updates)

interface MerchantPattern {
  pattern: string;
  alternatePatterns: string[];
  category: string;
  label: string;
}

/**
 * Fetch keyword and merchant patterns from database
 * @param forceRefresh If true, bypass cache and fetch fresh data
 */
export async function refreshCategorizationPatterns(forceRefresh: boolean = false): Promise<void> {
  const now = Date.now();
  
  // Use cache if still valid and not forcing refresh
  if (!forceRefresh && cachedKeywords && cachedMerchants && (now - lastFetchTime) < CACHE_TTL) {
    console.log('[Categorization] Using cached patterns');
    return;
  }
  
  if (forceRefresh) {
    console.log('[Categorization] 🔄 Force refreshing patterns from database...');
  }

  try {
    // Fetch patterns from PUBLIC endpoint (no auth required)
    const response = await fetch('/api/categorization/patterns');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Process keywords - group by category+label
    const keywordMap = new Map<string, string[]>();
    for (const kw of data.keywords || []) {
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

    // Process merchants
    cachedMerchants = (data.merchants || []).map((m: any) => ({
      pattern: m.merchant_pattern,
      alternatePatterns: m.alternate_patterns || [],
      category: m.category,
      label: m.label,
    }));

    lastFetchTime = now;
    console.log(`[Categorization] ✅ Loaded ${cachedKeywords?.length || 0} keyword groups and ${cachedMerchants?.length || 0} merchants from database`);
    
    if (cachedMerchants && cachedMerchants.length > 0) {
      console.log(`[Categorization] Sample merchants:`, cachedMerchants.slice(0, 3).map(m => m.pattern));
    }
  } catch (error) {
    console.error('[Categorization] ❌ Failed to fetch patterns from database:', error);
    cachedKeywords = null;
    cachedMerchants = null;
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

// Keyword patterns interface
interface KeywordPattern {
  keywords: string[];
  category: string;
  label: string;
  score: number;
}

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
 * Main categorization function - FIRST-MATCH APPROACH
 * 
 * Logic (in priority order):
 * 1. Check learned patterns (user's corrections) - HIGHEST PRIORITY
 * 2. Check merchant patterns (exact + alternate patterns)
 * 3. Check keyword patterns (by category priority order)
 * 4. Return Uncategorised if no match
 * 
 * @param description Transaction description
 * @param amount Transaction amount (not used in new logic)
 * @param learnedPatterns Optional array of user's learned patterns (prioritized)
 */
export function categorizeTransaction(
  description: string,
  amount: number,
  learnedPatterns?: LearnedPattern[]
): { category: string; label: string; confidence: number; matchReason?: string } {
  const cleaned = cleanMerchantName(description);
  const cleanedNoSpaces = cleaned.replace(/\s+/g, ''); // Space-insensitive matching
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[Categorization] 🔍 Processing transaction:`);
  console.log(`  Original: "${description}"`);
  console.log(`  Cleaned:  "${cleaned}"`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  // Step 1: User learned patterns (HIGHEST PRIORITY)
  if (learnedPatterns && learnedPatterns.length > 0) {
    console.log(`[Step 1] Checking ${learnedPatterns.length} learned pattern(s)...`);
    for (const pattern of learnedPatterns) {
      const patternNoSpaces = pattern.description_pattern.replace(/\s+/g, '');
      if (cleaned.includes(pattern.description_pattern) || cleanedNoSpaces.includes(patternNoSpaces)) {
        // Very high confidence for learned patterns, boosted by frequency
        const confidenceBoost = Math.min(pattern.frequency * 2, 10);
        const matchReason = `User History: "${pattern.description_pattern}" (used ${pattern.frequency}x)`;
        console.log(`[Step 1] ✅ USER HISTORY MATCH!`);
        console.log(`  Pattern: "${pattern.description_pattern}"`);
        console.log(`  Result:  ${pattern.corrected_category} / ${pattern.corrected_label}`);
        console.log(`  Frequency: ${pattern.frequency}x`);
        console.log(`  Confidence: ${95 + confidenceBoost}%`);
        return {
          category: pattern.corrected_category,
          label: pattern.corrected_label,
          confidence: 95 + confidenceBoost,
          matchReason,
        };
      }
    }
    console.log(`[Step 1] ❌ No learned pattern match`);
  } else {
    console.log(`[Step 1] ⊘ No learned patterns available`);
  }
  
  // Step 2: Check merchant patterns (including alternates)
  const merchantPatterns = cachedMerchants;
  
  if (merchantPatterns && merchantPatterns.length > 0) {
    console.log(`[Step 2] Checking ${merchantPatterns.length} merchant pattern(s)...`);
    for (const merchant of merchantPatterns) {
      // Check primary merchant pattern
      const merchantNoSpaces = merchant.pattern.replace(/\s+/g, '');
      if (cleaned.includes(merchant.pattern) || cleanedNoSpaces.includes(merchantNoSpaces)) {
        const matchReason = `Merchant: "${merchant.pattern}"`;
        console.log(`[Step 2] ✅ MERCHANT MATCH!`);
        console.log(`  Merchant: "${merchant.pattern}"`);
        console.log(`  Result:   ${merchant.category} / ${merchant.label}`);
        console.log(`  Confidence: 90%`);
        return {
          category: merchant.category,
          label: merchant.label,
          confidence: 90,
          matchReason,
        };
      }
      
      // Check alternate patterns
      for (const altPattern of merchant.alternatePatterns) {
        const altNoSpaces = altPattern.replace(/\s+/g, '');
        if (cleaned.includes(altPattern) || cleanedNoSpaces.includes(altNoSpaces)) {
          const matchReason = `Merchant Alternate: "${altPattern}" → "${merchant.pattern}"`;
          console.log(`[Step 2] ✅ MERCHANT ALTERNATE MATCH!`);
          console.log(`  Alternate: "${altPattern}"`);
          console.log(`  Main Merchant: "${merchant.pattern}"`);
          console.log(`  Result:   ${merchant.category} / ${merchant.label}`);
          console.log(`  Confidence: 90%`);
          return {
            category: merchant.category,
            label: merchant.label,
            confidence: 90,
            matchReason,
          };
        }
      }
    }
    console.log(`[Step 2] ❌ No merchant match`);
  } else {
    console.log(`[Step 2] ⊘ No merchant patterns loaded`);
  }
  
  // Step 3: Loop through categories in priority order and check keywords
  // ONLY use database keywords - no fallback
  const keywordPatterns = cachedKeywords;
  
  if (!keywordPatterns || keywordPatterns.length === 0) {
    console.warn('[Step 3] ⚠️  No keyword patterns loaded from database. Returning Uncategorised.');
    return {
      category: 'Uncategorised',
      label: 'Uncategorised',
      confidence: 0,
      matchReason: 'No patterns loaded from database',
    };
  }
  
  console.log(`[Step 3] Checking keywords by category priority...`);
  for (const categoryName of CATEGORY_PRIORITY) {
    // Get all keyword patterns for this category
    const categoryPatterns = keywordPatterns.filter(p => p.category === categoryName);
    
    if (categoryPatterns.length > 0) {
      console.log(`  Checking ${categoryName}: ${categoryPatterns.length} pattern group(s)`);
    }
    
    for (const pattern of categoryPatterns) {
      for (const keyword of pattern.keywords) {
        const keywordNoSpaces = keyword.replace(/\s+/g, '');
        
        // Check if keyword matches (with or without spaces)
        if (cleaned.includes(keyword) || cleanedNoSpaces.includes(keywordNoSpaces)) {
          // FIRST MATCH WINS - return immediately
          const matchReason = `Keyword: "${keyword}" (${categoryName} priority)`;
          console.log(`[Step 3] ✅ KEYWORD MATCH!`);
          console.log(`  Keyword:  "${keyword}"`);
          console.log(`  Category: ${categoryName}`);
          console.log(`  Result:   ${pattern.category} / ${pattern.label}`);
          console.log(`  Confidence: 85%`);
          return {
            category: pattern.category,
            label: pattern.label,
            confidence: 85,
            matchReason,
          };
        }
      }
    }
  }
  
  // Step 4: No match found - return Uncategorised
  console.log(`[Step 4] ❌ NO MATCH FOUND - returning Uncategorised`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  return { 
    category: 'Uncategorised', 
    label: 'Uncategorised', 
    confidence: 0,
    matchReason: 'No matching pattern found',
  };
}

/**
 * Invalidate the pattern cache to force a fresh fetch on next categorization
 * Call this after updating keywords/merchants in the admin dashboard
 */
export function invalidatePatternCache(): void {
  console.log('[Categorization] 🗑️  Cache invalidated - will fetch fresh patterns on next use');
  cachedKeywords = null;
  cachedMerchants = null;
  lastFetchTime = 0;
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

