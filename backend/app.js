const { start, shutdown } = require('./main');

async function run() {
  try {
    const result = await start();
    console.log('Jwellers Edith is running.');
    console.log(`Status: ${result.status}`);
    return result;
  } catch (err) {
    console.error('Failed to start:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
