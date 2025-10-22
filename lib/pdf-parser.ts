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
  transactions: Transaction[];
  transactionsImported: number;
}

/**
 * Bank detection patterns
 */
const BANK_PATTERNS = {
  rbc: /royal bank|rbc|royal|banque royale/i,
  td: /td canada trust|toronto-dominion|td bank/i,
  scotiabank: /scotiabank|bank of nova scotia/i,
  bmo: /bank of montreal|bmo|banque de montr[ée]al/i,
  cibc: /canadian imperial bank|cibc/i,
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
  
  // Detect bank
  const bank = detectBank(text);
  console.log(`[PDF Parser] Detected bank: ${bank}`);

  // Detect account type
  const accountType = detectAccountType(text);
  console.log(`[PDF Parser] Detected account type: ${accountType}`);

  // Parse transactions based on bank
  let transactions: Transaction[] = [];
  
  switch (bank) {
    case 'RBC':
      transactions = parseRBCTransactions(text, accountType);
      break;
    case 'TD':
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

  console.log(`[PDF Parser] Parsed ${transactions.length} transactions`);

  // Insert transactions into database
  const inserted = await insertTransactions(transactions, userId);

  return {
    bank,
    accountType,
    transactions,
    transactionsImported: inserted,
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
 * Detect which bank issued the statement
 */
function detectBank(text: string): string {
  if (BANK_PATTERNS.rbc.test(text)) return 'RBC';
  if (BANK_PATTERNS.td.test(text)) return 'TD';
  if (BANK_PATTERNS.scotiabank.test(text)) return 'Scotiabank';
  if (BANK_PATTERNS.bmo.test(text)) return 'BMO';
  if (BANK_PATTERNS.cibc.test(text)) return 'CIBC';
  if (BANK_PATTERNS.tangerine.test(text)) return 'Tangerine';
  return 'Unknown';
}

/**
 * Detect account type (chequing, savings, credit card)
 */
function detectAccountType(text: string): string {
  if (ACCOUNT_TYPE_PATTERNS.credit.test(text)) return 'Credit Card';
  if (ACCOUNT_TYPE_PATTERNS.savings.test(text)) return 'Savings';
  if (ACCOUNT_TYPE_PATTERNS.chequing.test(text)) return 'Checking';
  return 'Checking';
}

/**
 * Parse RBC transactions
 * Format: Date | Description | Withdrawals | Deposits | Balance
 */
function parseRBCTransactions(text: string, accountType: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n');

  // RBC date format: MM/DD/YYYY or MMM DD
  const datePattern = /(\d{2}\/\d{2}\/\d{4}|\w{3}\s+\d{1,2})/;
  const amountPattern = /[\$\s]*([\d,]+\.\d{2})/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip headers and empty lines
    if (!line || line.length < 10) continue;
    if (/^(date|transaction|balance|statement)/i.test(line)) continue;

    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const date = parseDateFlexible(dateMatch[1]);
    if (!date) continue;

    // Extract amounts
    const amounts = Array.from(line.matchAll(amountPattern), m => parseFloat(m[1].replace(/,/g, '')));
    
    // Extract description (text between date and first amount)
    const descStart = line.indexOf(dateMatch[0]) + dateMatch[0].length;
    const firstAmountIdx = line.search(amountPattern);
    const description = line.substring(descStart, firstAmountIdx > 0 ? firstAmountIdx : undefined).trim();

    if (!description || amounts.length === 0) continue;

    // Determine if debit or credit
    const isDebit = amounts.length >= 2 && amounts[0] > 0;
    const amount = isDebit ? -amounts[0] : (amounts[0] || 0);

    transactions.push(createTransaction(date, description, amount, accountType));
  }

  return transactions;
}

/**
 * Parse TD transactions
 * Format: Date | Description | Debit | Credit | Balance
 */
function parseTDTransactions(text: string, accountType: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n');

  const datePattern = /(\d{2}\/\d{2}\/\d{4}|\w{3}\s+\d{1,2})/;
  const amountPattern = /[\$\s]*([\d,]+\.\d{2})/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line || line.length < 10) continue;
    if (/^(date|description|debit|credit|balance)/i.test(line)) continue;

    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const date = parseDateFlexible(dateMatch[1]);
    if (!date) continue;

    const amounts = Array.from(line.matchAll(amountPattern), m => parseFloat(m[1].replace(/,/g, '')));
    const descStart = line.indexOf(dateMatch[0]) + dateMatch[0].length;
    const firstAmountIdx = line.search(amountPattern);
    const description = line.substring(descStart, firstAmountIdx > 0 ? firstAmountIdx : undefined).trim();

    if (!description || amounts.length === 0) continue;

    // TD format: debit amounts are negative, credit amounts are positive
    const isDebit = amounts.length >= 2 && amounts[0] > 0;
    const amount = isDebit ? -amounts[0] : amounts[0];

    transactions.push(createTransaction(date, description, amount, accountType));
  }

  return transactions;
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
 */
function parseCIBCTransactions(text: string, accountType: string): Transaction[] {
  return parseGenericTransactions(text, accountType);
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
      skippedCount++;
      continue;
    }

    const date = parseDateFlexible(dateMatch[1]);
    if (!date) {
      console.log(`[PDF Parser] Failed to parse date: ${dateMatch[1]} in line: ${line.substring(0, 80)}`);
      skippedCount++;
      continue;
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
      // Extract description (text between date and first amount)
      const descStart = line.indexOf(dateMatch[0]) + dateMatch[0].length;
      const firstAmountIdx = line.search(/\$?\s*[\d,]+\.\d{2}/);
      
      if (firstAmountIdx <= descStart) {
        skippedCount++;
        continue;
      }
      
      description = line.substring(descStart, firstAmountIdx).trim();
      
      // For credit cards, all transactions are expenses
      amount = amounts[amounts.length - 1];
      if (accountType.toLowerCase().includes('credit')) {
        amount = -Math.abs(amount);
      }
    }
    
    // Clean up description - remove transaction IDs and extra whitespace
    const cleanDescription = description
      .replace(/^\d{8,}\s*/, '') // Remove 8+ digit transaction IDs
      .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
      .trim();

    if (!cleanDescription || cleanDescription.length < 3) {
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
  let cleanDate = dateStr.trim().toUpperCase();
  
  // Handle compact formats like JUL02, AUG12 - add space between month and day
  if (/^[A-Z]{3}\d{1,2}$/.test(cleanDate)) {
    cleanDate = cleanDate.replace(/^([A-Z]{3})(\d{1,2})$/, '$1 $2');
  }
  
  // Try various date formats
  const formats = [
    'MMM DD, YYYY',  // Aug 12, 2025
    'MMM DD',        // Aug 12 (no year) or JUL 02
    'MMM D',         // Aug 1 (no year)
    'MMMDD',         // JUL02 (compact, now with space added above)
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
        return parsed.year(year).format('YYYY-MM-DD');
      }
      return parsed.format('YYYY-MM-DD');
    }
  }

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
  let cashflow: 'income' | 'expense' | 'other' = 'expense';
  if (amount > 0) {
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
async function insertTransactions(transactions: Transaction[], userId: string): Promise<number> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database not available');
  }

  let inserted = 0;

  for (const tx of transactions) {
    try {
      await pool.query(
        `INSERT INTO transactions (user_id, date, description, merchant, amount, cashflow, category, account, label, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (user_id, date, amount, merchant, cashflow) DO NOTHING`,
        [userId, tx.date, tx.description, tx.merchant, tx.amount, tx.cashflow, tx.category, tx.account, tx.label]
      );
      inserted++;
    } catch (error) {
      console.error('[PDF Parser] Failed to insert transaction:', error);
      // Continue with other transactions
    }
  }

  return inserted;
}

