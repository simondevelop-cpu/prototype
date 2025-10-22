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

// PDF parsing library - install with: npm install pdf-parse
// For now, we'll use a placeholder until the library is installed
let pdfParse: any = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('[PDF Parser] pdf-parse not installed. Install with: npm install pdf-parse');
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
  filename: string
): Promise<ParseResult> {
  console.log(`[PDF Parser] Processing ${filename} for user ${userId}`);

  // Extract text from PDF
  const text = await extractPDFText(pdfBuffer);
  
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
  if (!pdfParse) {
    throw new Error('PDF parsing library not installed. Please install pdf-parse.');
  }

  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('[PDF Parser] Text extraction failed:', error);
    throw new Error('Failed to extract text from PDF');
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
 * Uses common patterns found across Canadian banks
 */
function parseGenericTransactions(text: string, accountType: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split('\n');

  // Generic patterns
  const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w{3}\s+\d{1,2}|\d{4}-\d{2}-\d{2})/;
  const amountPattern = /[\$\s]*([\d,]+\.\d{2})/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line || line.length < 10) continue;
    if (/^(date|transaction|description|amount|balance|statement period)/i.test(line)) continue;

    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const date = parseDateFlexible(dateMatch[1]);
    if (!date) continue;

    const amounts = Array.from(line.matchAll(amountPattern), m => parseFloat(m[1].replace(/,/g, '')));
    
    const descStart = line.indexOf(dateMatch[0]) + dateMatch[0].length;
    const firstAmountIdx = line.search(amountPattern);
    const description = line.substring(descStart, firstAmountIdx > 0 ? firstAmountIdx : undefined).trim();

    if (!description || amounts.length === 0) continue;

    // Heuristic: if there are 2+ amounts, first is likely the transaction, last is balance
    const amount = amounts.length >= 2 ? amounts[0] : amounts[0];

    transactions.push(createTransaction(date, description, amount, accountType));
  }

  return transactions;
}

/**
 * Flexible date parser - handles multiple formats
 */
function parseDateFlexible(dateStr: string): string | null {
  // Try various date formats
  const formats = [
    'MM/DD/YYYY',
    'DD/MM/YYYY',
    'YYYY-MM-DD',
    'MMM D',
    'MMM DD',
    'M/D/YY',
    'D/M/YY',
  ];

  for (const format of formats) {
    const parsed = dayjs(dateStr, format);
    if (parsed.isValid()) {
      // If year is missing, assume current year
      if (!dateStr.match(/\d{4}/)) {
        return parsed.year(dayjs().year()).format('YYYY-MM-DD');
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

