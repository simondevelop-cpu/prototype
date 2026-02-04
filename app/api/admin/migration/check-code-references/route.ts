import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * Check which code files still reference the old users table
 * This helps identify what needs to be updated before dropping old fields
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const results: any = {
      databaseStatus: {},
      codeReferences: [],
      criticalEndpoints: [],
      summary: {
        usersTableExists: false,
        usersTableRowCount: 0,
        needsCodeUpdates: 0,
        criticalUpdates: 0,
      },
    };

    // ============================================
    // 1. CHECK DATABASE STATUS
    // ============================================
    
    // Check if users table still exists
    try {
      const check = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'users'
      `);
      results.databaseStatus.usersTableExists = parseInt(check.rows[0]?.count || '0') > 0;
      
      if (results.databaseStatus.usersTableExists) {
        const count = await pool.query('SELECT COUNT(*) as count FROM users');
        results.databaseStatus.usersTableRowCount = parseInt(count.rows[0]?.count || '0');
        
        // Check if users table has email/display_name (should be moved to l0_pii_users)
        const columns = await pool.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'users' 
            AND column_name IN ('email', 'display_name')
        `);
        results.databaseStatus.usersHasEmail = columns.rows.some((r: any) => r.column_name === 'email');
        results.databaseStatus.usersHasDisplayName = columns.rows.some((r: any) => r.column_name === 'display_name');
      }
      
      results.summary.usersTableExists = results.databaseStatus.usersTableExists;
      results.summary.usersTableRowCount = results.databaseStatus.usersTableRowCount;
    } catch (e: any) {
      results.databaseStatus.error = e.message;
    }

    // Check l1_user_permissions
    try {
      const check = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'l1_user_permissions'
      `);
      results.databaseStatus.l1UserPermissionsExists = parseInt(check.rows[0]?.count || '0') > 0;
      
      if (results.databaseStatus.l1UserPermissionsExists) {
        const count = await pool.query('SELECT COUNT(*) as count FROM l1_user_permissions');
        results.databaseStatus.l1UserPermissionsRowCount = parseInt(count.rows[0]?.count || '0');
      }
    } catch (e: any) {
      results.databaseStatus.l1UserPermissionsError = e.message;
    }

    // ============================================
    // 2. CHECK CODE REFERENCES
    // ============================================
    
    const apiDir = path.join(process.cwd(), 'app', 'api');
    const criticalEndpoints = [
      'auth/login',
      'auth/register',
      'account/update',
      'account/personal-data',
      'admin/users',
      'admin/users/block',
      'admin/customer-data',
      'admin/cohort-analysis',
      'admin/engagement-chart',
      'admin/intent-categories',
      'admin/bookings',
      'bookings/create',
    ];

    function checkFileForUsersReferences(filePath: string, relativePath: string): any {
      try {
        if (!fs.existsSync(filePath)) return null;
        
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const references: any[] = [];
        
        // Check for various patterns
        const patterns = [
          { pattern: /FROM\s+users\b/i, type: 'FROM users' },
          { pattern: /JOIN\s+users\b/i, type: 'JOIN users' },
          { pattern: /users\.email/i, type: 'users.email' },
          { pattern: /users\.display_name/i, type: 'users.display_name' },
          { pattern: /users\.password_hash/i, type: 'users.password_hash' },
          { pattern: /users\.created_at/i, type: 'users.created_at' },
          { pattern: /users\.is_active/i, type: 'users.is_active' },
          { pattern: /users\.email_validated/i, type: 'users.email_validated' },
          { pattern: /INSERT\s+INTO\s+users/i, type: 'INSERT INTO users' },
          { pattern: /UPDATE\s+users/i, type: 'UPDATE users' },
        ];
        
        patterns.forEach(({ pattern, type }) => {
          lines.forEach((line, index) => {
            if (pattern.test(line)) {
              references.push({
                type,
                line: index + 1,
                content: line.trim().substring(0, 100),
              });
            }
          });
        });
        
        if (references.length > 0) {
          return {
            file: relativePath,
            references,
            isCritical: criticalEndpoints.some(ep => relativePath.includes(ep)),
          };
        }
        
        return null;
      } catch (e: any) {
        return { file: relativePath, error: e.message };
      }
    }

    function scanDirectory(dir: string, baseDir: string = ''): void {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.join(baseDir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip node_modules and .next
            if (entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '.git') {
              scanDirectory(fullPath, relativePath);
            }
          } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
            const result = checkFileForUsersReferences(fullPath, relativePath);
            if (result) {
              results.codeReferences.push(result);
              if (result.isCritical) {
                results.criticalEndpoints.push(result);
              }
            }
          }
        }
      } catch (e: any) {
        // Skip directories we can't read
      }
    }

    // Scan API directory
    if (fs.existsSync(apiDir)) {
      scanDirectory(apiDir, 'app/api');
    }

    // Also check lib directory for event-logger
    const libDir = path.join(process.cwd(), 'lib');
    if (fs.existsSync(libDir)) {
      scanDirectory(libDir, 'lib');
    }

    results.summary.needsCodeUpdates = results.codeReferences.length;
    results.summary.criticalUpdates = results.criticalEndpoints.length;

    // ============================================
    // 3. RECOMMENDATIONS
    // ============================================
    
    results.recommendations = [];
    
    if (results.databaseStatus.usersTableExists && results.databaseStatus.usersTableRowCount > 0) {
      if (results.summary.criticalUpdates > 0) {
        results.recommendations.push({
          priority: 'HIGH',
          action: 'Update critical endpoints first',
          reason: `${results.summary.criticalUpdates} critical endpoints still reference users table`,
          endpoints: results.criticalEndpoints.map((e: any) => e.file),
        });
      }
      
      if (results.databaseStatus.usersHasEmail || results.databaseStatus.usersHasDisplayName) {
        results.recommendations.push({
          priority: 'MEDIUM',
          action: 'Verify PII migration',
          reason: 'users table still has email/display_name columns. Ensure data is in l0_pii_users before dropping.',
        });
      }
      
      if (results.summary.criticalUpdates === 0 && results.summary.needsCodeUpdates === 0) {
        results.recommendations.push({
          priority: 'LOW',
          action: 'Safe to drop users table',
          reason: 'No code references found. Can safely rename or drop users table.',
        });
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    console.error('[Code References Check] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check code references', 
        details: error.message,
      },
      { status: 500 }
    );
  }
}

