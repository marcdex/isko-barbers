# 🪒 Isko Barbers — How to Run in VS Code

---

## ✅ Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18 or newer | https://nodejs.org |
| VS Code | Any recent | https://code.visualstudio.com |

Check Node.js is installed — open a terminal and run:
```
node -v
```
You should see something like `v20.11.0`.

---

## 📁 Project Structure

```
isko-barbers-pro/
├── public/
│   ├── css/style.css     ← All styles
│   ├── js/main.js        ← All frontend JavaScript
│   ├── images/           ← All organized images
│   ├── index.html        ← Main website
│   ├── login.html        ← Admin login
│   └── admin.html        ← Admin dashboard
├── db/                   ← SQLite database (auto-created)
├── server.js             ← Express backend
├── package.json
├── .env.example
└── .gitignore
```

---

## 🚀 Step-by-Step Setup

### Step 1 — Open in VS Code
1. Open **VS Code**
2. Click **File → Open Folder**
3. Select the `isko-barbers-pro` folder

### Step 2 — Open the terminal
Press `` Ctrl + ` `` (backtick) or go to **Terminal → New Terminal**

### Step 3 — Install dependencies
```bash
npm install
```
Wait for it to finish (~30–60 seconds). You'll see `added X packages`.

### Step 4 — Set up your .env file
```bash
# Windows PowerShell:
copy .env.example .env

# Mac / Linux:
cp .env.example .env
```
The default values in `.env` work fine for local development — no edits needed.

### Step 5 — Run the server
```bash
node server.js
```

You should see:
```
✅ Default admin created — username: "admin"
✅ Database ready: db/bookings.db

🪒  Isko Barbers server v3.1 running!
    Website  → http://localhost:3000
    Login    → http://localhost:3000/login.html
    Admin    → http://localhost:3000/admin.html
```

### Step 6 — Open in browser
Go to: **http://localhost:3000** 🎉

---

## 🔐 Admin Login
```
Username: admin
Password: iskobarbers2025
```
Admin panel: http://localhost:3000/admin.html

---

## 🔄 Auto-restart on file changes (optional)
```bash
npm run dev
```

---

## 🛑 Stop the server
Press `Ctrl + C` in the terminal.

---

## ❓ Common Problems

| Error | Fix |
|-------|-----|
| `Cannot find module 'dotenv'` | Run `npm install` first |
| `EADDRINUSE: port 3000` | Change `PORT=3001` in `.env`, visit http://localhost:3001 |
| `SQLITE_CANTOPEN` | Create the db folder: `mkdir db` |
| Booking says "Cannot connect" | Make sure `node server.js` is running |

---

## 📧 Email Setup (optional)
1. Enable 2-Step Verification on Google account
2. Generate an **App Password** at myaccount.google.com → Security
3. Add to `.env`:
```
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-16-char-app-password
```
Restart server after saving.

---

*Built with Node.js · Express · SQLite · Vanilla JS*

