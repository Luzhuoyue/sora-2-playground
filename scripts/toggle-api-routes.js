const fs = require('fs');
const path = require('path');

const apiPath = path.join(__dirname, '../src/app/api');
const disabledPath = path.join(__dirname, '../.api-routes-backup');

const action = process.argv[2]; // 'disable' or 'restore'

try {
  if (action === 'disable') {
    if (fs.existsSync(apiPath)) {
      fs.renameSync(apiPath, disabledPath);
      console.log('✅ API routes disabled for frontend build');
    } else {
      console.log('ℹ️  API routes already disabled');
    }
  } else if (action === 'restore') {
    if (fs.existsSync(disabledPath)) {
      fs.renameSync(disabledPath, apiPath);
      console.log('✅ API routes restored');
    } else {
      console.log('ℹ️  API routes already restored');
    }
  } else {
    console.error('❌ Invalid action. Use "disable" or "restore"');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error toggling API routes:', error.message);
  process.exit(1);
}
