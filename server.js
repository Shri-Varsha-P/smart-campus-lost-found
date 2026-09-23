const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const qrcode = require("qrcode");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static("public"));

// Upload directory handling removed for Vercel compatibility
// Images now stored as Base64 in database instead of filesystem

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,

    fileFilter: function (req, file, cb) {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/bmp"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    "Only JPG, JPEG, PNG, GIF, WEBP and BMP images are allowed."
                )
            );
        }
    },

    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// Static file serving for uploads removed - images now stored as Base64 in database

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Access denied. No token provided."
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: "Invalid token."
            });
        }

        req.user = user;
        next();
    });
}

function checkAdminRole(req, res, next) {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'security')) {
        return res.status(403).json({
            success: false,
            message: "Access denied. Admin or security role required."
        });
    }
    next();
}

function checkSecurityRole(req, res, next) {
    if (!req.user || req.user.role !== 'security') {
        return res.status(403).json({
            success: false,
            message: "Access denied. Security role required."
        });
    }
    next();
}

function checkAssetAdminRole(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: "Access denied. Admin role required for asset management."
        });
    }
    next();
}

function checkPostOwnership(req, res, next) {
    const itemId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === 'admin') {
        return next();
    }

    const sql = "SELECT user_id FROM lost_items WHERE id = ?";
    
    db.query(sql, [itemId], (err, results) => {
        if (err) {
            console.log("Error checking post ownership:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to verify post ownership."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Post not found."
            });
        }

        const post = results[0];
        
        if (parseInt(post.user_id) !== parseInt(userId)) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only manage your own posts."
            });
        }

        next();
    });
}

function checkFoundPostOwnership(req, res, next) {
    const itemId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === 'admin') {
        return next();
    }

    const sql = "SELECT user_id FROM found_items WHERE id = ?";
    
    db.query(sql, [itemId], (err, results) => {
        if (err) {
            console.log("Error checking found post ownership:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to verify post ownership."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Post not found."
            });
        }

        const post = results[0];
        
        if (parseInt(post.user_id) !== parseInt(userId)) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only manage your own posts."
            });
        }

        next();
    });
}

function createNotification(userId, title, message, reportId = null) {
    const sql = `
        INSERT INTO notifications (user_id, title, message, is_read, report_id)
        VALUES (?, ?, ?, FALSE, ?)
    `;
    
    db.query(sql, [userId, title, message, reportId], (err, result) => {
        if (err) {
            console.log("Error creating notification:", err.message);
        }
    });
}

function notifyAdmins(title, message, reportId = null) {
    const sql = "SELECT id FROM users WHERE role IN ('admin', 'security')";
    
    db.query(sql, (err, results) => {
        if (err) {
            console.log("Error fetching admins:", err.message);
            return;
        }
        
        results.forEach(admin => {
            createNotification(admin.id, title, message, reportId);
        });
    });
}

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: 10000
});
db.getConnection((err, connection) => {
    if (err) {
        console.log(
            "MySQL connection failed:",
            err.message
        );
    } else {
        console.log(
            "MySQL connected successfully!"
        );
        connection.release();
    }
});

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

app.post("/api/signup", async (req, res) => {
    const { name, email, password, confirmPassword, role, adminCode } = req.body;

    if (!name || !email || !password || !confirmPassword || !role) {
        return res.status(400).json({
            success: false,
            message: "Please provide all required fields."
        });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({
            success: false,
            message: "Passwords do not match."
        });
    }

    if (!['student', 'staff'].includes(role)) {
        return res.status(400).json({
            success: false,
            message: "Invalid role."
        });
    }

    if (role === 'student' && adminCode) {
        return res.status(400).json({
            success: false,
            message: "Students cannot use admin registration code."
        });
    }

    let finalRole = role === 'student' ? 'student' : 'staff';

    if (role === 'staff' && adminCode) {
        if (adminCode !== process.env.ADMIN_REGISTRATION_CODE) {
            return res.status(400).json({
                success: false,
                message: "Invalid admin registration code."
            });
        }
        finalRole = 'admin';
    }

    const checkUserSql = "SELECT id FROM users WHERE email = ?";
    
    db.query(checkUserSql, [email], async (err, results) => {
        if (err) {
            console.log("Error checking user:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to check user."
            });
        }

        if (results.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Email already registered."
            });
        }

        try {
            const passwordHash = await bcrypt.hash(password, 10);

            const insertSql = `
                INSERT INTO users (name, email, password_hash, role)
                VALUES (?, ?, ?, ?)
            `;

            db.query(insertSql, [name, email, passwordHash, finalRole], (err, result) => {
                if (err) {
                    console.log("Error creating user:", err.message);
                    return res.status(500).json({
                        success: false,
                        message: "Failed to create user."
                    });
                }

                res.status(201).json({
                    success: true,
                    message: "Account created successfully!",
                    user_id: result.insertId
                });
            });
        } catch (error) {
            console.log("Error hashing password:", error.message);
            return res.status(500).json({
                success: false,
                message: "Failed to process password."
            });
        }
    });
});

