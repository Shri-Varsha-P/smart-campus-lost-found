# Smart Campus Lost & Found - Setup Instructions

## Quick Start

### Option 1: Automated Setup (Recommended)
```bash
node start-application.js
```

This single command will:
1. Check your `.env` configuration
2. Run the safe database migration
3. Start the server at http://localhost:5000

### Option 2: Manual Setup
```bash
# Step 1: Install dependencies
npm install

# Step 2: Run database migration
node run-safe-migration.js

# Step 3: Start server
node server.js
```

## Database Configuration

Ensure your `.env` file contains:
```
DB_HOST=smart-campus-db-shrivarshaps-d218.a.aivencloud.com
DB_PORT=27155
DB_USER=avnadmin
DB_PASSWORD=your-aiven-password
DB_NAME=defaultdb
DB_SSL=true
JWT_SECRET=your-jwt-secret-key
ADMIN_REGISTRATION_CODE=your-admin-registration-code
PORT=5000
SERVER_URL=http://localhost:5000
```

## What the Migration Does

The safe migration (`run-safe-migration.js`) will:
- Add `notification_manager` and `staff` to users.role ENUM
- Add notification workflow columns to notifications table:
  - `notification_type` (ENUM)
  - `asset_id` (INT, references institutional_assets)
  - `approval_status` (ENUM: pending, approved, rejected)
  - `handled_by` (INT, references users)
  - `handled_at` (TIMESTAMP)
  - `lost_item_id` (INT, references lost_items)
- Add necessary indexes for performance
- Add foreign key constraints for data integrity
- Update existing notifications with proper types
- **Preserve all existing data and tables**
- **Be idempotent (safe to run multiple times)**

## Access the Application

Open your browser and navigate to:
```
http://localhost:5000
```

## Default Users (from schema.sql)
- Admin: `admin@campus.edu` (role: admin)
- Security: `security@campus.edu` (role: security)
- Student: `student@campus.edu` (role: student)

**Note:** These users may not have passwords set. Use the `update-passwords.js` script if needed to set passwords.

## Setting Up Notification Manager

1. **Create a test user** via Signup page (select Student or Staff role)
2. **Login as Admin** (`admin@campus.edu`)
3. **Go to Admin Dashboard** → Manage Users
4. **Assign notification_manager role** to the test user
5. **Logout as Admin**
6. **Login as Notification Manager**
7. **Access Notification Manager Dashboard** (link in navigation)

## Testing the Workflows

### Personal Lost Item Notification (Automatic)
1. Login as Student
2. Report a lost item via "Report Lost Item"
3. Logout and login as another Student/Staff
4. Check Notifications page
5. **Expected:** You should see the lost item notification automatically (no approval needed)

### Campus Asset Notification (Requires Approval)
1. Login as Admin
2. Go to "Register Asset (Admin)"
3. Create/Register an institutional asset
4. Generate and download QR code
5. Go to Assets page
6. Change asset status from "Available" to "Lost"
7. Logout and login as Notification Manager
8. Check Notification Manager Dashboard
9. **Expected:** You should see a pending campus asset alert
10. Approve or Reject the alert
11. If approved, logout and login as normal user
12. Check Notifications page
13. **Expected:** You should see the campus asset lost notification

### QR Code Workflow
1. **Scan QR while Available:**
   - Expected message: "ITEM HAS NOT BEEN REPORTED AS LOST"
   - Scanning should NOT change asset status

2. **Scan QR while Lost:**
   - Expected: Shows lost asset information
   - Shows finder report form
   - Submit report with location, time, and optional image
   - Report is associated with the correct institutional asset

## Application Features

### Authentication & Authorization
- User authentication with JWT
- Role-based access control:
  - `student` - Normal user access
  - `staff` - Normal user access (can become admin with code)
  - `admin` - Full administrative access
  - `security` - Security personnel access
  - `notification_manager` - Can approve/reject campus asset alerts only

### Core Functionality
- Personal lost item reporting
- Personal found item reporting
- Institutional asset management
- QR code generation for assets
- Asset status tracking (Available, Lost, Recovered)
- Finder reports for lost assets
- Claim system for lost items with 24-hour deadline
- Comments on lost/found items
- Notification system with approval workflow
- Admin dashboard
- Notification Manager dashboard
- User management (admin only)

### Notification System
- Personal lost items: Automatic broadcast to all normal users
- Campus assets: Pending approval by Notification Manager before broadcast
- Asset reports: Notifications to admins/security
- General notifications: System-wide announcements

## Troubleshooting

### Database Connection Issues
- Verify `.env` configuration matches Aiven dashboard
- Check network connectivity to Aiven
- Ensure Aiven database is running
- Verify SSL certificate configuration
- Check if VPN is required for Aiven access

### Migration Issues
- The migration is designed to be idempotent
- You can safely run it multiple times
- It will skip columns/indices that already exist
- Check migration output for specific errors

### Server Startup Issues
- Check database connection first
- Verify all dependencies are installed (`npm install`)
- Check port 5000 is not in use
- Review server console output for specific errors

### Permission Issues
- Ensure .env file has correct credentials
- Check database user has necessary permissions
- Verify firewall/network settings

## Files Modified for Notification Manager

### Backend
- `server.js` - Added notification manager middleware, endpoints, and notification functions
- `run-safe-migration.js` - New safe migration script
- `database-migration.sql` - Updated with notification manager changes
- `.env.example` - Updated with correct Aiven configuration

### Frontend
- `public/notification-manager.html` - NEW: Notification Manager dashboard
- `public/users.html` - NEW: User management page
- `public/admin.html` - Updated to reference user management
- `public/index.html` - Updated navigation for notification_manager role
- `public/notifications.html` - Updated to show links to lost items and assets

### Documentation
- `README-SETUP.md` - This file
- `start-application.js` - NEW: Convenience script for setup and startup

## Important Notes

- **Do not push sensitive data to GitHub** - .env is in .gitignore
- **Keep .env file secure** - contains database credentials
- **Preserve existing database data** - migration is safe and additive
- **Test thoroughly in development before production**
- **Notification Manager role is separate from Admin** - does not inherit admin privileges
- **Signup prevents notification_manager selection** - only admin can assign this role

## Security Considerations

- Passwords are hashed using bcrypt
- JWT tokens expire after 24 hours
- All protected endpoints verify server-side authorization
- Role-based access control enforced in middleware
- SSL required for Aiven database connection
- SQL injection protection via parameterized queries

## Next Steps After Setup

1. Set passwords for default users using `update-passwords.js`
2. Create test accounts for each role
3. Test personal lost item workflow
4. Test campus asset workflow with Notification Manager
5. Test QR code generation and scanning
6. Test claim system
7. Verify all role permissions

## Support

If you encounter issues:
1. Check the migration output for specific errors
2. Review server console output
3. Verify database connection in your network environment
4. Check Aiven dashboard for database status
5. Ensure all environment variables are set correctly
