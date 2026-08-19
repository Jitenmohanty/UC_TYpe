# 🚀 Production Deployment & Environment Setup Guide

This guide outlines the exact environment variables, secrets generation, build steps, and production infrastructure checklist for deploying **AURA STUDIO** to production (AWS, Render, Railway, DigitalOcean, Vercel, VPS).

---

## 📑 Table of Contents
1. [Backend Production `.env` Specification](#1-backend-production-env-specification)
2. [Frontend Production `.env.production` Specification](#2-frontend-production-envproduction-specification)
3. [Generating Cryptographic Production Secrets](#3-generating-cryptographic-production-secrets)
4. [Production Services & Third-Party Requirements](#4-production-services--third-party-requirements)
5. [Build & Process Management Steps](#5-build--process-management-steps)
6. [Nginx Reverse Proxy & SSL Configuration](#6-nginx-reverse-proxy--ssl-configuration)

---

## 1. Backend Production `.env` Specification

Create a `.env` file on your production backend server with the following configuration:

```ini
# ==============================================================================
# 🌐 ENVIRONMENT & SERVER
# ==============================================================================
NODE_ENV=production
PORT=5000
API_PREFIX=/api/v1

# ==============================================================================
# 🗄️ DATABASE (MongoDB Atlas Production Cluster)
# ==============================================================================
# Ensure IP Access List on Atlas allows your production server IP
MONGODB_URI=mongodb+srv://<PROD_USER>:<PROD_PASSWORD>@<CLUSTER>.mongodb.net/salon_booking?retryWrites=true&w=majority&appName=AuraStudioProd

# ==============================================================================
# ⚡ CACHE & PUBSUB (Redis Cloud / Upstash / AWS ElastiCache)
# ==============================================================================
REDIS_URL=redis://default:<REDIS_PASSWORD>@<REDIS_HOST>:<REDIS_PORT>

# ==============================================================================
# 🔐 JWT TOKENS & SECURITY SECRETS (Generate with crypto randomBytes)
# ==============================================================================
JWT_ACCESS_SECRET=e7b4a2c1f90847289d0c2e98341b5a6c7f890123456789abcdef0123456789ab
JWT_REFRESH_SECRET=a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ==============================================================================
# 🛡️ CORS & LOGGING
# ==============================================================================
# Comma-separated list of allowed production frontend domains (HTTPS ONLY)
CORS_ORIGIN=https://aurastudio.com,https://app.aurastudio.com,https://admin.aurastudio.com
LOG_LEVEL=info

# ==============================================================================
# 📱 TWILIO SMS LIVE CREDENTIALS
# ==============================================================================
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_live_twilio_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_MESSAGING_SERVICE_SID=MGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# ==============================================================================
# ⏱️ RATE LIMITING SETTINGS
# ==============================================================================
RATE_LIMIT_LOGIN_PER_HOUR=100
RATE_LIMIT_BOOKING_PER_HOUR=20
RATE_LIMIT_LOCATION_UPDATE_PER_MINUTE=15

# ==============================================================================
# 🚗 DISPATCH & ALLOCATION ENGINE WEIGHTS
# ==============================================================================
DEFAULT_ALLOCATION_RADIUS_KM=15
LOCATION_MAX_AGE_MINUTES=30
ASSIGNMENT_OFFER_TIMEOUT_SECONDS=60
MAX_ALLOCATION_ATTEMPTS=3
ALLOCATION_RETRY_DELAYS_SECONDS=30,60,120

RANKING_WEIGHT_DISTANCE=0.40
RANKING_WEIGHT_AVAILABILITY=0.20
RANKING_WEIGHT_RATING=0.15
RANKING_WEIGHT_ACCEPTANCE_RATE=0.10
RANKING_WEIGHT_COMPLETION_RATE=0.10
RANKING_WEIGHT_WORKLOAD=0.05

CUSTOMER_CANCEL_FREE_MINUTES=30
MAX_BARBER_CANCELLATIONS_PER_MONTH=3
```

---

## 2. Frontend Production `.env.production` Specification

In your `frontend/` directory, create `.env.production`:

```ini
# Production API Base URL (HTTPS)
VITE_API_URL=https://api.aurastudio.com/api/v1

# Production Socket.IO Base URL (WSS)
VITE_SOCKET_URL=https://api.aurastudio.com
```

---

## 3. Generating Cryptographic Production Secrets

Never use default or shared keys in production. Run this command on your terminal to generate strong 64-character random secrets for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`:

```bash
# Generate Secret 1 (Access Token Secret):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate Secret 2 (Refresh Token Secret):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Production Services & Third-Party Requirements

1. **MongoDB Atlas (Database)**:
   - Use MongoDB 6.0+ cluster with automatic daily backups.
   - Whitelist your backend server's Elastic IP under **Network Access**.
   - Verify `2dsphere` indexes exist on `location` for geospatial queries.

2. **Redis Cloud / Upstash (Cache & Rate Limiter)**:
   - Provide a persistent Redis connection URL with TLS/SSL enabled.

3. **Twilio Account (SMS Delivery)**:
   - Upgrade from Trial to **Active/Paid account** to remove trial prefix and unlock SMS to unverified numbers.
   - In India/US/EU: Register your Brand / Campaign (A2P 10DLC or DLT approval in India for SMS compliance).

---

## 5. Build & Process Management Steps

### Backend Deployment (Node.js / PM2)
```bash
# 1. Install dependencies
npm ci --production=false

# 2. Compile TypeScript to JavaScript (/dist)
npm run build

# 3. Start with PM2 Process Manager (Cluster Mode)
pm2 start dist/server.js --name "aura-api" -i max

# 4. Save PM2 configuration to restart on server reboot
pm2 save
pm2 startup
```

### Frontend Deployment (Vercel / Netlify / Cloudflare / Nginx)
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm ci

# 3. Build optimized production bundle (/dist)
npm run build

# 4. Deploy 'frontend/dist/' to CDN (Vercel / S3 + CloudFront / Nginx)
```

---

## 6. Nginx Reverse Proxy & SSL Configuration (For VPS / EC2)

```nginx
server {
    listen 80;
    server_name api.aurastudio.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.aurastudio.com;

    ssl_certificate /etc/letsencrypt/live/api.aurastudio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.aurastudio.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket Support for Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```
