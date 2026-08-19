# 🆓 100% Free Production Deployment & Setup Guide (Render, Atlas, Upstash, Vercel)

This guide provides a **step-by-step, zero-cost blueprint** to deploy the complete **AURA STUDIO** platform (Backend API + WebSockets + MongoDB + Redis + Twilio SMS + Frontend UI) using **100% Free-Tier Services**.

---

## 📑 Table of Contents
1. [Free Tier Architecture Map (Zero Cost)](#1-free-tier-architecture-map-zero-cost)
2. [Prerequisites Checklist (Before Deploying)](#2-prerequisites-checklist-before-deploying)
3. [Step 1: Free MongoDB Atlas Database Setup](#step-1-free-mongodb-atlas-database-setup)
4. [Step 2: Free Serverless Redis Setup (Upstash)](#step-2-free-serverless-redis-setup-upstash)
5. [Step 3: Free Twilio SMS Setup](#step-3-free-twilio-sms-setup)
6. [Step 4: Deploy Backend API on Render (Free Web Service)](#step-4-deploy-backend-api-on-render-free-web-service)
7. [Step 5: Deploy Frontend on Vercel / Netlify (Free Static Hosting)](#step-5-deploy-frontend-on-vercel--netlify-free-static-hosting)
8. [Step 6: Keep Render Free Server Awake 24/7 (Prevent Cold Starts)](#step-6-keep-render-free-server-awake-247-prevent-cold-starts)
9. [Free vs Paid Tier Comparison Table](#9-free-vs-paid-tier-comparison-table)

---

## 1. Free Tier Architecture Map (Zero Cost)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       100% ZERO COST CLOUD STACK                           │
├───────────────────┬───────────────────────────────┬────────────────────────┤
│ Layer             │ Provider & Free Plan          │ Cost                   │
├───────────────────┼───────────────────────────────┼────────────────────────┤
│ 🌐 Frontend UI    │ Vercel / Netlify (Static CDN) │ $0 / month (Unlimited) │
│ 🚀 Backend API    │ Render Free Web Service       │ $0 / month (750 hours) │
│ 🗄️ Database       │ MongoDB Atlas (M0 Shared)     │ $0 / month (512 MB)    │
│ ⚡ Redis Cache    │ Upstash Redis (Serverless)    │ $0 / month (10k cmd/d) │
│ 📱 SMS Delivery   │ Twilio Free Trial ($15 credit)│ $0 (Initial credits)   │
│ ⏱️ Health Pinger  │ Cron-Job.org / UptimeRobot    │ $0 / month (50 pings)  │
└───────────────────┴───────────────────────────────┴────────────────────────┘
```

---

## 2. Prerequisites Checklist (Before Deploying)

Before starting the deployment, create free accounts on these platforms:
- [ ] **GitHub Account**: To push your code repository.
- [ ] **MongoDB Atlas Account**: [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) (Free Database).
- [ ] **Upstash Account**: [upstash.com](https://upstash.com) (Free Serverless Redis).
- [ ] **Render Account**: [render.com](https://render.com) (Free Node.js Hosting).
- [ ] **Vercel Account**: [vercel.com](https://vercel.com) (Free Frontend CDN Hosting).
- [ ] **Twilio Account**: [twilio.com](https://www.twilio.com) (Free $15 SMS credit).

---

## Step 1: Free MongoDB Atlas Database Setup

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Click **Create a Deployment** ➔ Select **M0 Free (Shared)**.
3. Choose your nearest region (e.g. `AWS - Mumbai (ap-south-1)` or `AWS - N. Virginia (us-east-1)`).
4. **Security Setup (Crucial for Render)**:
   - **Database Access**: Create a Database User (e.g. `aura_admin` + strong password).
   - **Network Access**: Go to *Network Access* ➔ Click **Add IP Address** ➔ Select **Allow Access From Anywhere (`0.0.0.0/0`)**. *(Render dynamic servers change IPs on restart, so 0.0.0.0/0 is required).*
5. Click **Connect** ➔ **Drivers** ➔ Copy the Connection String:
   ```ini
   mongodb+srv://aura_admin:<PASSWORD>@cluster0.xxxxxx.mongodb.net/salon_booking?retryWrites=true&w=majority
   ```

---

## Step 2: Free Serverless Redis Setup (Upstash)

1. Log in to [Upstash Console](https://console.upstash.com).
2. Click **Create Database** ➔ Choose **Redis**.
3. Select your region nearest to your MongoDB Atlas region.
4. Under the database details, scroll to **Node.js / ioredis** connection section.
5. Copy the `REDIS_URL` string:
   ```ini
   rediss://default:<YOUR_PASSWORD>@<YOUR_UPSTASH_ENDPOINT>.upstash.io:6379
   ```

---

## Step 3: Free Twilio SMS Setup

1. Log in to [Twilio Console](https://console.twilio.com).
2. Grab your free **$15 Trial Balance**.
3. Under the dashboard, copy:
   - **Account SID**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Auth Token**: `your_auth_token_here`
4. Click **Get a Phone Number** ➔ Copy your Twilio number (e.g. `+1205xxxxxxx`).
5. *Note: In trial mode, add your test phone number to **Phone Numbers ➔ Verified Caller IDs**.*

---

## Step 4: Deploy Backend API on Render (Free Web Service)

1. Push your project to a GitHub repository.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** ➔ Select **Web Service**.
4. Connect your GitHub repository.
5. Configure the Web Service settings:
   - **Name**: `aura-studio-api`
   - **Region**: Nearest to your MongoDB Atlas (e.g. `Singapore` / `Frankfurt` / `Ohio`).
   - **Branch**: `main`
   - **Root Directory**: `.` *(Leave blank or dot)*
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm ci && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
   - **Instance Type**: Select **Free ($0/month)**.

6. **Add Environment Variables** in Render:
   Click **Add Environment Variable** and add:

   | Key | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` *(Render sets this automatically)* |
   | `API_PREFIX` | `/api/v1` |
   | `MONGODB_URI` | `mongodb+srv://...` *(from Step 1)* |
   | `REDIS_URL` | `rediss://default:...` *(from Step 2)* |
   | `JWT_ACCESS_SECRET` | `64_char_random_hex_string` |
   | `JWT_REFRESH_SECRET` | `64_char_random_hex_string` |
   | `CORS_ORIGIN` | `*` *(or your Vercel URL once created)* |
   | `TWILIO_ACCOUNT_SID` | `AC...` *(from Step 3)* |
   | `TWILIO_AUTH_TOKEN` | `...` *(from Step 3)* |
   | `TWILIO_PHONE_NUMBER`| `+1...` *(from Step 3)* |
   | `LOG_LEVEL` | `info` |

7. Click **Create Web Service**.
8. Render will build and deploy your API! Your free URL will look like:
   `https://aura-studio-api.onrender.com`

---

## Step 5: Deploy Frontend on Vercel / Netlify (Free Static Hosting)

1. Log in to [Vercel](https://vercel.com).
2. Click **Add New Project** ➔ Import your GitHub repository.
3. In project configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* ➔ Select `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** and add:

   | Key | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://aura-studio-api.onrender.com/api/v1` |
   | `VITE_SOCKET_URL` | `https://aura-studio-api.onrender.com` |

5. Click **Deploy**.
6. Vercel will deploy your luxury UI in seconds with free SSL (`https://aura-studio.vercel.app`).
7. *(Optional)* Update `CORS_ORIGIN` on Render to `https://aura-studio.vercel.app` for maximum security.

---

## Step 6: Keep Render Free Server Awake 24/7 (Prevent Cold Starts)

> [!NOTE]
> Render free web services go to "sleep" after 15 minutes of inactivity, causing a 30-second delay on the next request. You can keep it awake 24/7 for **100% free** using a cron pinger!

1. Go to [Cron-Job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) (Both 100% Free).
2. Create a new monitor / cron job:
   - **URL**: `https://aura-studio-api.onrender.com/api/v1/health`
   - **Interval**: Every **10 minutes** (24/7)
   - **HTTP Method**: `GET`
3. **Result**: Your free Render backend will never sleep and will always respond in **<100ms**!

---

## 9. Free vs Paid Tier Comparison Table

| Feature / Service | 🆓 100% Free Setup | 💎 Paid Setup ($25/mo) |
| :--- | :--- | :--- |
| **Backend Web Service** | Render Free Tier (512MB RAM, 0.1 CPU) | Render Starter ($7/mo) or Railway ($5/mo) |
| **Database** | MongoDB Atlas M0 (512MB, Shared) | MongoDB Atlas M10 ($0.08/hr Dedicated) |
| **Redis Cache** | Upstash Serverless (10k requests/day) | Upstash Pro or Redis Cloud ($5/mo) |
| **Frontend CDN** | Vercel Hobby (Unlimited bandwidth, Free SSL) | Vercel Pro ($20/mo) |
| **SMS Delivery** | Twilio Free Trial ($15 credits included) | Twilio Pay-As-You-Go ($0.0079 per SMS) |
| **Sleep / Cold Starts** | Kept awake with Cron-Job.org pinger | Always running natively |
| **Total Monthly Cost** | **$0.00 / month** | **~$15 - $25 / month** |

---

### 🎉 You Are Ready to Launch!
You can run the entire platform at **zero cost** indefinitely. When your user base scales to thousands of bookings per day, you can upgrade any component seamlessly without changing your application code!
