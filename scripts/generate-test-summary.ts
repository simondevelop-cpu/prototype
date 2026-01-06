/**
 * Generate a test summary report
 * Shows what tests exist and what they cover
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestFile {
  path: string;
  type: 'unit' | 'integration' | 'security' | 'e2e';
  tests: TestCase[];
}

interface TestCase {
  name: string;
  status: 'implemented' | 'todo' | 'skipped';
}

function findTestFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findTestFiles(filePath, fileList);
    } else if (file.endsWith('.test.ts')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

async function generateTestSummary() {
  const testFiles: TestFile[] = [];
  const testDir = path.join(process.cwd(), 'tests');

  // Find all test files
  const files = findTestFiles(testDir);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(testDir, file);
    
    // Determine test type from path
    let type: TestFile['type'] = 'unit';
    if (relativePath.includes('integration')) type = 'integration';
    if (relativePath.includes('security')) type = 'security';
    if (relativePath.includes('e2e')) type = 'e2e';

    // Extract test cases
    const tests: TestCase[] = [];
    
    // Find describe blocks
    const describeMatches = content.matchAll(/describe\(['"]([^'"]+)['"]/g);
    for (const match of describeMatches) {
      const describeName = match[1];
      
      // Find it/test blocks within this describe
      const itMatches = content.matchAll(/it\(['"]([^'"]+)['"]/g);
      const testMatches = content.matchAll(/test\(['"]([^'"]+)['"]/g);
      
      for (const itMatch of [...itMatches, ...testMatches]) {
        const testName = `${describeName} > ${itMatch[1]}`;
        const isTodo = content.includes(`test.todo('${itMatch[1]}'`) || 
                      content.includes(`it.todo('${itMatch[1]}'`);
        const isSkipped = content.includes(`describe.skip`) || 
                         content.includes(`it.skip`) ||
                         content.includes(`test.skip`);
        
        tests.push({
          name: testName,
          status: isSkipped ? 'skipped' : (isTodo ? 'todo' : 'implemented')
        });
      }
    }

    testFiles.push({
      path: relativePath,
      type,
      tests
    });
  }

  // Generate markdown report
  let report = '# Test Coverage Summary\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += '## Overview\n\n';
  
  const byType = testFiles.reduce((acc, file) => {
    acc[file.type] = (acc[file.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  report += `- **Total Test Files**: ${testFiles.length}\n`;
  report += `- **Unit Tests**: ${byType.unit || 0} files\n`;
  report += `- **Integration Tests**: ${byType.integration || 0} files\n`;
  report += `- **Security Tests**: ${byType.security || 0} files\n`;
  report += `- **E2E Tests**: ${byType.e2e || 0} files\n\n`;

  const totalTests = testFiles.reduce((sum, file) => sum + file.tests.length, 0);
  const implementedTests = testFiles.reduce((sum, file) => 
    sum + file.tests.filter(t => t.status === 'implemented').length, 0);
  const todoTests = testFiles.reduce((sum, file) => 
    sum + file.tests.filter(t => t.status === 'todo').length, 0);
  const skippedTests = testFiles.reduce((sum, file) => 
    sum + file.tests.filter(t => t.status === 'skipped').length, 0);

  report += `- **Total Test Cases**: ${totalTests}\n`;
  report += `- **Implemented**: ${implementedTests} ✅\n`;
  report += `- **Todo**: ${todoTests} 📝\n`;
  report += `- **Skipped**: ${skippedTests} ⏭️\n\n`;

  // Group by type
  for (const type of ['unit', 'integration', 'security', 'e2e'] as const) {
    const filesOfType = testFiles.filter(f => f.type === type);
    if (filesOfType.length === 0) continue;

    report += `## ${type.charAt(0).toUpperCase() + type.slice(1)} Tests\n\n`;
    
    for (const file of filesOfType) {
      report += `### ${file.path}\n\n`;
      
      if (file.tests.length === 0) {
        report += 'No test cases found.\n\n';
        continue;
      }

      const implemented = file.tests.filter(t => t.status === 'implemented');
      const todo = file.tests.filter(t => t.status === 'todo');
      const skipped = file.tests.filter(t => t.status === 'skipped');

      if (implemented.length > 0) {
        report += '**Implemented:**\n';
        for (const test of implemented) {
          report += `- ✅ ${test.name}\n`;
        }
        report += '\n';
      }

      if (todo.length > 0) {
        report += '**Todo:**\n';
        for (const test of todo) {
          report += `- 📝 ${test.name}\n`;
        }
        report += '\n';
      }

      if (skipped.length > 0) {
        report += '**Skipped:**\n';
        for (const test of skipped) {
          report += `- ⏭️ ${test.name}\n`;
        }
        report += '\n';
      }
    }
  }

  // Write report
  const outputPath = path.join(process.cwd(), 'TEST_SUMMARY.md');
  fs.writeFileSync(outputPath, report);
  console.log(`✅ Test summary generated: ${outputPath}`);
  console.log(`\n📊 Summary:`);
  console.log(`   - ${testFiles.length} test files`);
  console.log(`   - ${totalTests} total test cases`);
  console.log(`   - ${implementedTests} implemented ✅`);
  console.log(`   - ${todoTests} todo 📝`);
  console.log(`   - ${skippedTests} skipped ⏭️`);
}

generateTestSummary().catch(console.error);

