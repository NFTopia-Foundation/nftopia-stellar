const { execSync } = require('child_process');

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(2)} kB`;
}

try {
  let output = '';
  try {
    output = execSync('npx size-limit --json', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    // When a budget is exceeded, size-limit exits with code 1 but still outputs the JSON report
    output = (err.stdout || err.stderr || '').toString();
  }

  // Parse JSON results (extract JSON array if there are any leading/trailing logs)
  const jsonMatch = output.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (!jsonMatch) {
    console.log('Unable to parse size-limit output for step summary.');
    process.exit(0);
  }

  const results = JSON.parse(jsonMatch[0]);
  const hasFailures = results.some((item) => !item.passed);

  console.log('## 📦 Bundle Size Budget Report\n');
  if (hasFailures) {
    console.log('> ⚠️ **One or more bundle size budgets exceeded!** Check the failed items below.\n');
  } else {
    console.log('> ✅ **All bundle size budgets passed successfully.**\n');
  }

  console.log('| Chunk / Route Area | Size (Brotli) | Budget Limit | Status |');
  console.log('| :--- | :--- | :--- | :---: |');

  for (const item of results) {
    const sizeStr = formatBytes(item.size);
    const limitStr = formatBytes(item.sizeLimit);
    let status = '✅ Pass';

    if (!item.passed) {
      const overBytes = item.size - item.sizeLimit;
      const overStr = formatBytes(overBytes);
      status = `❌ **FAILED (+${overStr})**`;
    }

    console.log(`| ${item.name} | ${sizeStr} | ${limitStr} | ${status} |`);
  }

  console.log('\n*Sizes measured after Brotli compression, reflecting production CDN transfer.*');
} catch (error) {
  console.error('Failed to generate bundle size summary:', error.message);
}
