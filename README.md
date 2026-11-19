# Smart Healthcare Cloud — Temporary Storage Version

This college project uses **server-side in-memory storage**. It has no database dependency.

## Requirements
- Node.js 20 or newer (LTS recommended)
- npm (included with Node.js)

## Run on Windows
1. Extract the ZIP file.
2. Open the `smart-healthcare-cloud` folder in VS Code.
3. Choose **Terminal → New Terminal**.
4. Run:
   ```bash
   npm install
   npm start
   ```
5. Open http://localhost:3000 in your browser.

## Demo administrator
- Email: `admin@healthcloud.local`
- Password: `Admin@123`

Register a patient account using **Get started** to test patient features. Log in as the demo admin to manage demo users and appointment requests.

## What is temporary?
- User accounts and appointment records are held in arrays in the Node.js process memory.
- Data is shared between browser sessions while this server process is running.
- **Restarting or stopping the server clears all users and appointments.**
- The demo admin account is recreated every time the server starts.
- Login sessions are handled separately by Express Session's default in-memory store.

## Important
This is an educational prototype, not a production medical system. Use fictional/demo data only. Do not use real patient or sensitive health information. Before any public deployment, use a persistent, production-grade session store, set a strong `SESSION_SECRET`, enable secure cookies behind HTTPS, add CSRF protection and rate limiting, and review applicable privacy/security requirements.
