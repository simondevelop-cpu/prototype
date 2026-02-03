import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { parseBankStatement } from '@/lib/pdf-parser';
import { getPool } from '@/lib/db';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Use Node.js runtime (required for PDF parsing libraries)
export const runtime = 'nodejs';

/**
 * Parse bank statements WITHOUT inserting into database
 * Returns detailed transaction data for user review
 */
export async function POST(request: NextRequest) {
  try {
    // Verify auth (check both lowercase and capitalized header)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload) {
      console.error('[API] Statement parse: Invalid token');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.sub;
    
    // Check for first_upload consent
    const pool = getPool();
    if (pool) {
      try {
        const consentCheck = await pool.query(
          `SELECT id FROM l1_events 
           WHERE user_id = $1 
             AND event_type = 'consent' 
             AND metadata->>'consentType' = 'first_upload' 
           LIMIT 1`,
          [userId]
        );
        
        if (consentCheck.rows.length === 0) {
          return NextResponse.json(
            { error: 'Consent required. Please accept the upload consent first.' },
            { status: 403 }
          );
        }
      } catch (consentError) {
        // If check fails, allow parse (don't block on database errors)
        console.warn('[API] Could not check upload consent:', consentError);
      }
    }

    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll('statements') as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    if (files.length > 6) {
      return NextResponse.json({ error: 'Maximum 6 files allowed' }, { status: 400 });
    }

    // Process each file (parse only, don't insert)
    const results: any[] = [];

    for (const file of files) {
      try {
        // Validate file type
        if (file.type !== 'application/pdf') {
          results.push({
            filename: file.name,
            status: 'error',
            message: 'Only PDF files are supported',
          });
          continue;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          results.push({
            filename: file.name,
            status: 'error',
            message: 'File size exceeds 5MB limit',
          });
          continue;
        }

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse the PDF statement (check duplicates but don't insert)
        const parseResult = await parseBankStatement(buffer, userId, file.name);

        // Categorize transactions for review
        const categorized = {
          duplicates: parseResult.duplicateTransactions || [],
          other: parseResult.newTransactions.filter(tx => tx.cashflow === 'other'),
          expenses: parseResult.newTransactions.filter(tx => tx.cashflow === 'expense'),
          income: parseResult.newTransactions.filter(tx => tx.cashflow === 'income'),
        };

        results.push({
          filename: file.name,
          status: 'success',
          bank: parseResult.bank,
          accountType: parseResult.accountType,
          totalTransactions: parseResult.transactions.length,
          categorized,
        });
      } catch (error: any) {
        console.error(`Error parsing ${file.name}:`, error);
        results.push({
          filename: file.name,
          status: 'error',
          message: error.message || 'Failed to process file',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('[API] Statement parse error:', error);
    return NextResponse.json(
      { error: 'Failed to parse statements', details: error.message },
      { status: 500 }
    );
  }
}

