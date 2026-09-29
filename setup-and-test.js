const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Smart Campus Lost & Found - Setup and Test ===\n');

// Step 1: Check dependencies
console.log('Step 1: Checking dependencies...');
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log('✓ package.json found');
    console.log('Dependencies:', Object.keys(packageJson.dependencies).join(', '));
} catch (err) {
    console.error('✗ package.json not found');
    process.exit(1);
}

// Step 2: Install dependencies if needed
console.log('\nStep 2: Installing dependencies...');
try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✓ Dependencies installed');
} catch (err) {
    console.error('✗ Failed to install dependencies');
    process.exit(1);
}

// Step 3: Check .env file
console.log('\nStep 3: Checking .env file...');
if (fs.existsSync('.env')) {
    console.log('✓ .env file exists');
} else {
    console.error('✗ .env file not found');
    console.error('Please create .env file based on .env.example');
    console.error('Required configuration:');
    console.error('DB_HOST=smart-campus-db-shrivarshaps-d218.a.aivencloud.com');
    console.error('DB_PORT=27155');
    console.error('DB_USER=avnadmin');
    console.error('DB_PASSWORD=your-aiven-password');
    console.error('DB_NAME=defaultdb');
    process.exit(1);
}

// Step 4: Run migration
console.log('\nStep 4: Running database migration...');
console.log('This requires network access to the Aiven database.');
console.log('If migration fails, check your network connection and Aiven database status.\n');

try {
    execSync('node run-safe-migration.js', { stdio: 'inherit' });
    console.log('✓ Migration completed');
} catch (err) {
    console.error('✗ Migration failed');
    console.error('Please check your database connection in .env');
    console.error('Common issues:');
    console.error('- Network cannot reach Aiven database');
    console.error('- Incorrect database credentials');
    console.error('- Database service not running');
    console.error('- VPN may be required for Aiven access');
    process.exit(1);
}

// Step 5: Start server
console.log('\nStep 5: Starting server...');
console.log('Server will start at http://localhost:5000');
console.log('Press Ctrl+C to stop the server\n');

try {
    execSync('node server.js', { stdio: 'inherit' });
} catch (err) {
    console.error('\n✗ Server stopped');
    process.exit(1);
}
