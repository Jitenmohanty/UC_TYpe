# 🪒 Salon Booking Backend

Production-ready REST API backend for a salon/barber booking and automatic barber allocation platform — built with Node.js, TypeScript, Express, MongoDB, Redis, BullMQ, and Socket.IO.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────┐
│              Load Balancer                  │
└──────────────────┬──────────────────────────┘
                   │
     ┌─────────────▼──────────────┐
     │    API Process (Express)   │◄── JWT Auth, Validation
     │    + Socket.IO Server      │◄── Rate Limiting, Idempotency
     └─────────┬──────────────────┘
               │ BullMQ Jobs
     ┌─────────▼──────────────────┐
     │   Worker Process (BullMQ)  │
     │  • AllocationWorker        │
     │  • ExpirationWorker        │
     │  • NotificationWorker      │
     └─────────┬──────────────────┘
               │
     ┌─────────▼──────────────────┐
     │ MongoDB + Redis             │
     │ • Mongoose Models           │
     │ • 2dsphere geo indexes      │
     │ • Redis distributed locks  │
     └────────────────────────────┘
```

### Key Design Decisions

| Concern | Solution |
|---|---|
| Booking ≠ Assignment | Separate entities — full assignment history kept |
| Race conditions | Redis distributed locks + MongoDB transactions |
| Geo search | MongoDB `$geoNear` — not Node.js math |
| Duplicate prevention | Idempotency-Key header + Redis cache |
| State management | Centralized state machines with transition validation |
| Async allocation | BullMQ — API returns immediately, worker allocates |
| Real-time | Socket.IO with per-user room mapping |

---

## 📁 Project Structure

```
src/
├── app.ts              # Express app factory
├── server.ts           # API server entry point
├── worker.ts           # BullMQ worker entry point
├── config/             # Env, database, redis
├── common/             # Errors, middleware, utils, constants, types
├── modules/
│   ├── auth/           # JWT auth (register/login/refresh/logout)
│   ├── users/          # User model + repository
│   ├── customers/      # Customer profile management
│   ├── barbers/        # Barber profile, location, nearby search
│   ├── barberServices/ # Barber ↔ Service relationships
│   ├── services/       # Service catalog
│   ├── availability/   # Working hours + slot conflict detection
│   ├── bookings/       # Booking lifecycle + state machine
│   ├── assignments/    # Assignment lifecycle + state machine
│   ├── allocation/     # Candidate filter, ranking, lock service
│   ├── notifications/  # Notification abstraction
│   ├── reviews/        # Customer reviews
│   └── admin/          # Admin management APIs
├── queues/             # BullMQ queue definitions
├── workers/            # BullMQ worker implementations
├── sockets/            # Socket.IO server + events
├── audit/              # Audit log model + service
└── docs/               # Swagger setup

scripts/
└── seed.ts             # Database seeding

tests/
├── setup.ts            # Test setup (in-memory MongoDB, mocks)
└── unit/               # Unit tests
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- MongoDB 7+
- Redis 7+

### Local Setup

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, Redis URL, JWT secrets

# 3. Seed database
npm run seed

# 4. Start API server (development)
npm run dev

# 5. Start Worker process (separate terminal)
npm run dev:worker
```

### Docker Setup

```bash
# Start all services
docker-compose up --build

# Or in detached mode
docker-compose up -d

# Check logs
docker-compose logs -f api
docker-compose logs -f worker
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | required |
| `REDIS_URL` | Redis connection string | required |
| `JWT_ACCESS_SECRET` | JWT signing secret (min 32 chars) | required |
| `JWT_REFRESH_SECRET` | Refresh token secret (min 32 chars) | required |
| `DEFAULT_ALLOCATION_RADIUS_KM` | Barber search radius | `5` |
| `LOCATION_MAX_AGE_MINUTES` | Max barber location age | `30` |
| `ASSIGNMENT_OFFER_TIMEOUT_SECONDS` | Offer TTL before expiry | `60` |
| `MAX_ALLOCATION_ATTEMPTS` | Max retries before NO_BARBER_AVAILABLE | `3` |

---

## 📡 API Documentation

Swagger UI is available at:
```
GET /api/v1/docs        (development only)
GET /api/v1/docs.json   (raw OpenAPI spec)
```

### Key Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | — | Register customer or barber |
| `POST` | `/api/v1/auth/login` | — | Login |
| `POST` | `/api/v1/auth/refresh` | — | Refresh access token |
| `GET` | `/api/v1/barbers/nearby` | — | Find nearby available barbers |
| `POST` | `/api/v1/bookings` | CUSTOMER | Create booking |
| `GET` | `/api/v1/bookings/:id` | AUTH | Get booking details |
| `POST` | `/api/v1/bookings/:id/cancel` | CUSTOMER | Cancel booking |
| `POST` | `/api/v1/assignments/:id/accept` | BARBER | Accept offer |
| `POST` | `/api/v1/assignments/:id/reject` | BARBER | Reject offer |
| `POST` | `/api/v1/assignments/:id/cancel` | BARBER | Cancel accepted job |
| `POST` | `/api/v1/assignments/:id/start` | BARBER | Start service |
| `POST` | `/api/v1/assignments/:id/complete` | BARBER | Complete service |
| `POST` | `/api/v1/reviews` | CUSTOMER | Submit review |
| `POST` | `/api/v1/admin/bookings/:id/assign` | ADMIN | Manual barber assignment |

---

## 🔄 Booking Lifecycle

