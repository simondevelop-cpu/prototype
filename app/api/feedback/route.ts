import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { logFeedbackEvent } from '@/lib/event-logger';

export const dynamic = 'force-dynamic';

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

    // Get feedback data from request body
    const { usefulness, trust, problems, learnMore } = await request.json();

    // Validate required fields
    if (typeof usefulness !== 'number' || usefulness < 1 || usefulness > 5) {
      return NextResponse.json({ error: 'Usefulness rating is required and must be between 1 and 5' }, { status: 400 });
    }

    if (typeof trust !== 'number' || trust < 1 || trust > 5) {
      return NextResponse.json({ error: 'Trust rating is required and must be between 1 and 5' }, { status: 400 });
    }

    // Log feedback event
    await logFeedbackEvent(userId, {
      usefulness,
      trust,
      problems: problems || undefined,
      learnMore: learnMore || undefined,
    });

    return NextResponse.json({ 
      success: true,
      message: 'Thank you for your feedback!' 
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API] Feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback', details: error.message },
      { status: 500 }
    );
  }
}