app.post("/api/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Please provide email and password."
        });
    }

    const sql = "SELECT * FROM users WHERE email = ?";
    
    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.log("Error finding user:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to find user."
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = results[0];

        if (!user.password_hash) {
            return res.status(500).json({
                success: false,
                message: "Account not properly configured. Please contact administrator."
            });
        }

        try {
            const validPassword = await bcrypt.compare(password, user.password_hash);

            if (!validPassword) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password."
                });
            }

            const token = jwt.sign(
                { id: user.id, name: user.name, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                message: "Login successful!",
                token: token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        } catch (error) {
            console.log("Error comparing password:", error.message);
            return res.status(500).json({
                success: false,
                message: "Failed to verify password."
            });
        }
    });
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role
        }
    });
});

app.post(
    "/api/lost-items",
    authenticateToken,
    upload.single("image"),
    (req, res) => {
        const user_id = req.user.id;
        const title = req.body.title;
        const description = req.body.description;
        const location = req.body.location;
        const lost_time = req.body.lost_time;

        if (
            !title ||
            !description ||
            !location ||
            !lost_time
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields."
            });
        }

        let imageUrl = null;

        if (req.file) {
            // Convert buffer to Base64 data URL for Vercel compatibility
            const base64Image = req.file.buffer.toString('base64');
            const mimeType = req.file.mimetype;
            imageUrl = `data:${mimeType};base64,${base64Image}`;
        }

        const lostDate = new Date(lost_time);
        const claimDeadline = new Date(lostDate.getTime() + 24 * 60 * 60 * 1000);

        const sql = `
            INSERT INTO lost_items
            (
                user_id,
                title,
                description,
                location,
                lost_time,
                image_url,
                claim_deadline
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                user_id,
                title,
                description,
                location,
                lost_time,
                imageUrl,
                claimDeadline
            ],
            (err, result) => {

                if (err) {
                    console.log(
                        "Error inserting lost item:",
                        err.message
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Failed to report lost item.",
                        error: err.message
                    });
                }

                notifyAdmins('New Lost Item Reported', `A new lost item "${title}" has been reported at ${location}.`);

                res.status(201).json({
                    success: true,
                    message:
                        "Lost item reported successfully!",
                    item_id: result.insertId,
                    image_url: imageUrl
                });
            }
        );
    }
);



app.get("/api/lost-items", (req, res) => {

    const sql = `
        SELECT
            lost_items.id,
            lost_items.title,
            lost_items.description,
            lost_items.location,
            lost_items.lost_time,
            lost_items.image_url,
            lost_items.status,
            lost_items.created_at,
            users.name AS reporter_name
        FROM lost_items
        LEFT JOIN users
        ON lost_items.user_id = users.id
        ORDER BY lost_items.created_at DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.log(
                "Error fetching lost items:",
                err.message
            );

            return res.status(500).json({
                success: false,
                message: "Failed to fetch lost items."
            });
        }

        res.json({
            success: true,
            items: results
        });
    });
});