```
Customer creates booking
    ↓
Booking: PENDING → SEARCHING
    ↓ (BullMQ job enqueued)
AllocationWorker runs
    ↓
Eligibility filters (8 criteria)
    ↓
Ranking algorithm
    ↓
Assignment created: OFFERED
Booking: SEARCHING → OFFERED
    ↓ (60s expiration job queued)
Barber accepts
    ↓
Assignment: OFFERED → ACCEPTED
Booking: OFFERED → CONFIRMED
    ↓
Barber starts service
    ↓
Booking: CONFIRMED → IN_PROGRESS
    ↓
Barber completes
    ↓
Assignment: ACCEPTED → COMPLETED
Booking: IN_PROGRESS → COMPLETED
    ↓
Customer reviews
```

---

## 🎯 Allocation Algorithm

### Eligibility Filters (all must pass)
1. Barber status = `ACTIVE`
2. `autoAllocationEnabled = true`
3. Has valid location with `locationUpdatedAt`
4. Location updated within `LOCATION_MAX_AGE_MINUTES`
5. Within `radiusKm` of customer (MongoDB `$geoNear`)
6. Offers requested service (`BarberService` record)
7. Working at requested date/time (working hours check)
8. No conflicting booking (slot conflict check)
9. Not in `booking.excludedBarbers`

### Ranking Formula

```
score = distanceScore    × 0.40
      + availabilityScore × 0.20
      + ratingScore       × 0.15
      + acceptanceRate    × 0.10
      + completionRate    × 0.10
      + workloadScore     × 0.05
```

All weights are configurable via environment variables.

---

## 🔒 Race Condition Protection

| Scenario | Solution |
|---|---|
| Two workers allocating same barber | Redis lock: `lock:allocation:booking:{id}` |
| Two bookings grabbing same slot | Redis slot lock: `lock:barber:{id}:slot:{date}:{time}` |
| Duplicate assignment creation | MongoDB session transaction + active assignment check |
| Network retry creating duplicate booking | `Idempotency-Key` header + Redis cache (24h) |

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Coverage
- `BookingStateMachine` — all valid/invalid transitions
- `RankingService` — scoring algorithm, candidate selection
- `TimeUtils` — slot overlap, location freshness, working hours
- `Distance utilities` — Haversine formula, GeoJSON coordinate order, radius boundary cases

---

## 🌱 Seed Data

```bash
npm run seed
```

Creates a realistic scenario in **Bhubaneswar, India**:

| Actor | Distance | Rating | Auto-Alloc |
|---|---|---|---|
| Barber A (Amit Kumar) | 1.2 KM | 4.4 | ✅ |
| Barber B (Ravi Sharma) | 2.7 KM | 4.9 | ✅ |
| Barber C (Suresh Panda) | 4.3 KM | 4.7 | ✅ |
| Barber D (Deepak Nayak) | 7.5 KM | 5.0 | ❌ (outside radius) |

A 5km booking returns A, B, C — not D.

**Credentials:**
- Admin: `admin@salonbooking.com` / `Admin@123`
- Customer: `priya@example.com` / `Customer@123`
- Barbers: `amit.kumar@salonbooking.com` / `Barber@123`

---

## 🔌 Real-time Events (Socket.IO)

Connect with JWT access token:
```js
const socket = io('http://localhost:3000', {
  auth: { token: 'your-access-token' }
});
```

| Event | Recipient | Payload |
|---|---|---|
| `booking:created` | Customer | `{ bookingId, status }` |
| `booking:searching` | Customer | `{ bookingId, status }` |
| `booking:assigned` | Customer | `{ bookingId, status }` |
| `booking:confirmed` | Customer | `{ bookingId, barberId }` |
| `booking:cancelled` | Customer | `{ bookingId, reason }` |
| `booking:completed` | Customer | `{ bookingId }` |
| `assignment:new` | Barber | `{ assignmentId, service, scheduledDate }` |
| `assignment:expired` | Barber | `{ assignmentId, bookingId }` |

---

## 🐳 Production Deployment

```bash
# Build
docker-compose -f docker-compose.yml up --build -d

# Scale workers independently
docker-compose up --scale worker=3 -d

# View logs
docker-compose logs -f

# Health check
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/ready
```

### Production Checklist
- [ ] Set strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (32+ chars)
- [ ] Set `NODE_ENV=production`
- [ ] Configure MongoDB with authentication
- [ ] Configure Redis with authentication
- [ ] Set up SSL/TLS termination at load balancer
- [ ] Configure `CORS_ORIGIN` to your frontend domain
- [ ] Set up MongoDB indexes (auto-created on first run)
- [ ] Configure log aggregation (Pino outputs JSON)
- [ ] Set up monitoring for `/api/v1/health` and `/api/v1/ready`

---

## 🔐 Security Features

- Helmet.js — HTTP security headers
- CORS — configurable origin whitelist
- JWT — short-lived access tokens (15m) + refresh token rotation
- bcrypt — password hashing (12 rounds)
- Rate limiting — Redis-backed per-user/IP
- Idempotency — prevents duplicate mutations
- Input validation — Zod on all endpoints
- Error sanitization — no stack traces in production
- Audit logs — all significant actions recorded
- Sensitive field filtering — passwordHash never returned

---

## 📊 Monitoring Endpoints

```
GET /api/v1/health   → { status: 'ok', timestamp }
GET /api/v1/ready    → { database, redis, timestamp }
```
