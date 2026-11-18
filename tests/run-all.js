const { spawnSync } = require('child_process');
const path = require('path');

console.log('=== JWELLERS EDITH — Full Test Suite ===\n');

const testFiles = ['database.test.js', 'backend.test.js'];
let anyFailed = false;

for (const file of testFiles) {
  console.log(`>>> ${file} <<<`);
  const result = spawnSync('node', [path.join(__dirname, file)], {
    stdio: 'inherit',
    timeout: 120000
  });
  if (result.status !== 0) {
    anyFailed = true;
    console.error(`  [FAILED] ${file} exited with code ${result.status}`);
  }
  console.log('');
}

if (anyFailed) {
  console.error('=== Some tests FAILED ===');
  process.exit(1);
} else {
  console.log('=== All tests PASSED ===');
}
