import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { parseBankStatement } from '@/lib/pdf-parser';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Note: Next.js App Router handles multipart/form-data automatically
// No need for bodyParser config

export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.sub;

    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll('statements') as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    if (files.length > 6) {
      return NextResponse.json({ error: 'Maximum 6 files allowed' }, { status: 400 });
    }

    // Process each file
    const summary: { [key: string]: { status: string; message?: string; transactions?: number } } = {};

    for (const file of files) {
      try {
        // Validate file type
        if (file.type !== 'application/pdf') {
          summary[file.name] = {
            status: 'error',
            message: 'Only PDF files are supported',
          };
          continue;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          summary[file.name] = {
            status: 'error',
            message: 'File size exceeds 5MB limit',
          };
          continue;
        }

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse the PDF statement
        const result = await parseBankStatement(buffer, userId, file.name);

        summary[file.name] = {
          status: 'success',
          transactions: result.transactionsImported,
          message: result.bank ? `Detected: ${result.bank}` : undefined,
        };
      } catch (error: any) {
        console.error(`Error processing ${file.name}:`, error);
        summary[file.name] = {
          status: 'error',
          message: error.message || 'Failed to process file',
        };
      }
    }

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('[API] Statement upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload statements', details: error.message },
      { status: 500 }
    );
  }
}

