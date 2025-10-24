// Extract all merchant patterns and keywords from categorization-engine-old.ts
// and seed them into the admin database tables

import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

async function extractAndSeedPatterns() {
  console.log('[Extract] Reading categorization-engine-old.ts...');
  
  const fileContent = readFileSync('./lib/categorization-engine-old.ts', 'utf-8');
  
  // Extract MERCHANT_PATTERNS section
  const merchantMatch = fileContent.match(/const MERCHANT_PATTERNS[\s\S]*?\n\];/);
  const keywordMatch = fileContent.match(/const KEYWORD_PATTERNS[\s\S]*?\n\];/);
  
  if (!merchantMatch || !keywordMatch) {
    throw new Error('Could not find MERCHANT_PATTERNS or KEYWORD_PATTERNS in file');
  }
  
  // Parse merchant patterns
  const merchantPatternRegex = /\{\s*pattern:\s*'([^']+)',\s*category:\s*'([^']+)',\s*label:\s*'([^']+)',\s*score:\s*(\d+)/g;
  const merchants = [];
  let match;
  
  while ((match = merchantPatternRegex.exec(merchantMatch[0])) !== null) {
    merchants.push({
      pattern: match[1],
      category: match[2],
      label: match[3],
      score: parseInt(match[4], 10)
    });
  }
  
  // Parse keyword patterns
  const keywordPatternRegex = /\{\s*keywords:\s*\[([^\]]+)\],\s*(?:score:\s*(\d+),\s*)?category:\s*'([^']+)',\s*label:\s*'([^']+)'(?:,\s*score:\s*(\d+))?/g;
  const keywordGroups = [];
  
  while ((match = keywordPatternRegex.exec(keywordMatch[0])) !== null) {
    const keywordsStr = match[1];
    const score = match[2] || match[5] || '8';
    const category = match[3];
    const label = match[4];
    
    // Extract individual keywords
    const keywordList = keywordsStr.match(/'([^']+)'/g) || [];
    const keywords = keywordList.map(k => k.replace(/'/g, ''));
    
    keywordGroups.push({
      keywords,
      category,
      label,
      score: parseInt(score, 10)
    });
  }
  
  console.log(`[Extract] Found ${merchants.length} merchants`);
  console.log(`[Extract] Found ${keywordGroups.length} keyword groups`);
  
  // Count total keywords
  const totalKeywords = keywordGroups.reduce((sum, group) => sum + group.keywords.length, 0);
  console.log(`[Extract] Total keywords: ${totalKeywords}`);
  console.log(`[Extract] Grand total: ${merchants.length + totalKeywords} patterns\n`);
  
  // Create tables
  console.log('[DB] Creating admin tables...');
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_merchants (
      id SERIAL PRIMARY KEY,
      merchant_pattern TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 10,
      is_active BOOLEAN DEFAULT TRUE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_keywords (
      id SERIAL PRIMARY KEY,
      keyword TEXT NOT NULL,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 8,
      language TEXT DEFAULT 'both' CHECK (language IN ('en', 'fr', 'both')),
      is_active BOOLEAN DEFAULT TRUE,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  console.log('[DB] Tables created');
  
  // Clear existing data
  await pool.query('DELETE FROM admin_keywords');
  await pool.query('DELETE FROM admin_merchants');
  console.log('[DB] Cleared existing data\n');
  
  // Insert merchants
  console.log('[DB] Inserting merchants...');
  let merchantCount = 0;
  for (const merchant of merchants) {
    try {
      await pool.query(
        `INSERT INTO admin_merchants (merchant_pattern, category, label, score, is_active) 
         VALUES ($1, $2, $3, $4, true)`,
        [merchant.pattern, merchant.category, merchant.label, merchant.score]
      );
      merchantCount++;
      if (merchantCount % 50 === 0) {
        console.log(`  Inserted ${merchantCount}/${merchants.length} merchants...`);
      }
    } catch (err) {
      console.warn(`  Warning: Could not insert merchant "${merchant.pattern}":`, err.message);
    }
  }
  console.log(`✅ Inserted ${merchantCount} merchants\n`);
  
  // Insert keywords
  console.log('[DB] Inserting keywords...');
  let keywordCount = 0;
  for (const group of keywordGroups) {
    for (const keyword of group.keywords) {
      // Detect language
      const isFrench = /[ÉÈÊËÀÂÔÎÇÙ]|LOYER|EAU|MENSUEL|DEPANNEUR/.test(keyword);
      const language = isFrench ? 'fr' : 'both';
      
      try {
        await pool.query(
          `INSERT INTO admin_keywords (keyword, category, label, score, language, is_active) 
           VALUES ($1, $2, $3, $4, $5, true)`,
          [keyword, group.category, group.label, group.score, language]
        );
        keywordCount++;
        if (keywordCount % 50 === 0) {
          console.log(`  Inserted ${keywordCount}/${totalKeywords} keywords...`);
        }
      } catch (err) {
        console.warn(`  Warning: Could not insert keyword "${keyword}":`, err.message);
      }
    }
  }
  console.log(`✅ Inserted ${keywordCount} keywords\n`);
  
  // Show summary
  const categoryStats = await pool.query(`
    SELECT 
      category,
      COUNT(DISTINCT id) FILTER (WHERE EXISTS (SELECT 1 FROM admin_merchants WHERE id = t.id)) as merchants,
      COUNT(DISTINCT id) FILTER (WHERE EXISTS (SELECT 1 FROM admin_keywords WHERE id = t.id)) as keywords
    FROM (
      SELECT id, category FROM admin_merchants
      UNION ALL
      SELECT id, category FROM admin_keywords
    ) t
    GROUP BY category
    ORDER BY category
  `);
  
  const merchantTotal = await pool.query('SELECT COUNT(*) as count FROM admin_merchants WHERE is_active = TRUE');
  const keywordTotal = await pool.query('SELECT COUNT(*) as count FROM admin_keywords WHERE is_active = TRUE');
  
  console.log('='.repeat(60));
  console.log('MIGRATION COMPLETE!');
  console.log('='.repeat(60));
  console.log(`Total Merchants: ${merchantTotal.rows[0].count}`);
  console.log(`Total Keywords:  ${keywordTotal.rows[0].count}`);
  console.log(`Grand Total:     ${parseInt(merchantTotal.rows[0].count) + parseInt(keywordTotal.rows[0].count)}`);
  console.log('='.repeat(60));
  console.log('\n✅ All patterns migrated to database!');
  console.log('✅ Admin dashboard will now show all keywords and merchants');
  console.log('✅ You can edit them via /admin dashboard\n');
  
  await pool.end();
}

extractAndSeedPatterns().catch(err => {
  console.error('[Error]', err);
  process.exit(1);
});