app.get("/api/lost-items/:id", (req, res) => {

    const itemId = req.params.id;

    const sql = `
        SELECT
            lost_items.*,
            users.name AS reporter_name,
            users.email AS reporter_email
        FROM lost_items
        LEFT JOIN users
        ON lost_items.user_id = users.id
        WHERE lost_items.id = ?
    `;

    db.query(sql, [itemId], (err, results) => {

        if (err) {
            console.log(
                "Error fetching lost item:",
                err.message
            );

            return res.status(500).json({
                success: false,
                message: "Failed to fetch lost item."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Lost item not found."
            });
        }

        res.json({
            success: true,
            item: results[0]
        });
    });
});

app.put("/api/lost-items/:id/found", authenticateToken, checkPostOwnership, (req, res) => {
    const itemId = req.params.id;

    const sql = "UPDATE lost_items SET status = 'Resolved' WHERE id = ?";

    db.query(sql, [itemId], (err, result) => {
        if (err) {
            console.log("Error updating lost item status:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to update item status."
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Lost item not found."
            });
        }

        res.json({
            success: true,
            message: "Item marked as found successfully!"
        });
    });
});
app.delete("/api/lost-items/:id", authenticateToken, checkPostOwnership, (req, res) => {
    const itemId = req.params.id;

    // First delete claims related to this lost item
    const deleteClaimsSql = "DELETE FROM claims WHERE item_id = ?";

    db.query(deleteClaimsSql, [itemId], (err, claimResult) => {
        if (err) {
            console.log("Error deleting related claims:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to delete related claims."
            });
        }

        console.log("Related claims deleted:", claimResult.affectedRows);

        // Then delete the lost item
        const deleteItemSql = "DELETE FROM lost_items WHERE id = ?";

        db.query(deleteItemSql, [itemId], (err, result) => {
            if (err) {
                console.log("Error deleting lost item:", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Failed to delete item."
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Lost item not found."
                });
            }

            res.json({
                success: true,
                message: "Item and related claims deleted successfully!"
            });
        });
    });
});
app.post("/api/claims", authenticateToken, (req, res) => {
    const { item_id, message, item_type } = req.body;
    const user_id = req.user.id;

    if (!item_id || !message) {
        return res.status(400).json({
            success: false,
            message: "Please provide all required fields."
        });
    }

    const checkItemSql = "SELECT id FROM found_items WHERE id = ?";
    
    db.query(checkItemSql, [item_id], (err, results) => {
        if (err) {
            console.log("Error checking item:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to verify item."
            });
        }

        if (results.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Claims can only be submitted for found items."
            });
        }

        const sql = `
            INSERT INTO claims (item_id, item_type, user_id, message, status)
            VALUES (?, 'found', ?, ?, 'Pending')
        `;

        db.query(sql, [item_id, user_id, message], (err, result) => {
            if (err) {
                console.log("Error creating claim:", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Failed to submit claim.",
                    error: err.message
                });
            }

            notifyAdmins('New Claim Submitted', `A new claim has been submitted for found item ID ${item_id}.`);

            res.status(201).json({
                success: true,
                message: "Claim submitted successfully!",
                claim_id: result.insertId
            });
        });
    });
});

app.get("/api/claims", authenticateToken, (req, res) => {
    const { item_id } = req.query;
    const user_id = req.user.id;
    const user_role = req.user.role;

    let sql = `
        SELECT
            claims.*,
            users.name AS claimant_name,
            found_items.title AS item_title
        FROM claims
        LEFT JOIN users ON claims.user_id = users.id
        LEFT JOIN found_items ON claims.item_id = found_items.id
        WHERE claims.item_type = 'found'
    `;

    const params = [];

    if (item_id) {
        sql += " AND claims.item_id = ?";
        params.push(item_id);
    } else if (user_role !== 'admin' && user_role !== 'security') {
        sql += " AND claims.user_id = ?";
        params.push(user_id);
    }

    sql += " ORDER BY claims.created_at DESC";

    db.query(sql, params, (err, results) => {
        if (err) {
            console.log("Error fetching claims:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch claims."
            });
        }

        res.json({
            success: true,
            claims: results
        });
    });
});

app.put("/api/claims/:id/status", authenticateToken, checkAdminRole, (req, res) => {
    const claimId = req.params.id;
    const { status } = req.body;

    if (!status || !['Pending', 'Approved', 'Rejected', 'Disputed'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid status."
        });
    }

    const sql = "UPDATE claims SET status = ? WHERE id = ?";

    db.query(sql, [status, claimId], (err, result) => {
        if (err) {
            console.log("Error updating claim status:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to update claim status."
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Claim not found."
            });
        }

        res.json({
            success: true,
            message: "Claim status updated successfully!"
        });
    });
});

