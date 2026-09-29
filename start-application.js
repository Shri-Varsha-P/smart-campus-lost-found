const { execSync } = require('child_process');
const fs = require('fs');

console.log('=== Smart Campus Lost & Found - Application Launcher ===\n');

// Check .env file
if (!fs.existsSync('.env')) {
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

console.log('✓ .env file found');
console.log('');

// Run migration
console.log('Running database migration...');
console.log('This will safely update the database schema for Notification Manager functionality.');
console.log('All existing data will be preserved.\n');

try {
    execSync('node run-safe-migration.js', { stdio: 'inherit' });
    console.log('✓ Migration completed successfully');
} catch (err) {
    console.error('✗ Migration failed');
    console.error('Please check your database connection in .env');
    console.error('Common issues:');
    console.error('- Database hostname not accessible from your network');
    console.error('- Incorrect database credentials');
    console.error('- Database service not running');
    console.error('- Network/firewall restrictions');
    process.exit(1);
}

console.log('');
console.log('Starting server...');
console.log('Server will be available at: http://localhost:5000');
console.log('Press Ctrl+C to stop the server\n');

// Start server
try {
    execSync('node server.js', { stdio: 'inherit' });
} catch (err) {
    console.error('\nServer stopped');
}
