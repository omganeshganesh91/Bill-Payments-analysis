# Smart Bill Scanner 🧾

A full-stack mobile app to scan, track, and analyze your bills and financial documents.

## Project Structure

```
smart-bill-scanner/
├── api/                    # Node.js + SQLite Backend
│   ├── src/
│   │   ├── server.js       # Express app entry point
│   │   ├── database/
│   │   │   └── init.js     # SQLite schema + seed data
│   │   └── routes/
│   │       ├── bills.js    # CRUD for bills
│   │       ├── categories.js
│   │       ├── dashboard.js
│   │       └── users.js
│   ├── package.json
│   └── .env
└── app/                    # React Native (Expo) Frontend
    ├── app/
    │   ├── _layout.js      # Root layout
    │   ├── (tabs)/         # Tab screens
    │   │   ├── index.js    # Home/Dashboard
    │   │   ├── bills.js    # Bills list
    │   │   ├── scanner.js  # Camera scanner
    │   │   ├── analytics.js
    │   │   └── profile.js
    │   └── bill/
    │       ├── [id].js     # Bill detail
    │       └── add.js      # Add/Edit bill
    └── src/
        ├── config/api.js
        ├── constants/theme.js
        ├── hooks/useApi.js
        └── services/notifications.js
```

## Setup & Run

### 1. Start the API

```bash
cd smart-bill-scanner/api
npm install
npm run dev
```

API runs at: http://localhost:3000
Health check: http://localhost:3000/api/health

### 2. Start the Expo App

```bash
cd smart-bill-scanner/app
npm install
npx expo start
```

Scan the QR code with **Expo Go** app on your phone.

### 3. Configure API URL

Edit `app/src/config/api.js` and set the correct BASE_URL:

- Android Emulator: `http://10.0.2.2:3000/api`
- iOS Simulator: `http://localhost:3000/api`
- Physical device: `http://YOUR_LOCAL_IP:3000/api`

Find your local IP: Run `ipconfig` on Windows.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/bills | List bills (with filters) |
| POST | /api/bills | Create bill |
| GET | /api/bills/:id | Get single bill |
| PUT | /api/bills/:id | Update bill |
| PATCH | /api/bills/:id/status | Mark paid/unpaid |
| DELETE | /api/bills/:id | Delete bill |
| GET | /api/categories | List categories |
| POST | /api/categories | Create category |
| GET | /api/dashboard/summary | Dashboard stats |
| GET | /api/dashboard/analytics | Yearly analytics |
| GET | /api/users/me | Get user profile |
| PUT | /api/users/me | Update profile |

## Features Built

- 📷 Camera-based bill scanning with scan frame overlay
- 🔍 Mock OCR data extraction (plug in Google Vision API for real OCR)
- 📋 Bills list with search and status filters
- 📊 Analytics with bar charts, category breakdown, smart insights
- ⏰ Due date notifications (3 days, 1 day, same day)
- 💰 Budget tracking with progress bar
- 🗂️ 14 pre-seeded bill categories
- ✏️ Full CRUD for bills with manual entry form
- 👤 Profile settings with monthly budget

## Adding Real OCR

In `app/app/(tabs)/scanner.js`, replace the mock `processImage` function
with a real OCR API call. Recommended options:

1. **Google Cloud Vision API** — Most accurate for handwritten text
2. **AWS Textract** — Great for structured documents and forms
3. **Microsoft Azure Computer Vision** — Good balance of accuracy and cost
4. **Tesseract.js** — Free, open-source, runs locally (lower accuracy)