app.post("/api/assets", authenticateToken, checkAssetAdminRole, async (req, res) => {
    const { asset_id, name, department } = req.body;

    if (!asset_id || !name) {
        return res.status(400).json({
            success: false,
            message: "Please provide asset ID and name."
        });
    }

    try {
        const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
        const qrUrl = `${serverUrl}/asset/${asset_id}`;

        // Store QR URL instead of file path - QR will be generated dynamically
        const qrCodeUrl = `/api/qr/${asset_id}`;

        const sql = `
            INSERT INTO institutional_assets (asset_id, name, department, status, qr_code)
            VALUES (?, ?, ?, 'Available', ?)
        `;

        db.query(sql, [asset_id, name, department, qrCodeUrl], (err, result) => {
            if (err) {
                console.log("Error creating asset:", err.message);
                return res.status(500).json({
                    success: false,
                    message: "Failed to create asset.",
                    error: err.message
                });
            }

            res.status(201).json({
                success: true,
                message: "Asset created successfully!",
                asset_id: result.insertId,
                qr_code: qrCodeUrl
            });
        });
    } catch (error) {
        console.log("Error creating asset:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to create asset."
        });
    }
});

app.get("/api/assets", authenticateToken, (req, res) => {
    const sql = `
        SELECT * FROM institutional_assets
        ORDER BY created_at DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.log("Error fetching assets:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch assets."
            });
        }

        res.json({
            success: true,
            assets: results
        });
    });
});

app.get("/api/assets/:id", (req, res) => {
    const assetId = req.params.id;

    const sql = "SELECT * FROM institutional_assets WHERE id = ?";

    db.query(sql, [assetId], (err, results) => {
        if (err) {
            console.log("Error fetching asset:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch asset."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Asset not found."
            });
        }

        res.json({
            success: true,
            asset: results[0]
        });
    });
});

app.get("/asset/:assetId", (req, res) => {
    const assetId = req.params.assetId;

    const sql = "SELECT * FROM institutional_assets WHERE asset_id = ?";

    db.query(sql, [assetId], (err, results) => {
        if (err) {
            console.log("Error fetching asset:", err.message);
            return res.status(500).send("Error fetching asset.");
        }

        if (results.length === 0) {
            return res.status(404).send("Asset not found.");
        }

        const asset = results[0];

        if (asset.status === 'Available') {
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Asset Status</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            background: #f5f7fb;
                            color: #1f2937;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            margin: 0;
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
                            text-align: center;
                            max-width: 500px;
                        }
                        h1 {
                            color: #166534;
                            margin-bottom: 20px;
                        }
                        .asset-info {
                            margin: 20px 0;
                            padding: 20px;
                            background: #f9fafb;
                            border-radius: 6px;
                        }
                        .asset-info p {
                            margin: 10px 0;
                        }
                        .btn {
                            display: inline-block;
                            padding: 12px 24px;
                            background: #1e3a8a;
                            color: white;
                            text-decoration: none;
                            border-radius: 6px;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>ITEM HAS NOT BEEN REPORTED AS LOST</h1>
                        <div class="asset-info">
                            <p><strong>Asset ID:</strong> ${asset.asset_id}</p>
                            <p><strong>Name:</strong> ${asset.name}</p>
                            <p><strong>Department:</strong> ${asset.department || 'N/A'}</p>
                            <p><strong>Status:</strong> ${asset.status}</p>
                        </div>
                        <a href="/" class="btn">Return to Home</a>
                    </div>
                </body>
                </html>
            `);
        } else if (asset.status === 'Lost') {
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Lost Asset Report</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            background: #f5f7fb;
                            color: #1f2937;
                            margin: 0;
                            padding: 20px;
                        }
                        .container {
                            max-width: 700px;
                            margin: 40px auto;
                            background: white;
                            padding: 30px;
                            border-radius: 10px;
                            box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
                        }
                        h1 {
                            color: #991b1b;
                            margin-bottom: 20px;
                        }
                        .asset-info {
                            margin: 20px 0;
                            padding: 20px;
                            background: #fee2e2;
                            border-radius: 6px;
                        }
                        .asset-info p {
                            margin: 10px 0;
                        }
                        .form-group {
                            margin: 20px 0;
                        }
                        label {
                            display: block;
                            font-weight: bold;
                            margin-bottom: 8px;
                        }
                        input, textarea {
                            width: 100%;
                            padding: 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            box-sizing: border-box;
                        }
                        textarea {
                            height: 100px;
                            resize: vertical;
                        }
                        button {
                            width: 100%;
                            padding: 13px;
                            border: none;
                            border-radius: 6px;
                            background: #1e3a8a;
                            color: white;
                            font-size: 16px;
                            font-weight: bold;
                            cursor: pointer;
                        }
                        .btn {
                            display: inline-block;
                            padding: 12px 24px;
                            background: #1e3a8a;
                            color: white;
                            text-decoration: none;
                            border-radius: 6px;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>ITEM HAS BEEN REPORTED AS LOST</h1>
                        <div class="asset-info">
                            <p><strong>Asset ID:</strong> ${asset.asset_id}</p>
                            <p><strong>Name:</strong> ${asset.name}</p>
                            <p><strong>Department:</strong> ${asset.department || 'N/A'}</p>
                            <p><strong>Status:</strong> ${asset.status}</p>
                            ${asset.lost_at ? `<p><strong>Lost Since:</strong> ${new Date(asset.lost_at).toLocaleString()}</p>` : ''}
                        </div>
                        <h2>Submit Finder Report</h2>
                        <p>If you found this asset, please provide the following information:</p>
                        <form id="reportForm">
                            <input type="hidden" id="assetId" value="${asset.id}">
                            <div class="form-group">
                                <label for="location">Location Found</label>
                                <input type="text" id="location" required>
                            </div>
                            <div class="form-group">
                                <label for="foundTime">Date and Time Found</label>
                                <input type="datetime-local" id="foundTime" required>
                            </div>
                            <div class="form-group">
                                <label for="description">Description</label>
                                <textarea id="description" placeholder="Additional details about the found asset..."></textarea>
                            </div>
                            <button type="submit">Submit Finder Report</button>
                        </form>
                        <a href="/" class="btn">Return to Home</a>
                    </div>
                    <script>
                        document.getElementById('reportForm').addEventListener('submit', async (e) => {
                            e.preventDefault();
                            const assetId = document.getElementById('assetId').value;
                            const location = document.getElementById('location').value;
                            const foundTime = document.getElementById('foundTime').value;
                            const description = document.getElementById('description').value;
                            const token = localStorage.getItem('token');
                            
                            try {
                                const response = await fetch('/api/asset-reports', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': 'Bearer ' + token
                                    },
                                    body: JSON.stringify({
                                        asset_id: assetId,
                                        location: location,
                                        found_time: foundTime,
                                        description: description
                                    })
                                });
                                const data = await response.json();
                                if (data.success) {
                                    alert('Finder report submitted successfully!');
                                    document.getElementById('reportForm').reset();
                                } else {
                                    alert(data.message || 'Failed to submit report.');
                                }
                            } catch (error) {
                                alert('Unable to connect to the server.');
                            }
                        });
                    </script>
                </body>
                </html>
            `);
        } else if (asset.status === 'Recovered') {
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Asset Status</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            background: #f5f7fb;
                            color: #1f2937;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            margin: 0;
                        }
                        .container {
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08);
                            text-align: center;
                            max-width: 500px;
                        }
                        h1 {
                            color: #1e40af;
                            margin-bottom: 20px;
                        }
                        .asset-info {
                            margin: 20px 0;
                            padding: 20px;
                            background: #dbeafe;
                            border-radius: 6px;
                        }
                        .asset-info p {
                            margin: 10px 0;
                        }
                        .btn {
                            display: inline-block;
                            padding: 12px 24px;
                            background: #1e3a8a;
                            color: white;
                            text-decoration: none;
                            border-radius: 6px;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>ITEM HAS BEEN RECOVERED</h1>
                        <div class="asset-info">
                            <p><strong>Asset ID:</strong> ${asset.asset_id}</p>
                            <p><strong>Name:</strong> ${asset.name}</p>
                            <p><strong>Department:</strong> ${asset.department || 'N/A'}</p>
                            <p><strong>Status:</strong> ${asset.status}</p>
                        </div>
                        <a href="/" class="btn">Return to Home</a>
                    </div>
                </body>
                </html>
            `);
        }
    });
});

