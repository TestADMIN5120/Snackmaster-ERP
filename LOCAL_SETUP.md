# SnackMaster ERP - Local Setup & Restart Guide

## Prerequisites

- **Node.js** v18+ (v22.12+ recommended for Vite 7)
- **npm** (comes with Node.js)
- A **Firebase project** with the following enabled:
  - Firestore Database
  - Authentication (Email/Password provider)
  - A registered Web App

---

## Initial Setup (First Time Only)

### Step 1: Install Dependencies

Open a terminal in the project root and run:

```bash
cd frontend
npm install

cd ../backend
npm install
```

### Step 2: Firebase Project Configuration

#### 2a. Create a Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Build > Firestore Database**
4. Click **Create database**
5. Choose a region close to you
6. Select **Start in test mode**
7. Click **Create**

#### 2b. Enable Email/Password Authentication

1. In Firebase Console, go to **Build > Authentication**
2. Click **Get started**
3. Select **Email/Password** provider
4. Toggle **Enable** and click **Save**

#### 2c. Register a Web App

1. Go to **Project Settings** (gear icon)
2. Scroll to **Your apps** section
3. Click the web icon (`</>`)
4. Enter a nickname (e.g., "SnackMaster Web")
5. Click **Register app**
6. Copy the `firebaseConfig` values shown

#### 2d. Download Service Account Key

1. Go to **Project Settings > Service accounts**
2. Select **Firebase Admin SDK** (Node.js)
3. Click **Generate new private key**
4. Save the downloaded file as `backend/serviceAccountKey.json`

> **WARNING:** Never commit `serviceAccountKey.json` to version control. It contains sensitive credentials.

### Step 3: Configure Frontend Environment

Edit `frontend/.env.development` with your Firebase config values:

```env
VITE_ENV=development
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Replace each value with the config from Step 2c.

### Step 4: Seed the Database

Run the seed script to create initial users, machines, and organization data:

```bash
cd backend
node seed.js
```

This creates:

| Role     | Email                          | Password       |
|----------|--------------------------------|----------------|
| Admin    | vdsplofficial@gmail.com        | Snackmaster123 |
| Refiller | riteshkumarrajak3@gmail.com    | test1234       |
          │                      │                                
├──────────┼──────────────────────┤                                          
│ Email    │ vdsplsuper@gmail.com │                                          
├──────────┼──────────────────────┤                                          
│ Password │ SuperMaster123       │                                          
├──────────┼──────────────────────┤                                          
│ Role     │ super_admin
It also creates a default organization and two sample vending machines.

---

## Starting the Application

### Start the Frontend (React + Vite)

```bash
cd frontend
Warehouse Data Sheets
```

The frontend will be available at **http://localhost:5173/**

### Start the Backend (Express API)

Open a **separate terminal**:

```bash
cd backend
node index.js
```

The backend will be available at **http://localhost:5001/**

> **Note:** The `package.json` includes a `dev` script using `nodemon` for auto-reload. To use it, install nodemon globally (`npm install -g nodemon`) and run `npm run dev` instead.

---

## Restarting the Application

### Restart Frontend

1. In the terminal running Vite, press `Ctrl + C` to stop
2. Run again:
   ```bash
   cd frontend
   npm run dev
   ```

A restart is needed when you change:
- `.env.development` (environment variables)
- `vite.config.js` (build configuration)
- Install/remove dependencies

> **Tip:** For code changes in `src/`, Vite hot-reloads automatically -- no restart needed.

### Restart Backend

1. In the terminal running the backend, press `Ctrl + C` to stop
2. Run again:
   ```bash
   cd backend
   node index.js
   ```

A restart is needed when you change:
- `index.js` (server code)
- `serviceAccountKey.json`
- Install/remove dependencies

> **Tip:** Use `npm run dev` (requires nodemon) for auto-reload on file changes.

### Restart Both

If you need a clean restart of the full stack:

1. Press `Ctrl + C` in both terminals
2. Start the frontend in terminal 1:
   ```bash
   cd frontend
   npm run dev
   ```
3. Start the backend in terminal 2:
   ```bash
   cd backend
   node index.js
   ```

---

## Port Reference

| Service  | Default Port | URL                       |
|----------|-------------|---------------------------|
| Frontend | 5173        | http://localhost:5173/     |
| Backend  | 5001        | http://localhost:5001/     |

If port 5173 is already in use, Vite will automatically pick the next available port (5174, 5175, etc.) and display it in the terminal.

The backend port can be changed by setting the `PORT` environment variable:
```bash
PORT=5002 node index.js
```

---

## Troubleshooting

### "Invalid email or password" on login
- Verify that `frontend/.env.development` has the correct Firebase config matching your project
- Ensure the seed script (`node seed.js`) ran successfully
- Restart the frontend after changing `.env.development`

### "Cloud Firestore API has not been used in project..."
- Go to Firebase Console and create a Firestore Database (Build > Firestore Database > Create database)

### "There is no configuration corresponding to the provided identifier"
- Enable Email/Password authentication in Firebase Console (Build > Authentication > Email/Password)

### "CRITICAL: No FIREBASE_SERVICE_ACCOUNT env var, and serviceAccountKey.json is missing"
- Place your Firebase service account key at `backend/serviceAccountKey.json`
- Download it from Firebase Console > Project Settings > Service accounts > Generate new private key

### Vite requires a newer Node.js version
- Vite 7.x requires Node.js 20.19+ or 22.12+
- Either upgrade Node.js or downgrade Vite: `cd frontend && npm install vite@6`

### Port already in use
- Another process is using the port. Either stop it or let Vite auto-select a new port
- For the backend, set a different port: `PORT=5002 node index.js`

---

## Project Structure

```
Snackmaster-ERP-main/
├── frontend/                  # React 18 + Vite
│   ├── src/
│   │   ├── pages/             # Page components (admin/, refiller/, super/)
│   │   ├── components/        # Reusable UI components
│   │   ├── contexts/          # React Context (auth/state)
│   │   ├── hooks/             # Custom hooks
│   │   ├── layouts/           # Layout components per role
│   │   ├── firebaseClient.js  # Firebase SDK initialization
│   │   └── main.jsx           # App entry with routing
│   ├── .env.development       # Firebase config (dev)
│   ├── vite.config.js         # Vite build config
│   └── package.json
│
├── backend/                   # Express API server
│   ├── index.js               # Server with API endpoints
│   ├── seed.js                # Database seeding script
│   ├── seedAdmin.js           # Admin-only seeding
│   ├── serviceAccountKey.json # Firebase credentials (not in repo)
│   └── package.json
│
├── functions/                 # Firebase Cloud Functions
│   ├── index.js
│   └── package.json
│
├── firebase.json              # Firebase CLI config
├── .firebaserc                # Firebase project binding
└── LOCAL_SETUP.md             # This file
```
