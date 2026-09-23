const bcrypt = require('bcryptjs');
const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

async function updatePasswords() {
    const users = [
        { id: 5, password: 'password123' },
        { id: 6, password: 'admin123' },
        { id: 7, password: 'security123' },
        { id: 8, password: 'password123' }
    ];

    for (const user of users) {
        const passwordHash = await bcrypt.hash(user.password, 10);
        
        db.query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [passwordHash, user.id],
            (err, result) => {
                if (err) {
                    console.log(`Error updating password for user ${user.id}:`, err.message);
                } else {
                    console.log(`Password updated for user ${user.id}`);
                }
            }
        );
    }

    setTimeout(() => {
        db.end();
        console.log('Password update complete');
        console.log('Test Accounts:');
        console.log('Student: varsha@gmail.com / password123');
        console.log('Admin: admin@gmail.com / admin123');
        console.log('Security: security@gmail.com / security123');
        console.log('Admin Registration Code: CAMPUS_ADMIN_2026');
    }, 1000);
}

updatePasswords();
