/**
 * Canadian Bank Statement PDF Parser
 * 
 * Comprehensive parser for extracting transactions from PDF statements
 * from major Canadian banks: RBC, TD, Scotiabank, BMO, CIBC, Tangerine
 * 
 * Architecture:
 * 1. PDF text extraction (using pdf-parse)
 * 2. Bank detection (pattern matching)
 * 3. Bank-specific transaction parsing
 * 4. Normalization and categorization
 * 5. Database insertion
 */

import { getPool } from '@/lib/db';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

// PDF parsing library - dynamically imported for server-side only
let pdfParse: any = null;

// Function to ensure pdf-parse is loaded
async function loadPdfParse() {
  if (pdfParse) return pdfParse;
  
  try {
    // Dynamic import for Next.js compatibility
    const module = await import('pdf-parse/lib/pdf-parse.js');
    pdfParse = module.default || module;
    return pdfParse;
  } catch (e) {
    console.error('[PDF Parser] Failed to load pdf-parse:', e);
    throw new Error('PDF parsing library not available. Please ensure pdf-parse is installed.');
  }
}

interface Transaction {
  date: string;
  description: string;
  merchant: string;
  amount: number;
  cashflow: 'income' | 'expense' | 'other';
  category: string;
  account: string;
  label: string;
}

interface ParseResult {
  bank: string;
  accountType: string;
  accountHolderName?: string;
  transactions: Transaction[];
  transactionsImported: number;
  newTransactions: Transaction[];
  duplicateTransactions: Transaction[];
}

/**
 * Bank detection patterns
 * Order matters - check most specific patterns first
 */
const BANK_PATTERNS = {
  cibc: /cibc|canadian imperial bank/i, // Check CIBC first (more specific)
  rbc: /royal bank|rbc royal|banque royale/i, // More specific RBC pattern
  td: /td canada trust|toronto-dominion|td bank/i,
  scotiabank: /scotiabank|bank of nova scotia/i,
  bmo: /bank of montreal|bmo|banque de montr[ée]al/i,
  tangerine: /tangerine|ing direct/i,
};

/**
 * Account type detection
 */
const ACCOUNT_TYPE_PATTERNS = {
  chequing: /che(c)?king|ch(e|è)ques|compte-ch(e|è)ques|everyday/i,
  savings: /savings?|[ée]pargne|high.?interest/i,
  credit: /credit.?card|carte.?cr[ée]dit|mastercard|visa/i,
};

/**
 * Main entry point: Parse a bank statement PDF
 */
export async function parseBankStatement(
  pdfBuffer: Buffer,
  userId: string,
  filename: string = 'unknown'
): Promise<ParseResult> {
  console.log(`[PDF Parser] ===== Processing ${filename} for user ${userId} =====`);

  // Extract text from PDF
  const text = await extractPDFText(pdfBuffer);
  console.log(`[PDF Parser] Extracted ${text.length} characters of text`);
  console.log(`[PDF Parser] First 500 chars: ${text.substring(0, 500)}`);
  
  // Check if PDF extraction failed (likely image-based PDF)
  if (text.length < 100) {
    console.error('[PDF Parser] Very little text extracted - likely an image-based or scanned PDF');
    throw new Error('This appears to be a scanned/image-based PDF. Please upload a text-based PDF statement, or try downloading the statement again from your bank\'s website.');
  }
  
  // Detect bank
  const bank = detectBank(text);
  console.log(`[PDF Parser] Detected bank: ${bank}`);

  // Detect account type
  const accountType = detectAccountType(text);
  console.log(`[PDF Parser] Detected account type: ${accountType}`);
  
  // Extract account holder name
  const accountHolderName = extractAccountHolderName(text);
  if (accountHolderName) {
    console.log(`[PDF Parser] Detected account holder: ${accountHolderName}`);
  }

  // Parse transactions based on bank and account type
  let transactions: Transaction[] = [];
  
  // TD Credit Cards have a unique compact format - use specialized parser
  if (bank === 'TD' && accountType.toLowerCase().includes('credit')) {
    console.log('[PDF Parser] Using specialized TD credit card parser...');
    transactions = parseTDCreditCardTransactions(text);
  }
  // For all other banks/accounts, use the standard parsers
  else {
    switch (bank) {
      case 'RBC':
        transactions = parseRBCTransactions(text, accountType);
        break;
      case 'TD':
        // TD chequing/savings use generic parser
        transactions = parseTDTransactions(text, accountType);
        break;
      case 'Scotiabank':
        transactions = parseScotiabankTransactions(text, accountType);
        break;
      case 'BMO':
        transactions = parseBMOTransactions(text, accountType);
        break;
      case 'CIBC':
        transactions = parseCIBCTransactions(text, accountType);
        break;
      case 'Tangerine':
        transactions = parseTangerineTransactions(text, accountType);
        break;
      default:
        transactions = parseGenericTransactions(text, accountType);
    }
  }

  console.log(`[PDF Parser] Parsed ${transactions.length} transactions`);

  // Check for duplicates and insert new transactions
  const { inserted, newTransactions, duplicateTransactions } = await insertTransactionsWithDuplicateCheck(transactions, userId);

  return {
    bank,
    accountType,
    accountHolderName,
    transactions,
    transactionsImported: inserted,
    newTransactions,
    duplicateTransactions,
  };
}

/**
 * Extract text from PDF buffer
 */
async function extractPDFText(buffer: Buffer): Promise<string> {
  try {
    const parse = await loadPdfParse();
    const data = await parse(buffer);
    return data.text;
  } catch (error) {
    console.error('[PDF Parser] Text extraction failed:', error);
    throw new Error('Failed to extract text from PDF. Make sure pdf-parse is installed.');
  }
}