app.get("/api/qr/:assetId", async (req, res) => {
    const assetId = req.params.assetId;

    try {
        const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
        const qrUrl = `${serverUrl}/asset/${assetId}`;

        const qrCode = await qrcode.toBuffer(qrUrl);

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="qr-${assetId}.png"`);
        res.send(qrCode);
    } catch (error) {
        console.log("Error generating QR code:", error.message);
        res.status(500).send("Error generating QR code.");
    }
});

app.put("/api/assets/:id/status", authenticateToken, checkAssetAdminRole, (req, res) => {
    const assetId = req.params.id;
    const { status, lost_at } = req.body;

    if (!status || !['Available', 'Lost', 'Recovered'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid status."
        });
    }

    let sql = "UPDATE institutional_assets SET status = ?";
    const params = [status];

    if (lost_at && status === 'Lost') {
        const date = new Date(lost_at);

        if (isNaN(date.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid lost_at datetime."
            });
        }

        const mysqlDateTime = date.toISOString().slice(0, 19).replace('T', ' ');

        sql += ", lost_at = ?";
        params.push(mysqlDateTime);
    } else if (status === 'Available' || status === 'Recovered') {
        sql += ", lost_at = NULL";
    }

    sql += " WHERE id = ?";
    params.push(assetId);

    db.query(sql, params, (err, result) => {
        if (err) {
            console.log("Error updating asset status:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to update asset status."
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Asset not found."
            });
        }

        if (status === 'Lost') {
            notifyAdmins('Asset Marked as Lost', `Asset ID ${assetId} has been marked as lost.`);
        }

        res.json({
            success: true,
            message: "Asset status updated successfully!"
        });
    });
});

app.post("/api/asset-reports", authenticateToken, (req, res) => {
    const { asset_id, location, found_time, description } = req.body;
    const reporter_id = req.user.id;

    if (!asset_id) {
        return res.status(400).json({
            success: false,
            message: "Please provide asset ID."
        });
    }

    const sql = `
        INSERT INTO asset_reports (asset_id, reporter_id, location, found_time, description)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [asset_id, reporter_id, location, found_time, description], (err, result) => {
        if (err) {
            console.log("Error creating asset report:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to submit asset report.",
                error: err.message
            });
        }

        const reportId = result.insertId;
        notifyAdmins('New Asset Report Submitted', `A finder report has been submitted for asset ID ${asset_id}.`, reportId);

        res.status(201).json({
            success: true,
            message: "Asset report submitted successfully!",
            report_id: reportId
        });
    });
});

