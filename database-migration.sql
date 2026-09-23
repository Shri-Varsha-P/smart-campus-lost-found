-- Update lost_items table to add claim_deadline if not exists
ALTER TABLE lost_items ADD COLUMN claim_deadline DATETIME AFTER status;

-- Add comments table if not exists
CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_type ENUM('lost','found') NOT NULL,
    item_id INT NOT NULL,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add password_hash field to users table if not exists
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) AFTER email;