/**
 * Parse TD credit card transactions directly using a tight regex
 * Format: TRANSACTIONDATE POSTINGDATE $AMOUNT MERCHANT (all smooshed together)
 * Example: AUG12AUG13$18.39METROPLUSWESTMOUNT
 * 
 * This is more reliable than normalizing + line parsing
 */
function parseTDCreditCardTransactions(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  
  console.log('[TD Parser] Using direct regex to extract transactions...');
  console.log(`[TD Parser] Total text length: ${text.length} characters`);
  
  // Tight regex to match TD credit card format:
  // (DATE1)(DATE2)$AMOUNT or -$AMOUNT (MERCHANT until next transaction or end)
  // DATE format: 3 letters + 1-2 digits (e.g., AUG12, SEP7)
  // Amount can be: $123.45 (purchase) or -$890.90 (payment/credit)
  // Merchant: everything until the next date pattern or specific end markers
  const pattern = /([A-Z]{3}\d{1,2})([A-Z]{3}\d{1,2})(-?\$[\d,]+\.\d{2})([\s\S]+?)(?=[A-Z]{3}\d{1,2}[A-Z]{3}\d{1,2}-?\$|FOREIGNCURRENCY|@EXCHANGERATE|THISMONTH|HAPPYBIRTHDAY|$)/g;
  
  let match;
  let count = 0;
  let lastIndex = 0;
  
  while ((match = pattern.exec(text)) !== null && count < 1000) { // safety limit
    const [fullMatch, transactionDate, postingDate, amountStr, merchant] = match;
    
    // Track regex progress through the text
    if (count === 0 || count === 5 || count % 10 === 0) {
      console.log(`[TD Parser] Regex at position ${pattern.lastIndex} of ${text.length}`);
    }
    
    // Parse the transaction date (use first date, posting date is just for reference)
    const date = parseDateFlexible(transactionDate);
    if (!date) {
      console.log(`[TD Parser] Failed to parse transaction date: ${transactionDate}`);
      continue;
    }
    
    // Parse amount
    // For credit cards: purchases are expenses (negative), payments/credits are income (positive)
    // amountStr can be "$123.45" or "-$890.90"
    const numericAmount = parseFloat(amountStr.replace(/[$,]/g, ''));
    // If it already has a minus sign, it's a payment (keep positive for income)
    // If no minus sign, it's a purchase (make negative for expense)
    const amount = amountStr.startsWith('-') ? Math.abs(numericAmount) : -Math.abs(numericAmount);
    
    // Clean merchant name - remove newlines, extra spaces, special chars
    const cleanMerchant = merchant
      .replace(/\r?\n/g, ' ') // replace newlines with spaces
      .replace(/\s{2,}/g, ' ') // collapse multiple spaces
      .replace(/[^\w\s\-&'\.]/g, '') // remove special chars except common ones
      .trim()
      .substring(0, 200); // Truncate to 200 chars to avoid database index errors
    
    if (cleanMerchant.length >= 3) {
      transactions.push(createTransaction(date, cleanMerchant, amount, 'Credit Card'));
      count++;
      
      if (count <= 5 || count === transactions.length) {
        console.log(`[TD Parser] ${count}. ${date} | ${cleanMerchant.substring(0, 40)} | ${amount}`);
      }
    } else {
      console.log(`[TD Parser] Skipping - merchant too short: "${cleanMerchant}" from raw: "${merchant.substring(0, 50)}"`);
    }
    
    lastIndex = pattern.lastIndex;
  }
  
  console.log(`[TD Parser] Regex stopped at position ${lastIndex} of ${text.length}`);
  console.log(`[TD Parser] Extracted ${transactions.length} transactions using direct regex`);
  return transactions;
}

/**
 * Detect which bank issued the statement
 */
function detectBank(text: string): string {
  // Check CIBC first - more specific pattern to avoid false positives
  if (BANK_PATTERNS.cibc.test(text)) return 'CIBC';
  if (BANK_PATTERNS.rbc.test(text)) return 'RBC';
  if (BANK_PATTERNS.td.test(text)) return 'TD';
  if (BANK_PATTERNS.scotiabank.test(text)) return 'Scotiabank';
  if (BANK_PATTERNS.bmo.test(text)) return 'BMO';
  if (BANK_PATTERNS.tangerine.test(text)) return 'Tangerine';
  return 'Unknown';
}

/**
 * Extract account holder's first name from statement
 * Common patterns:
 * - "MR JOHN SMITH" or "MS JANE DOE"
 * - "MISS ELISE" or "MR. JONATHAN"
 * - Name usually appears near top of statement
 */
function extractAccountHolderName(text: string): string | undefined {
  const lines = text.split('\n').slice(0, 30); // Check first 30 lines
  
  for (const line of lines) {
    // Pattern 1: MR/MS/MISS/MRS followed by name(s)
    const titlePattern = /(?:MR\.?|MS\.?|MISS|MRS\.?)\s+([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?/;
    const match = line.match(titlePattern);
    if (match) {
      return match[1]; // Return first name
    }
    
    // Pattern 2: All caps name (2-15 chars) on its own line
    const namePattern = /^([A-Z][a-z]{2,14})$/;
    const nameMatch = line.trim().match(namePattern);
    if (nameMatch && !['MISS', 'CIBC', 'ROYAL', 'BANK', 'STATEMENT', 'ACCOUNT'].includes(nameMatch[1])) {
      return nameMatch[1];
    }
  }
  
  return undefined;
}

/**
 * Detect account type (chequing, savings, credit card)
 * 
 * Priority order is important:
 * 1. Check for strong credit card indicators (Visa/Mastercard, compact date formats)
 * 2. Check for explicit "statement" or "account" keywords with account type
 * 3. Check for columnar format (chequing/savings)
 * 4. Check for broader patterns
 */
function detectAccountType(text: string): string {
  // Strong credit card indicators - check first
  // TD/RBC credit cards often have compact format: AUG12AUG13$18.39MERCHANT (no spaces)
  if (/VISA|MASTERCARD|INFINITE|REWARDS|AVION|CASH\s*BACK/i.test(text)) {
    // Confirm with compact date format pattern (strong signal for credit cards)
    if (/[A-Z]{3}\d{1,2}[A-Z]{3}\d{1,2}\$[\d,]+\.\d{2}/i.test(text)) {
      return 'Credit Card';
    }
    // Or check for traditional credit card statement layout
    if (/PREVIOUS\s*(ACCOUNT\s*)?BALANCE|MINIMUM\s*PAYMENT|CREDIT\s*LIMIT/i.test(text)) {
      return 'Credit Card';
    }
  }
  
  // Check for explicit account type mentions near "statement" or "account"
  // This helps avoid false positives from words like "Available credit" on chequing statements
  const statementMatch = text.match(/(che(c)?king|ch(e|è)ques|compte-ch(e|è)ques|savings?|[ée]pargne|credit\s*card|carte\s*cr[ée]dit).*?(statement|account)/i);
  if (statementMatch) {
    const accountWord = statementMatch[1].toLowerCase();
    if (/credit/i.test(accountWord)) return 'Credit Card';
    if (/saving|épargne/i.test(accountWord)) return 'Savings';
    if (/che(c)?king|chèques/i.test(accountWord)) return 'Checking';
  }
  
  // Check for columnar format indicators (strong signal for chequing/savings)
  if (/Withdrawals\s*\(\$\)|Deposits\s*\(\$\)/i.test(text)) return 'Checking';
  
  // Now check the broader patterns
  if (ACCOUNT_TYPE_PATTERNS.savings.test(text)) return 'Savings';
  if (ACCOUNT_TYPE_PATTERNS.chequing.test(text)) return 'Checking';
  
  // Credit card check last, as "credit" is a common word in banking statements
  if (ACCOUNT_TYPE_PATTERNS.credit.test(text)) return 'Credit Card';
  
  return 'Checking';
}

/**
 * Parse RBC transactions
 * 
 * RBC Credit Card Format (can be multi-line):
 * Line 1: AUG 19AUG 21SOBEYS #776 DARTMOUTH NS
 * Line 2: 74529005231920451563403
 * 
 * OR sometimes with amounts on the same line:
 * AUG 19  AUG 21  SOBEYS #776 ENFIELD SOUTH NS    $65.33
 * 
 * RBC Chequing Format (columnar):
 * Date        Description                              Withdrawals($)  Deposits($)  Balance($)
 * 8 Aug       e-Transfer - Autodeposit EMMA BROWN                      1,500.00     24,989.24
 * 11 Aug      e-Transfer sent bill QMCXE9              1,475.00                     23,514.24
 */
function parseRBCTransactions(text: string, accountType: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n');
  
  // Check if this is a columnar format (chequing) or single-line format (credit card)
  const hasColumnarFormat = /Withdrawals\s*\(\$\)|Deposits\s*\(\$\)/i.test(text);
  
  if (!hasColumnarFormat) {
    // Credit card format - try to parse using special RBC credit card logic
    return parseRBCCreditCardTransactions(text, accountType);
  }
  
  // Chequing account - columnar format
  console.log('[PDF Parser] Using RBC chequing parser');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and headers
    if (!line || line.length < 10) continue;
    if (/^(date|description|withdrawals|deposits|balance|opening|closing)/i.test(line)) continue;
    
    // Look for lines starting with a date (e.g., "8 Aug", "11 Aug", "15 Aug")
    const dateMatch = line.match(/^(\d{1,2}\s+\w{3})/);
    if (!dateMatch) continue;
    
    const dateStr = dateMatch[1];
    const date = parseDateFlexible(dateStr);
    if (!date) continue;
    
    // Extract description and amounts
    // Format: DATE  DESCRIPTION  [WITHDRAWAL]  [DEPOSIT]  BALANCE
    // NOTE: Sometimes amounts are on the NEXT line!
    let remainder = line.substring(dateMatch[0].length).trim();
    
    // Extract all amounts (withdrawal, deposit, balance)
    const amountPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})/g;
    let amounts: number[] = [];
    let match;
    while ((match = amountPattern.exec(remainder)) !== null) {
      amounts.push(parseFloat(match[1].replace(/,/g, '')));
    }
    
    // If no amounts on this line, check the next line
    if (amounts.length === 0 && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      // Only use next line if it starts with amounts (not a date)
      if (nextLine && !/^\d{1,2}\s+\w{3}/.test(nextLine)) {
        const nextAmountPattern = /(\d{1,3}(?:,\d{3})*\.\d{2})/g;
        let nextMatch;
        while ((nextMatch = nextAmountPattern.exec(nextLine)) !== null) {
          amounts.push(parseFloat(nextMatch[1].replace(/,/g, '')));
        }
        // Append next line to remainder for description extraction
        if (amounts.length > 0) {
          remainder += ' ' + nextLine;
          i++; // Skip the next line since we've consumed it
        }
      }
    }
    
    // Remove amounts from description
    const description = remainder.replace(amountPattern, '').trim();
    
    if (!description || amounts.length === 0) continue;
    
    // Determine transaction amount
    // If there are 3 amounts: [withdrawal, deposit, balance] or [description with number, withdrawal/deposit, balance]
    // If there are 2 amounts: [withdrawal OR deposit, balance]
    let amount = 0;
    
    if (amounts.length >= 2) {
      // Last amount is always the balance, second-to-last is the transaction
      const transactionAmount = amounts[amounts.length - 2];
      
      // Check if this is a withdrawal (negative) or deposit (positive)
      // Simple heuristic: if the description suggests income/deposit, make it positive
      const isDeposit = /deposit|autodeposit|dividend|interest|refund/i.test(description);
      
      amount = isDeposit ? transactionAmount : -transactionAmount;
    } else if (amounts.length === 1) {
      // Only one amount - could be withdrawal or deposit
      const isDeposit = /deposit|autodeposit|dividend|interest|refund/i.test(description);
      amount = isDeposit ? amounts[0] : -amounts[0];
    }
    
    if (amount === 0) continue;
    
    transactions.push(createTransaction(date, description, amount, accountType));
  }
  
  console.log(`[PDF Parser] Parsed ${transactions.length} RBC chequing transactions`);
  return transactions;
}

/**
 * Parse RBC Credit Card transactions
 * 
 * RBC credit card PDFs extract in a completely non-linear way:
 * - Text without spaces: "AUG19AUG21SOBEYS#776DARTMOUTHNS"
 * - Amounts scattered throughout, not adjacent to descriptions
 * - Multiple ACTIVITY sections (page 1, page 2+)
 * 
 * The ONLY reliable pattern is: DATE1 DATE2 DESCRIPTION...
 * 
 * Since we CAN'T find amounts adjacent to transactions, we need to:
 * Parse the entire text as ONE BLOCK and look for the full pattern including amount
 */
function parseRBCCreditCardTransactions(text: string, accountType: string): Transaction[] {
  const transactions: Transaction[] = [];
  
  console.log('[PDF Parser] parseRBCCreditCardTransactions called');
  console.log(`[PDF Parser] Text length: ${text.length} characters`);
  
  // Find all ACTIVITY sections and extract them
  const activitySections: string[] = [];
  const lines = text.split('\n');
  let currentSection = '';
  let inActivity = false;
  
  for (const line of lines) {
    if (/ACTIVITY\s+DESCRIPTION/i.test(line)) {
      if (currentSection) {
        activitySections.push(currentSection);
      }
      currentSection = '';
      inActivity = true;
      continue;
    }
    
    if (inActivity && /TOTAL\s+ACCOUNT\s+BALANCE|Time to Pay|Interest Rate Chart/i.test(line)) {
      if (currentSection) {
        activitySections.push(currentSection);
      }
      currentSection = '';
      inActivity = false;
      continue;
    }
    
    if (inActivity) {
      currentSection += line + '\n';
    }
  }
  
  if (currentSection) {
    activitySections.push(currentSection);
  }
  
  console.log(`[PDF Parser] Found ${activitySections.length} ACTIVITY sections`);
  
  // Process each section
  for (let sectionIdx = 0; sectionIdx < activitySections.length; sectionIdx++) {
    const sectionText = activitySections[sectionIdx];
    
    console.log(`[PDF Parser] Processing section ${sectionIdx + 1}, length: ${sectionText.length}`);
    console.log(`[PDF Parser] Section preview: ${sectionText.substring(0, 200)}`);
    
    // RBC credit card format has transactions on MULTIPLE LINES:
    // Line 1: AUG 19AUG 21SOBEYS #776 DARTMOUTH NS (dates may have spaces)
    // Line 2: 74529005231920451563403 (reference number)
    // Line 3: $65.33 (amount)
    //
    // Strategy: Use multiline regex with non-greedy matching
    // Match: DATE1 DATE2 DESCRIPTION (newlines allowed) $AMOUNT
    
    // Pattern with spaces in dates and multiline matching
    const pattern = /([A-Z]{3}\s*\d{1,2})([A-Z]{3}\s*\d{1,2})([A-Z0-9\s#\/'&\-\.\*\n]+?)\$\s*(-?[\d,]+\.\d{2})/g;
    
    let match;
    let count = 0;
    
    while ((match = pattern.exec(sectionText)) !== null && count < 100) {
      const [fullMatch, transDateStr, postDateStr, descRaw, amountStr] = match;
      
      const transDate = parseDateFlexible(transDateStr);
      if (!transDate) continue;
      
      // Clean description - remove reference numbers and newlines
      const description = descRaw
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .replace(/\d{10,}/g, '') // Remove long reference numbers
        .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
        .trim();
      
      if (description.length < 3) continue;
      
      const amount = parseFloat(amountStr.replace(/,/g, ''));
      
      // For credit cards: payments are positive (or negative with -), purchases are negative
      const isPayment = description.toLowerCase().includes('payment') || description.toLowerCase().includes('credit');
      const finalAmount = (amountStr.startsWith('-') || isPayment) ? Math.abs(amount) : -Math.abs(amount);
      
      transactions.push(createTransaction(transDate, description, finalAmount, accountType));
      count++;
      
      if (count <= 5) {
        console.log(`[PDF Parser] Match #${count}: ${transDate} | ${description.substring(0, 40)} | ${finalAmount}`);
      }
    }
    
    console.log(`[PDF Parser] Extracted ${count} transactions from section ${sectionIdx + 1}`);
  }
  
  console.log(`[PDF Parser] Parsed ${transactions.length} RBC credit card transactions total`);
  return transactions;
}

/**
 * Parse TD transactions
 * Uses the enhanced generic parser which handles:
 * - Dual dates (transaction + posting date)
 * - Credit card and chequing formats
 * - Compact text (already normalized before this is called)
 */
function parseTDTransactions(text: string, accountType: string): Transaction[] {
  return parseGenericTransactions(text, accountType);
}

/**
 * Parse Scotiabank transactions
 */
function parseScotiabankTransactions(text: string, accountType: string): Transaction[] {
  return parseGenericTransactions(text, accountType);
}

/**
 * Parse BMO transactions
 */
function parseBMOTransactions(text: string, accountType: string): Transaction[] {
  // Use enhanced generic parser
  return parseGenericTransactions(text, accountType);
}

/**
 * Parse CIBC transactions
 * 
 * CIBC statements have a clean columnar format:
 * 
 * Credit Card (Dividend Visa):
 * TransDate PostDate Description                                Amount
 * Jun 11    Jun 13   PHARMAPRIX #3558  MONTREAL  QC            13.63
 * Jun 15    Jun 16   PIZZAMANIA MONTREAL QC                    43.97
 * 
 * Chequing/Savings:
 * Date      Description                  Withdrawals($)  Deposits($)  Balance($)
 * Aug 1     Opening balance                                           -$4.00
 * Aug 6     DEPOSIT                                      3,940.24     3,936.24
 * Aug 12    CREDIT MEMO                                  0.49         3,936.73
 * 
 * Format is consistent and easier to parse than RBC/TD
 */
function parseCIBCTransactions(text: string, accountType: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n');
  
  console.log('[PDF Parser] parseCIBCTransactions called');
  console.log(`[PDF Parser] Account type: ${accountType}`);
  
  // Check if this is a columnar chequing/savings format or credit card
  const hasWithdrawalsDeposits = /Withdrawals\s*\(\$\)|Deposits\s*\(\$\)/i.test(text);
  
  if (hasWithdrawalsDeposits) {
    // Chequing/Savings format with Withdrawals and Deposits columns
    return parseCIBCChequingTransactions(text, accountType);
  } else {
    // Credit card format
    return parseCIBCCreditCardTransactions(text, accountType);
  }
}

/**
 * Parse CIBC Credit Card transactions
 * Format: TransDate PostDate Description Amount
 * Example: Jun 11 Jun 13 PHARMAPRIX #3558 MONTREAL QC 13.63
 * 
 * CIBC credit card PDFs often have transactions section with headers like:
 * "Transactions from June 13 to July 12, 2025"
 * or "Your payments"
 * or "Your new charges and credits"
 */
function parseCIBCCreditCardTransactions(text: string, accountType: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n');
  
  console.log('[PDF Parser] Using CIBC credit card parser');
  console.log('[PDF Parser] Sample lines:');
  
  // Show first 50 lines for debugging to find transaction section
  for (let i = 0; i < Math.min(50, lines.length); i++) {
    if (lines[i].trim().length > 5) {
      console.log(`[PDF Parser] Line ${i}: ${lines[i].trim().substring(0, 100)}`);
    }
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and headers
    if (!line || line.length < 10) continue;
    
    // CIBC credit card pattern: Two dates at start, then description, then amount at end
    // Dates format: "Jun 11" or "Jun  1" (month abbreviation + day)
    // May or may not have much spacing between fields
    // Try multiple patterns:
    
    // Pattern 1: Standard format with clear spacing
    let pattern = /^([A-Z][a-z]{2}\s+\d{1,2})\s+([A-Z][a-z]{2}\s+\d{1,2})\s+(.+?)\s+([\d,]+\.\d{2})$/;
    let match = line.match(pattern);
    
    // Pattern 2: Compact format (less spacing)
    if (!match) {
      pattern = /^([A-Z][a-z]{2}\d{1,2})([A-Z][a-z]{2}\d{1,2})(.+?)([\d,]+\.\d{2})$/;
      match = line.match(pattern);
    }
    
    if (!match) continue;
    
    const [fullMatch, transDateStr, postDateStr, description, amountStr] = match;
    
    // Parse transaction date
    const transDate = parseDateFlexible(transDateStr);
    if (!transDate) continue;
    
    const amount = parseFloat(amountStr.replace(/,/g, ''));
    
    // Clean description
    const cleanDesc = description
      .replace(/\s{2,}/g, ' ') // Collapse spaces
      .trim();
    
    if (cleanDesc.length < 3) continue;
    
    // For credit cards: all transactions are negative (expenses) except payments
    const isPayment = cleanDesc.toLowerCase().includes('payment') || cleanDesc.toLowerCase().includes('thank you');
    const finalAmount = isPayment ? Math.abs(amount) : -Math.abs(amount);
    
    transactions.push(createTransaction(transDate, cleanDesc, finalAmount, accountType));
    
    if (transactions.length <= 5) {
      console.log(`[PDF Parser] CIBC CC #${transactions.length}: ${transDate} | ${cleanDesc.substring(0, 40)} | ${finalAmount}`);
    }
  }
  
  console.log(`[PDF Parser] Parsed ${transactions.length} CIBC credit card transactions`);
  return transactions;
}

/**
 * Parse CIBC Chequing/Savings transactions
 * Format: Date  Description  Withdrawals($)  Deposits($)  Balance($)
 * Example: Aug 6    DEPOSIT                                   3,940.24     3,936.24
 */
function parseCIBCChequingTransactions(text: string, accountType: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n');
  
  console.log('[PDF Parser] Using CIBC chequing/savings parser');
  console.log('[PDF Parser] Sample lines:');
  
  // Show first 50 lines for debugging to find transaction section
  for (let i = 0; i < Math.min(50, lines.length); i++) {
    if (lines[i].trim().length > 5) {
      console.log(`[PDF Parser] Line ${i}: ${lines[i].trim().substring(0, 100)}`);
    }
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and headers
    if (!line || line.length < 10) continue;
    if (/^(date|description|withdrawals|deposits|balance|opening|closing|account|transaction|contact)/i.test(line)) continue;
    
    // Look for lines starting with a date
    // Format: "Aug 6" or "Aug  1" (may have extra space)
    const datePattern = /^([A-Z][a-z]{2}\s+\d{1,2})\s+(.+)$/;
    const match = line.match(datePattern);
    
    if (!match) continue;
    
    const [fullMatch, dateStr, remainder] = match;
    
    const date = parseDateFlexible(dateStr);
    if (!date) continue;
    
    console.log(`[PDF Parser] Found date line: ${dateStr} | Remainder: ${remainder.substring(0, 80)}`);
    
    // Extract all amounts from the line (with or without $ or -)
    const amountPattern = /(-?\$?\s*[\d,]+\.\d{2})/g;
    const amounts: number[] = [];
    let amountMatch;
    while ((amountMatch = amountPattern.exec(remainder)) !== null) {
      const cleaned = amountMatch[1].replace(/[$,\s-]/g, '');
      const value = parseFloat(cleaned);
      // Check if original had minus sign
      const isNegative = amountMatch[1].includes('-');
      amounts.push(isNegative ? -value : value);
    }
    
    // Remove amounts to get description
    const description = remainder
      .replace(amountPattern, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    
    console.log(`[PDF Parser] Description: ${description} | Amounts: ${amounts.join(', ')}`);
    
    if (!description || amounts.length === 0) {
      console.log(`[PDF Parser] Skipping - no description or amounts`);
      continue;
    }
    
    // Determine transaction amount
    // Format varies:
    // - Withdrawals: might have amount in Withdrawals column
    // - Deposits: might have amount in Deposits column
    // - Last amount is usually balance
    let amount = 0;
    
    if (amounts.length >= 2) {
      // Second-to-last is likely the transaction amount
      amount = amounts[amounts.length - 2];
      
      // Check if this is a deposit (positive) or withdrawal (negative)
      const isDeposit = /deposit|credit\s+memo|interest|refund|transfer.*in|autodeposit/i.test(description);
      
      if (isDeposit && amount < 0) {
        amount = Math.abs(amount); // Deposits are positive
      } else if (!isDeposit && amount > 0) {
        amount = -amount; // Withdrawals are negative
      }
    } else if (amounts.length === 1) {
      // Only one amount - might be opening/closing balance, skip
      console.log(`[PDF Parser] Skipping - only one amount (balance)`);
      continue;
    }
    
    if (amount === 0) {
      console.log(`[PDF Parser] Skipping - amount is 0`);
      continue;
    }
    
    transactions.push(createTransaction(date, description, amount, accountType));
    
    console.log(`[PDF Parser] CIBC Chequing #${transactions.length}: ${date} | ${description.substring(0, 40)} | ${amount}`);
  }
  
  console.log(`[PDF Parser] Parsed ${transactions.length} CIBC chequing transactions`);
  return transactions;
}

/**
 * Parse Tangerine transactions
 */
function parseTangerineTransactions(text: string, accountType: string): Transaction[] {
  return parseGenericTransactions(text, accountType);
}

/**
 * Generic transaction parser (fallback)
 * Enhanced to handle various Canadian bank statement formats
 */
function parseGenericTransactions(text: string, accountType: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n');

  console.log(`[PDF Parser] parseGenericTransactions called with accountType: ${accountType}`);
  console.log(`[PDF Parser] Total lines to process: ${lines.length}`);

  // More flexible date patterns for Canadian banks
  // Matches: MM/DD, MM/DD/YY, MM/DD/YYYY, AUG 12, AUG12, JUL02, YYYY-MM-DD, etc.
  const datePattern = /\b([A-Z]{3}\s*\d{1,2}(?:,?\s*\d{4})?|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{4}-\d{2}-\d{2})\b/;
  
  // Enhanced amount pattern - with or without $ sign
  const amountPattern = /\$?\s*([\d,]+\.\d{2})/g;

  let parsedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty, short, or header lines
    if (!line || line.length < 10) {
      skippedCount++;
      continue;
    }
    if (/^(date|trans|posting|description|amount|balance|statement|payment|debit|credit|withdrawals|deposits)/i.test(line)) {
      skippedCount++;
      continue;
    }

    const dateMatch = line.match(datePattern);
    if (!dateMatch) {
      if (parsedCount < 5) {
        console.log(`[PDF Parser] No date match in line: ${line.substring(0, 80)}`);
      }
      skippedCount++;
      continue;
    }

    const date = parseDateFlexible(dateMatch[1]);
    if (!date) {
      console.log(`[PDF Parser] Failed to parse date: ${dateMatch[1]} in line: ${line.substring(0, 80)}`);
      skippedCount++;
      continue;
    }
    
    if (parsedCount < 5) {
      console.log(`[PDF Parser] Processing line with date ${date}: ${line.substring(0, 80)}`);
    }

    // Extract all amounts in the line (with or without $ signs)
    const amounts = Array.from(line.matchAll(amountPattern), m => parseFloat(m[1].replace(/,/g, '')));
    
    if (amounts.length === 0) {
      skippedCount++;
      continue;
    }

    // For TD chequing format: Description | Withdrawals | Deposits | Date | Balance
    // Date comes AFTER amounts, so we need different extraction logic
    
    let description = '';
    let amount = 0;
    
    // Find date position in line
    const dateIdx = line.indexOf(dateMatch[0]);
    
    // Check if this looks like a table format (date at end with | separators)
    if (line.includes('|') && dateIdx > line.length / 2) {
      // TD Chequing format: split by | and extract fields
      const parts = line.split('|').map(p => p.trim());
      
      if (parts.length >= 3) {
        description = parts[0]; // First column is description
        
        // Look for amounts in the Withdrawals and Deposits columns
        const withdrawalMatch = parts[1].match(/[\d,]+\.\d{2}/);
        const depositMatch = parts[2].match(/[\d,]+\.\d{2}/);
        
        if (withdrawalMatch) {
          amount = -Math.abs(parseFloat(withdrawalMatch[0].replace(/,/g, '')));
        } else if (depositMatch) {
          amount = Math.abs(parseFloat(depositMatch[0].replace(/,/g, '')));
        } else {
          // Try to get any amount from the line
          amount = amounts[0];
        }
      }
    } else {
      // Credit card format: Date at start, amount later
      // TD credit cards have TWO dates: transaction date + posting date
      // Format: AUG12 AUG13 $18.39 MERCHANT
      
      // Find all dates in the line
      const allDates = Array.from(line.matchAll(new RegExp(datePattern.source, 'g')));
      
      // Find where the amount starts (look for $ sign or just the number pattern)
      const amountMatch = line.match(/\$\s*([\d,]+\.\d{2})/);
      if (!amountMatch || !amountMatch.index) {
        skippedCount++;
        continue;
      }
      
      const amountStartIdx = amountMatch.index;
      const amountEndIdx = amountStartIdx + amountMatch[0].length;
      
      // For TD credit cards: DATE1 DATE2 $AMOUNT MERCHANT
      // The merchant comes AFTER the amount!
      description = line.substring(amountEndIdx).trim();
      
      if (parsedCount < 5) {
        console.log(`[PDF Parser] Extracted description AFTER amount at ${amountEndIdx}: "${description}"`);
      }
      
      // For credit cards, all transactions are expenses
      amount = amounts[amounts.length - 1];
      if (accountType.toLowerCase().includes('credit')) {
        amount = -Math.abs(amount);
      }
    }
    
    // Clean up description - remove transaction IDs, dates, and extra whitespace
    const cleanDescription = description
      .replace(/^\d{8,}\s*/, '') // Remove 8+ digit transaction IDs
      .replace(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{1,2}\s*/i, '') // Remove any remaining date at start
      .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
      .trim();

    if (!cleanDescription || cleanDescription.length < 3) {
      if (parsedCount < 5) {
        console.log(`[PDF Parser] Skipping - description too short after cleaning: "${cleanDescription}" (was: "${description}")`);
      }
      skippedCount++;
      continue;
    }

    transactions.push(createTransaction(date, cleanDescription, amount, accountType));
    parsedCount++;
    
    if (parsedCount <= 5) {
      console.log(`[PDF Parser] Parsed transaction: ${date} | ${cleanDescription} | ${amount}`);
    }
  }

  console.log(`[PDF Parser] Parsing complete: ${parsedCount} transactions parsed, ${skippedCount} lines skipped`);
  return transactions;
}

/**
 * Flexible date parser - handles multiple formats
 */
function parseDateFlexible(dateStr: string): string | null {
  // Clean up the date string
  let cleanDate = dateStr.trim();
  const originalDate = cleanDate;
  
  // Convert to uppercase first for pattern matching
  const upperDate = cleanDate.toUpperCase();
  
  // Handle compact formats like JUL02, AUG12 - add space between month and day
  if (/^[A-Z]{3}\d{1,2}$/i.test(cleanDate)) {
    cleanDate = cleanDate.replace(/^([A-Z]{3})(\d{1,2})$/i, '$1 $2');
  }
  
  // Convert month abbreviations to title case (Aug not AUG) for dayjs
  // dayjs expects: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
  cleanDate = cleanDate.replace(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/gi, (match) => {
    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
  });
  
  // Try various date formats
  const formats = [
    'MMM DD, YYYY',  // Aug 12, 2025
    'MMM DD',        // Aug 12 (no year) or JUL 02
    'MMM D',         // Aug 1 (no year)
    'D MMM',         // 8 Aug, 11 Aug (day first, common in international formats)
    'DD MMM',        // 08 Aug
    'MM/DD/YYYY',    // 08/12/2025
    'MM/DD/YY',      // 08/12/25
    'MM/DD',         // 08/12 (no year)
    'DD/MM/YYYY',    // 12/08/2025
    'YYYY-MM-DD',    // 2025-08-12
    'M/D/YY',        // 8/1/25
    'M/D',           // 8/1 (no year)
  ];

  for (const format of formats) {
    const parsed = dayjs(cleanDate, format, true); // strict parsing
    if (parsed.isValid()) {
      // If year is missing, assume current year or previous year if month is in future
      if (!cleanDate.match(/\d{4}/)) {
        const currentYear = dayjs().year();
        const currentMonth = dayjs().month();
        const parsedMonth = parsed.month();
        
        // If parsed month is greater than current month, it's probably from last year
        const year = parsedMonth > currentMonth + 2 ? currentYear - 1 : currentYear;
        // Set to start of day (midnight) to avoid timezone issues
        const finalDate = parsed.year(year).startOf('day').format('YYYY-MM-DD');
        console.log(`[PDF Parser] Parsed date '${originalDate}' → '${cleanDate}' → '${finalDate}' using format '${format}'`);
        return finalDate;
      }
      // Set to start of day (midnight) to avoid timezone issues
      const finalDate = parsed.startOf('day').format('YYYY-MM-DD');
      console.log(`[PDF Parser] Parsed date '${originalDate}' → '${finalDate}' using format '${format}'`);
      return finalDate;
    }
  }

  console.log(`[PDF Parser] Failed to parse date '${originalDate}' (tried ${formats.length} formats)`);
  return null;
}

/**
 * Create a normalized transaction object
 */
function createTransaction(
  date: string,
  description: string,
  amount: number,
  accountType: string
): Transaction {
  // Normalize description
  const cleanDescription = description
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-&']/g, '')
    .trim();

  // Extract merchant name (first part of description)
  const merchant = cleanDescription.split(/\s{2,}|  /)[0] || cleanDescription;

  // Determine cashflow type
  // First check if it's a transfer/payment (categorize as 'other' regardless of amount)
  const descLower = cleanDescription.toLowerCase();
  
  // Comprehensive payment/transfer detection
  const isTransfer = 
    // Generic payment patterns (works with or without spaces/hyphens)
    /payment/i.test(descLower) && (
      /preauth|pre-auth|authorized|authorised/i.test(descLower) ||
      /thank\s*you|merci/i.test(descLower) ||
      /bill|auto|scheduled|recurring/i.test(descLower)
    ) ||
    // Transfer patterns
    /transfer|virement/i.test(descLower) ||
    /e-?transfer|interac/i.test(descLower) ||
    // Credit card payment patterns
    /credit\s*card\s*payment|cc\s*payment|visa\s*payment|mastercard\s*payment/i.test(descLower) ||
    // Banking movement patterns
    /withdrawal\s+to|deposit\s+from|funds\s+transfer/i.test(descLower) ||
    // Common payment descriptions (often used on statements)
    /^(pmt|pymt|payment|paiement)\b/i.test(descLower);
  
  // Additional check: On credit cards, positive amounts with "payment" in description are always transfers
  const isCreditCardPayment = accountType.toLowerCase().includes('credit') && 
                               amount > 0 && 
                               /payment|pmt|pymt|paiement/i.test(descLower);
  
  let cashflow: 'income' | 'expense' | 'other' = 'expense';
  if (isTransfer || isCreditCardPayment) {
    cashflow = 'other';
  } else if (amount > 0) {
    cashflow = 'income';
  } else if (amount < 0) {
    cashflow = 'expense';
  } else {
    cashflow = 'other';
  }

  // Auto-categorize based on merchant/description
  const category = categorizeTransaction(cleanDescription, merchant);

  return {
    date,
    description: cleanDescription,
    merchant,
    amount,
    cashflow,
    category,
    account: accountType,
    label: category === 'Uncategorised' ? 'Needs Review' : 'Imported',
  };
}

/**
 * Simple auto-categorization based on keywords
 */
function categorizeTransaction(description: string, merchant: string): string {
  const text = `${description} ${merchant}`.toLowerCase();

  // Income
  if (/salary|payroll|deposit|transfer in|direct deposit/i.test(text)) return 'Employment';

  // Housing
  if (/rent|mortgage|property tax/i.test(text)) return 'Housing';

  // Utilities
  if (/hydro|electric|gas|water|internet|phone|telus|rogers|bell|fido/i.test(text)) return 'Utilities';

  // Groceries
  if (/loblaws|sobeys|metro|safeway|superstore|no frills|food basics|walmart grocery/i.test(text)) return 'Groceries';

  // Dining
  if (/restaurant|cafe|coffee|tim hortons|starbucks|mcdonald|burger|pizza|sushi/i.test(text)) return 'Dining';

  // Transportation
  if (/gas|petro|esso|shell|uber|lyft|taxi|transit|presto|parking/i.test(text)) return 'Transportation';

  // Shopping
  if (/amazon|walmart|costco|best buy|canadian tire|home depot/i.test(text)) return 'Shopping';

  // Entertainment
  if (/netflix|spotify|apple music|movie|theatre|cinema/i.test(text)) return 'Entertainment';

  // Healthcare
  if (/pharmacy|shoppers|rexall|medical|doctor|dentist|hospital/i.test(text)) return 'Healthcare';

  return 'Uncategorised';
}

/**
 * Insert transactions into the database
 */
async function insertTransactionsWithDuplicateCheck(
  transactions: Transaction[], 
  userId: string
): Promise<{ inserted: number; newTransactions: Transaction[]; duplicateTransactions: Transaction[] }> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  const newTransactions: Transaction[] = [];
  const duplicateTransactions: Transaction[] = [];

  for (const tx of transactions) {
    try {
      // Check if transaction already exists
      const existingCheck = await pool.query(
        `SELECT id FROM transactions 
         WHERE user_id = $1 AND date = $2 AND amount = $3 AND merchant = $4 AND cashflow = $5`,
        [userId, tx.date, tx.amount, tx.merchant, tx.cashflow]
      );

      if (existingCheck.rows.length > 0) {
        // Transaction is a duplicate
        duplicateTransactions.push(tx);
      } else {
        // Transaction is new - mark it
        newTransactions.push(tx);
      }
    } catch (error) {
      console.error('[PDF Parser] Failed to check transaction:', error);
      // On error, assume it's new
      newTransactions.push(tx);
    }
  }

  console.log(`[PDF Parser] Found ${newTransactions.length} new transactions, ${duplicateTransactions.length} duplicates`);

  return {
    inserted: newTransactions.length,
    newTransactions,
    duplicateTransactions,
  };
}

// Keep the old function for backwards compatibility but mark as deprecated
async function insertTransactions(transactions: Transaction[], userId: string): Promise<number> {
  const result = await insertTransactionsWithDuplicateCheck(transactions, userId);
  
  // Actually insert the new transactions
  const pool = getPool();
  if (!pool) return 0;
  
  for (const tx of result.newTransactions) {
    try {
      await pool.query(
        `INSERT INTO transactions (user_id, date, description, merchant, amount, cashflow, category, account, label, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [userId, tx.date, tx.description, tx.merchant, tx.amount, tx.cashflow, tx.category, tx.account, tx.label]
      );
    } catch (error) {
      console.error('[PDF Parser] Failed to insert transaction:', error);
    }
  }
  
  return result.inserted;
}