app.get("/api/asset-reports", (req, res) => {
    const sql = `
        SELECT
            asset_reports.*,
            institutional_assets.name AS asset_name,
            institutional_assets.asset_id AS asset_identifier,
            institutional_assets.status AS asset_status,
            users.name AS reporter_name
        FROM asset_reports
        LEFT JOIN institutional_assets ON asset_reports.asset_id = institutional_assets.id
        LEFT JOIN users ON asset_reports.reporter_id = users.id
        ORDER BY asset_reports.created_at DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.log("Error fetching asset reports:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch asset reports."
            });
        }

        res.json({
            success: true,
            reports: results
        });
    });
});

app.get("/api/asset-reports/:id", (req, res) => {
    const reportId = req.params.id;

    const sql = `
        SELECT
            asset_reports.*,
            institutional_assets.name AS asset_name,
            institutional_assets.asset_id AS asset_identifier,
            institutional_assets.status AS asset_status,
            institutional_assets.department AS asset_department,
            users.name AS reporter_name,
            users.email AS reporter_email
        FROM asset_reports
        LEFT JOIN institutional_assets ON asset_reports.asset_id = institutional_assets.id
        LEFT JOIN users ON asset_reports.reporter_id = users.id
        WHERE asset_reports.id = ?
    `;

    db.query(sql, [reportId], (err, results) => {
        if (err) {
            console.log("Error fetching asset report:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch asset report."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Asset report not found."
            });
        }

        res.json({
            success: true,
            report: results[0]
        });
    });
});

app.get("/api/asset-reports/:id/asset", (req, res) => {
    const reportId = req.params.id;

    const sql = `
        SELECT institutional_assets.*
        FROM asset_reports
        LEFT JOIN institutional_assets ON asset_reports.asset_id = institutional_assets.id
        WHERE asset_reports.id = ?
    `;

    db.query(sql, [reportId], (err, results) => {
        if (err) {
            console.log("Error fetching asset for report:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch asset."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Asset not found for this report."
            });
        }

        res.json({
            success: true,
            asset: results[0]
        });
    });
});

app.get("/api/notifications", (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({
            success: false,
            message: "Please provide user ID."
        });
    }

    const sql = `
        SELECT notifications.*, 
               asset_reports.asset_id,
               institutional_assets.name AS asset_name
        FROM notifications
        LEFT JOIN asset_reports ON notifications.report_id = asset_reports.id
        LEFT JOIN institutional_assets ON asset_reports.asset_id = institutional_assets.id
        WHERE notifications.user_id = ?
        ORDER BY notifications.created_at DESC
    `;

    db.query(sql, [user_id], (err, results) => {
        if (err) {
            console.log("Error fetching notifications:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch notifications."
            });
        }

        res.json({
            success: true,
            notifications: results
        });
    });
});

app.put("/api/notifications/:id/read", (req, res) => {
    const notificationId = req.params.id;

    const sql = "UPDATE notifications SET is_read = TRUE WHERE id = ?";

    db.query(sql, [notificationId], (err, result) => {
        if (err) {
            console.log("Error marking notification as read:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to mark notification as read."
            });
        }

        res.json({
            success: true,
            message: "Notification marked as read."
        });
    });
});

app.get("/api/users/:id", (req, res) => {
    const userId = req.params.id;

    const sql = "SELECT id, name, email, role FROM users WHERE id = ?";

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.log("Error fetching user:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch user."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.json({
            success: true,
            user: results[0]
        });
    });
});

app.get("/api/users", (req, res) => {
    const sql = "SELECT id, name, email, role FROM users ORDER BY name";

    db.query(sql, (err, results) => {
        if (err) {
            console.log("Error fetching users:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch users."
            });
        }

        res.json({
            success: true,
            users: results
        });
    });
});

app.post(
    "/api/found-items",
    authenticateToken,
    upload.single("image"),
    (req, res) => {
        const user_id = req.user.id;
        const title = req.body.title;
        const description = req.body.description;
        const location = req.body.location;
        const found_time = req.body.found_time;

        if (
            !title ||
            !description ||
            !location ||
            !found_time
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields."
            });
        }

        let imageUrl = null;

        if (req.file) {
            // Convert buffer to Base64 data URL for Vercel compatibility
            const base64Image = req.file.buffer.toString('base64');
            const mimeType = req.file.mimetype;
            imageUrl = `data:${mimeType};base64,${base64Image}`;
        }

        const sql = `
            INSERT INTO found_items
            (
                user_id,
                title,
                description,
                location,
                found_time,
                image_url
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                user_id,
                title,
                description,
                location,
                found_time,
                imageUrl
            ],
            (err, result) => {
                if (err) {
                    console.log(
                        "Error inserting found item:",
                        err.message
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Failed to report found item.",
                        error: err.message
                    });
                }

                res.status(201).json({
                    success: true,
                    message:
                        "Found item reported successfully!",
                    item_id: result.insertId,
                    image_url: imageUrl
                });
            }
        );
    }
);

