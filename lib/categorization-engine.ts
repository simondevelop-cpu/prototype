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
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface MerchantPattern {
  pattern: string;
  alternatePatterns: string[];
  category: string;
  label: string;
}

/**
 * Fetch keyword and merchant patterns from database
 */
export async function refreshCategorizationPatterns(): Promise<void> {
  const now = Date.now();
  
  // Use cache if still valid
  if (cachedKeywords && cachedMerchants && (now - lastFetchTime) < CACHE_TTL) {
    return;
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
): { category: string; label: string; confidence: number } {
  const cleaned = cleanMerchantName(description);
  const cleanedNoSpaces = cleaned.replace(/\s+/g, ''); // Space-insensitive matching
  
  console.log(`[Categorization] Processing: "${description.substring(0, 40)}" → cleaned: "${cleaned.substring(0, 40)}"`);
  
  // Step 1: User learned patterns (HIGHEST PRIORITY)
  if (learnedPatterns && learnedPatterns.length > 0) {
    for (const pattern of learnedPatterns) {
      const patternNoSpaces = pattern.description_pattern.replace(/\s+/g, '');
      if (cleaned.includes(pattern.description_pattern) || cleanedNoSpaces.includes(patternNoSpaces)) {
        // Very high confidence for learned patterns, boosted by frequency
        const confidenceBoost = Math.min(pattern.frequency * 2, 10);
        console.log(`[Categorization] ✓ USER HISTORY MATCH! Pattern "${pattern.description_pattern}" → ${pattern.corrected_category}/${pattern.corrected_label}`);
        return {
          category: pattern.corrected_category,
          label: pattern.corrected_label,
          confidence: 95 + confidenceBoost,
        };
      }
    }
  }
  
  // Step 2: Check merchant patterns (including alternates)
  const merchantPatterns = cachedMerchants;
  
  if (merchantPatterns && merchantPatterns.length > 0) {
    for (const merchant of merchantPatterns) {
      // Check primary merchant pattern
      const merchantNoSpaces = merchant.pattern.replace(/\s+/g, '');
      if (cleaned.includes(merchant.pattern) || cleanedNoSpaces.includes(merchantNoSpaces)) {
        console.log(`[Categorization] ✓ MERCHANT MATCH! "${merchant.pattern}" → ${merchant.category}/${merchant.label}`);
        return {
          category: merchant.category,
          label: merchant.label,
          confidence: 90, // High confidence for merchant matches
        };
      }
      
      // Check alternate patterns
      for (const altPattern of merchant.alternatePatterns) {
        const altNoSpaces = altPattern.replace(/\s+/g, '');
        if (cleaned.includes(altPattern) || cleanedNoSpaces.includes(altNoSpaces)) {
          console.log(`[Categorization] ✓ MERCHANT ALTERNATE MATCH! "${altPattern}" (→ "${merchant.pattern}") → ${merchant.category}/${merchant.label}`);
          return {
            category: merchant.category,
            label: merchant.label,
            confidence: 90,
          };
        }
      }
    }
  }
  
  // Step 3: Loop through categories in priority order and check keywords
  // ONLY use database keywords - no fallback
  const keywordPatterns = cachedKeywords;
  
  if (!keywordPatterns || keywordPatterns.length === 0) {
    console.warn('[Categorization] No keyword patterns loaded from database. Returning Uncategorised.');
    return {
      category: 'Uncategorised',
      label: 'Uncategorised',
      confidence: 0,
    };
  }
  
  for (const categoryName of CATEGORY_PRIORITY) {
    // Get all keyword patterns for this category
    const categoryPatterns = keywordPatterns.filter(p => p.category === categoryName);
    
    for (const pattern of categoryPatterns) {
      for (const keyword of pattern.keywords) {
        const keywordNoSpaces = keyword.replace(/\s+/g, '');
        
        // Check if keyword matches (with or without spaces)
        if (cleaned.includes(keyword) || cleanedNoSpaces.includes(keywordNoSpaces)) {
          // FIRST MATCH WINS - return immediately
          console.log(`[Categorization] ✓ MATCH! Keyword "${keyword}" → ${pattern.category}/${pattern.label}`);
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
  console.log(`[Categorization] ✗ NO MATCH - returning Uncategorised`);
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

