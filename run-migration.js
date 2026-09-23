const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
});

const migrationSQL = `
-- Add found_items table
CREATE TABLE IF NOT EXISTS found_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(200),
    found_time DATETIME,
    image_url VARCHAR(500),
    status ENUM('Available','Claimed','Returned') DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add comments table
CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_type ENUM('lost','found') NOT NULL,
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Update claims table to support found items if needed
ALTER TABLE claims ADD COLUMN item_type ENUM('lost','found') DEFAULT 'lost' AFTER item_id;
`;

db.query(migrationSQL, (err, results) => {
    if (err) {
        console.error('Migration error:', err.message);
        if (err.message.includes('Duplicate column name')) {
            console.log('Column already exists, skipping...');
        } else {
            process.exit(1);
        }
    } else {
        console.log('Migration completed successfully!');
    }
    db.end();
});