app.get("/api/found-items", (req, res) => {
    const sql = `
        SELECT
            found_items.id,
            found_items.title,
            found_items.description,
            found_items.location,
            found_items.found_time,
            found_items.image_url,
            found_items.status,
            found_items.created_at,
            users.name AS reporter_name
        FROM found_items
        LEFT JOIN users
        ON found_items.user_id = users.id
        ORDER BY found_items.created_at DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.log(
                "Error fetching found items:",
                err.message
            );

            return res.status(500).json({
                success: false,
                message: "Failed to fetch found items."
            });
        }

        res.json({
            success: true,
            items: results
        });
    });
});

app.get("/api/found-items/:id", (req, res) => {
    const itemId = req.params.id;

    const sql = `
        SELECT
            found_items.*,
            users.name AS reporter_name,
            users.email AS reporter_email
        FROM found_items
        LEFT JOIN users
        ON found_items.user_id = users.id
        WHERE found_items.id = ?
    `;

    db.query(sql, [itemId], (err, results) => {
        if (err) {
            console.log(
                "Error fetching found item:",
                err.message
            );

            return res.status(500).json({
                success: false,
                message: "Failed to fetch found item."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Found item not found."
            });
        }

        res.json({
            success: true,
            item: results[0]
        });
    });
});

app.delete("/api/found-items/:id", authenticateToken, checkFoundPostOwnership, (req, res) => {
    const itemId = req.params.id;

    const sql = "DELETE FROM found_items WHERE id = ?";

    db.query(sql, [itemId], (err, result) => {
        if (err) {
            console.log("Error deleting found item:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to delete item."
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Found item not found."
            });
        }

        res.json({
            success: true,
            message: "Item deleted successfully!"
        });
    });
});

app.get("/api/found-items/:id/matches", (req, res) => {
    const foundItemId = req.params.id;

    const sql = `
        SELECT
            lost_items.id,
            lost_items.title,
            lost_items.description,
            lost_items.location,
            lost_items.lost_time,
            lost_items.image_url,
            lost_items.status
        FROM lost_items
        WHERE lost_items.status = 'Open'
        ORDER BY lost_items.created_at DESC
        LIMIT 10
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.log("Error fetching matching lost items:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch matching lost items."
            });
        }

        res.json({
            success: true,
            matches: results
        });
    });
});

