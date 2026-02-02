import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import { logAdminEvent } from '@/lib/event-logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { action, tab } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Log the admin action
    await logAdminEvent(
      decoded.email || ADMIN_EMAIL,
      action === 'tab_access' ? 'admin_tab_access' : 'admin_login',
      {
        action,
        tab: tab || null,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      }
    );

    return NextResponse.json({ 
      success: true,
      message: 'Action logged successfully'
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error logging admin action:', error);
    return NextResponse.json(
      { error: 'Failed to log admin action', details: error.message },
      { status: 500 }
    );
  }
}

