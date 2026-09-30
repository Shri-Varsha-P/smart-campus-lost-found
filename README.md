# Smart Campus Lost & Found System
Smart Campus Lost & Found is a web-based platform developed to help students and staff report, find, and claim lost items within a campus. It also supports the management of institutional assets using QR codes.

The system allows users to create lost and found posts, submit claims, communicate through comments, and receive notifications. Institutional assets can be registered by administrators and assigned QR codes. If an asset is reported as lost, a person who finds it can scan its QR code and submit details about where and when it was found.

## Features
### Lost and Found
Users can report lost or found items by providing details such as the item description, location, and images. Other users can browse the available posts and check for possible matches.

### Claims
Users can submit a claim when they believe a found item belongs to them. Claims can be reviewed and either approved or rejected by an administrator.

### QR-Coded Institutional Assets
Administrators can register institutional assets and generate a unique QR code for each asset. The QR code can be attached to the physical asset.

When an asset is marked as lost, anyone who finds it can scan its QR code to view the relevant information and submit a finder report. Scanning the QR code does not automatically change the asset status.

### Notifications
The system provides notifications for relevant lost and found activities. Notifications related to institutional assets are handled through a Notification Manager before being sent to users.

### User Roles
The system uses role-based access control. Different roles have different permissions, including Student, Staff, Security, Notification Manager, and Admin.

### Comments
Users can add comments to posts to provide additional information or discuss details about an item.

## Technology Used
The frontend is built using HTML, CSS, and JavaScript.

The backend uses Node.js with Express 5, and MySQL is used as the database. The database can also be hosted using Aiven.

JWT is used for authentication and bcrypt is used for password hashing. Multer is used for handling image uploads, and the qrcode package is used to generate QR codes.

The application is also structured to support deployment using Vercel.

## Getting Started
### 1. Clone the Repository

Clone the repository and move into the project directory.

```bash
git clone https://github.com/Shri-Varsha-P/smart-campus-lost-found.git
cd smart-campus-lost-found
npm install
```

### 2. Configure the Environment Variables
Create a `.env` file in the project root and add the required database and authentication details.

```env
DB_HOST=your-db-host
DB_PORT=3306
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name
JWT_SECRET=your-jwt-secret
ADMIN_REGISTRATION_CODE=your-admin-code
PORT=5000
SERVER_URL=http://localhost:5000
```
For testing QR code scanning from a phone while running the application locally, `SERVER_URL` can be set to the computer's local network IP address.
For example:
```env
SERVER_URL=http://192.168.1.X:5000
```
Make sure the phone and the computer are connected to the same network.

### 3. Set Up the Database
Run the migration script to create or update the required database tables.
```bash
node run-safe-migration.js
```
The migration script can be run multiple times without unnecessarily recreating existing tables.

### 4. Start the Application
Start the server using:

```bash
npm start
```
For development, the development script can also be used if it is configured in `package.json`.
Once the server is running, open:

```text
http://localhost:5000
```

The application can also be started using:

```bash
node start-application.js
```

## Project Structure
```text
smart-campus-lost-found/
├── server.js
├── api/
│   └── index.js
├── database/
├── public/
├── uploads/
├── qr-codes/
├── vercel.json
├── package.json
└── .env
```

`server.js` contains the main Express server and API routes.

The `api` directory contains the entry point used for Vercel deployment.

The `database` directory contains the database schema and migration files.

The `public` directory contains the frontend files.

The `uploads` directory is used to store uploaded images, while `qr-codes` contains the generated QR code files.

## API Endpoints
The application provides APIs for authentication, lost and found items, claims, institutional assets, asset reports, notifications, users, and comments.

Some of the main endpoints include:

```text
Authentication
/api/signup
/api/login
/api/auth/me

Lost Items
/api/lost-items

Found Items
/api/found-items
/api/found-items/:id/matches

Claims
/api/claims

Institutional Assets
/api/assets
/api/qr/:assetId
/asset/:assetId

Asset Reports
/api/asset-reports

Notifications
/api/notifications
/api/notification-manager/*

Users and Comments
/api/users
/api/comments
```

## User Roles
The system has five main roles.

**Student and Staff**
They can report lost or found items, browse posts, submit claims, and add comments.

**Security**
Security personnel can handle found institutional items and assist with the recovery process.

**Notification Manager**
The Notification Manager reviews and manages notifications related to institutional assets.

**Admin**
Administrators have access to system management functions, including managing users, claims, and institutional assets.

## Security
Authentication is handled using JWT, and passwords are stored using bcrypt hashing.

Sensitive configuration such as database credentials, JWT secrets, and the administrator registration code are stored in environment variables.

The `.env` file should never be committed to the repository. It is included in `.gitignore` to prevent it from being uploaded accidentally.
