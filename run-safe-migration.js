const mysql = require('mysql2');
require('dotenv').config();

console.log('=== Safe Database Migration for Smart Campus Lost & Found ===');
console.log('This migration will:');
console.log('1. Add notification_manager and staff to users.role ENUM');
console.log('2. Add notification workflow columns to notifications table');
console.log('3. Add necessary indexes and foreign keys');
console.log('4. Update existing notifications with proper types');
console.log('');
console.log('IMPORTANT: This migration preserves all existing data and tables.');
console.log('');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    connectionLimit: 1,
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: 10000,
    multipleStatements: true
});

async function runMigration() {
    let connection;
    try {
        console.log('Connecting to database...');
        console.log('Host:', process.env.DB_HOST);
        console.log('Port:', process.env.DB_PORT);
        console.log('Database:', process.env.DB_NAME);
        console.log('');

        connection = await new Promise((resolve, reject) => {
            db.getConnection((err, conn) => {
                if (err) reject(err);
                else resolve(conn);
            });
        });

        console.log('✓ Database connected successfully\n');

        // Step 1: Check and update users.role ENUM
        console.log('Step 1: Checking users.role ENUM...');
        const [usersTable] = await connection.query('SHOW CREATE TABLE users');
        const usersCreate = usersTable[0]['Create Table'];

        const targetRoles = ['student', 'admin', 'security', 'notification_manager', 'staff'];
        const currentRoles = targetRoles.filter(role => usersCreate.includes(role));

        if (currentRoles.length === targetRoles.length) {
            console.log('✓ All required roles already in ENUM');
        } else {
            console.log('Current roles in ENUM:', currentRoles.join(', '));
            console.log('→ Updating role ENUM to include all required roles');
            await connection.query(`
                ALTER TABLE users
                MODIFY COLUMN role ENUM('student', 'admin', 'security', 'notification_manager', 'staff') DEFAULT 'student'
            `);
            console.log('✓ Role ENUM updated successfully');
        }

        // Step 2: Check notifications table structure
        console.log('\nStep 2: Checking notifications table structure...');
        const [notificationsColumns] = await connection.query('SHOW COLUMNS FROM notifications');
        const columnNames = notificationsColumns.map(col => col.Field);
        console.log('Current columns:', columnNames.join(', '));

        // Add missing columns one by one
        const columnsToAdd = [
            { name: 'notification_type', definition: "ENUM('personal_lost_item', 'campus_asset_lost', 'asset_report', 'general') DEFAULT 'general' AFTER message" },
            { name: 'asset_id', definition: 'INT NULL AFTER notification_type' },
            { name: 'approval_status', definition: "ENUM('pending', 'approved', 'rejected') NULL AFTER asset_id" },
            { name: 'handled_by', definition: 'INT NULL AFTER approval_status' },
            { name: 'handled_at', definition: 'TIMESTAMP NULL AFTER handled_by' },
            { name: 'lost_item_id', definition: 'INT NULL AFTER handled_at' }
        ];

        for (const column of columnsToAdd) {
            if (!columnNames.includes(column.name)) {
                console.log(`→ Adding column: ${column.name}`);
                await connection.query(`ALTER TABLE notifications ADD COLUMN ${column.name} ${column.definition}`);
                console.log(`✓ Column ${column.name} added`);
            } else {
                console.log(`✓ Column ${column.name} already exists`);
            }
        }

        // Step 3: Add indexes
        console.log('\nStep 3: Adding indexes...');
        const [indexes] = await connection.query('SHOW INDEX FROM notifications');
        const indexNames = indexes.map(idx => idx.Key_name);

        const indexesToAdd = [
            { name: 'idx_notification_type', column: 'notification_type' },
            { name: 'idx_approval_status', column: 'approval_status' },
            { name: 'idx_asset_id', column: 'asset_id' },
            { name: 'idx_lost_item_id', column: 'lost_item_id' }
        ];

        for (const index of indexesToAdd) {
            if (!indexNames.includes(index.name)) {
                console.log(`→ Adding index: ${index.name}`);
                await connection.query(`ALTER TABLE notifications ADD INDEX ${index.name} (${index.column})`);
                console.log(`✓ Index ${index.name} added`);
            } else {
                console.log(`✓ Index ${index.name} already exists`);
            }
        }

        // Step 4: Add foreign keys
        console.log('\nStep 4: Adding foreign keys...');
        const [constraints] = await connection.query(`
            SELECT CONSTRAINT_NAME
            FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'notifications'
            AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        `);
        const constraintNames = constraints.map(c => c.CONSTRAINT_NAME);

        const foreignKeysToAdd = [
            {
                name: 'fk_notifications_asset',
                column: 'asset_id',
                refTable: 'institutional_assets',
                refColumn: 'id'
            },
            {
                name: 'fk_notifications_lost_item',
                column: 'lost_item_id',
                refTable: 'lost_items',
                refColumn: 'id'
            },
            {
                name: 'fk_notifications_handled_by',
                column: 'handled_by',
                refTable: 'users',
                refColumn: 'id'
            }
        ];

        for (const fk of foreignKeysToAdd) {
            if (!constraintNames.includes(fk.name)) {
                console.log(`→ Adding foreign key: ${fk.name}`);
                await connection.query(`
                    ALTER TABLE notifications
                    ADD CONSTRAINT ${fk.name}
                    FOREIGN KEY (${fk.column}) REFERENCES ${fk.refTable}(${fk.refColumn}) ON DELETE SET NULL
                `);
                console.log(`✓ Foreign key ${fk.name} added`);
            } else {
                console.log(`✓ Foreign key ${fk.name} already exists`);
            }
        }

        // Step 5: Update existing notifications
        console.log('\nStep 5: Updating existing notifications...');
        const [updateResult] = await connection.query(`
            UPDATE notifications
            SET notification_type = 'asset_report'
            WHERE report_id IS NOT NULL
            AND (notification_type IS NULL OR notification_type = 'general')
        `);
        console.log(`✓ Updated ${updateResult.affectedRows} existing notifications`);

        // Step 6: Verify final schema
        console.log('\nStep 6: Verifying final schema...');
        const [finalColumns] = await connection.query('SHOW COLUMNS FROM notifications');
        console.log('Final notifications columns:', finalColumns.map(col => col.Field).join(', '));

        const [finalUsers] = await connection.query('SHOW COLUMNS FROM users WHERE Field = "role"');
        console.log('Final users.role:', finalUsers[0]?.Type || 'Not found');

        // Step 7: Check existing data
        console.log('\nStep 7: Checking existing data...');
        const [userCount] = await connection.query('SELECT COUNT(*) as count FROM users');
        console.log(`✓ Existing users: ${userCount[0].count}`);

        const [notificationCount] = await connection.query('SELECT COUNT(*) as count FROM notifications');
        console.log(`✓ Existing notifications: ${notificationCount[0].count}`);

        const [assetCount] = await connection.query('SELECT COUNT(*) as count FROM institutional_assets');
        console.log(`✓ Existing institutional assets: ${assetCount[0].count}`);

        const [lostItemCount] = await connection.query('SELECT COUNT(*) as count FROM lost_items');
        console.log(`✓ Existing lost items: ${lostItemCount[0].count}`);

        console.log('\n=== Migration Completed Successfully ===');
        console.log('✓ All existing data preserved');
        console.log('✓ All existing tables preserved');
        console.log('✓ Notification Manager functionality enabled');
        console.log('✓ Staff role support enabled');
        console.log('✓ Database is ready for the updated application');

    } catch (error) {
        console.error('\n✗ Migration failed:', error.message);
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists, continuing...');
        } else if (error.code === 'ER_DUP_KEYNAME') {
            console.log('Index/constraint already exists, continuing...');
        } else {
            console.error('Error details:', error);
            process.exit(1);
        }
    } finally {
        if (connection) connection.release();
        db.end();
    }
}

runMigration();