app.post("/api/comments", authenticateToken, (req, res) => {
    const { item_type, item_id, message } = req.body;
    const user_id = req.user.id;

    if (!item_type || !item_id || !message) {
        return res.status(400).json({
            success: false,
            message: "Please provide all required fields."
        });
    }

    if (!['lost', 'found'].includes(item_type)) {
        return res.status(400).json({
            success: false,
            message: "Invalid item type. Must be 'lost' or 'found'."
        });
    }

    const sql = `
        INSERT INTO comments (item_type, item_id, user_id, message)
        VALUES (?, ?, ?, ?)
    `;

    db.query(sql, [item_type, item_id, user_id, message], (err, result) => {
        if (err) {
            console.log("Error creating comment:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to add comment.",
                error: err.message
            });
        }

        res.status(201).json({
            success: true,
            message: "Comment added successfully!",
            comment_id: result.insertId
        });
    });
});

app.get("/api/comments", (req, res) => {
    const { item_type, item_id } = req.query;

    let sql = `
        SELECT
            comments.*,
            users.name AS commenter_name
        FROM comments
        LEFT JOIN users ON comments.user_id = users.id
    `;

    const params = [];

    if (item_type && item_id) {
        sql += " WHERE comments.item_type = ? AND comments.item_id = ?";
        params.push(item_type, item_id);
    } else if (item_type) {
        sql += " WHERE comments.item_type = ?";
        params.push(item_type);
    }

    sql += " ORDER BY comments.created_at ASC";

    db.query(sql, params, (err, results) => {
        if (err) {
            console.log("Error fetching comments:", err.message);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch comments."
            });
        }

        res.json({
            success: true,
            comments: results
        });
    });
});



app.use((err, req, res, next) => {

    if (err instanceof multer.MulterError) {

        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "Image must be smaller than 5 MB."
            });
        }

        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    next();
});

// Export app for Vercel
module.exports = app;

// Only listen if running locally (not on Vercel)
if (require.main === module) {
    app.listen(
        process.env.PORT || 5000,
        '0.0.0.0',
        () => {
            console.log(
                "Server running at http://localhost:5000"
            );
            console.log(
                "For phone scanning, set SERVER_URL in .env to your LAN IP (e.g., http://192.168.1.X:5000)"
            );
        }
    );
}
