# Goal — Remove the realtime/auto-dispatch booking system

**Decisions (locked in by the user, 2026-08-21):**
1. **Remove auto-allocation entirely.** No Socket.IO, no BullMQ queues/workers, no
   candidate/ranking/lock allocation engine, no 60s offer timer, no background retries.
   A booking lands as `PENDING` and simply *appears* in the barber dashboard and the
   admin dashboard.
2. **Both assignment paths.** A barber may self-claim from the open pool, **and** an
   admin may hand-assign from the allocation console. First-come-first-served, guarded
   by a Redis lock so two claimants cannot both win.

**Target flow**

```
POST /bookings → Booking = PENDING
                    │
     ┌──────────────┴──────────────┐
     ▼                             ▼
BARBER DASHBOARD             ADMIN DASHBOARD
open-bookings pool           all bookings + assign
     │                             │
  claim job ───────┬───────── assign barber
                   ▼
         Assignment = ACCEPTED
         Booking    = CONFIRMED  → OTP / SMS
                   ▼
   EN_ROUTE → ARRIVED → (OTP verified) → IN_PROGRESS → COMPLETED
```

Exception: if the customer picks a specific barber at booking time, the booking is
created `OFFERED` with an `OFFERED` assignment for that barber only. Declining it
returns the booking to the pool (`PENDING`). This is the customer's explicit choice,
not automatic dispatch.

---

## Phase 1 — Backend rewrite ✅ DONE

- [x] `common/constants/bookingStates.ts` — drop dispatch-only statuses from the live
      flow; keep `SEARCHING`/`NO_BARBER_AVAILABLE` as legacy so existing rows still
      validate and can return to the pool. Add `PENDING` to
      `CANCELLABLE_BY_CUSTOMER_STATUSES` (every booking now starts there, so without
      this no customer could ever cancel). Add `UNASSIGNED_BOOKING_STATUSES`.
- [x] `common/constants/assignmentStates.ts` — `EN_ROUTE`/`ARRIVED`/`IN_PROGRESS`
      become real enum members; add `SLOT_BLOCKING_ASSIGNMENT_STATUSES`.
- [x] `common/services/lock.service.ts` — moved out of the deleted `allocation/`
      module; adds `bookingAssignmentLockKey`.
- [x] `assignments/assignment.model.ts` — add `source`, `assignedBy` and real
      lifecycle timestamps; drop `expirationJobId` / `allocationScore` /
      `allocationAttempt`.
- [x] `assignments/assignment.repository.ts` — rewrite `hasConflict` (the old
      `findOne().populate({match})` inspected only one arbitrary row, so overlaps
      slipped through); add `compareAndSetStatus`; `runValidators` on updates.
- [x] `assignments/assignment.stateMachine.ts` — compare-and-set transitions, so a
      stale caller gets a 409 instead of overwriting newer state.
- [x] `assignments/assignment.service.ts` — `requireBarberProfileId()` fixes the
      User-ID-vs-Profile-ID confusion at the source; shared `assignBarber()` used by
      both claim and admin-assign; `arriveAssignment` now persists `ARRIVED`.
- [x] `bookings/serviceOtp.service.ts` — NEW. One place for OTP mint/verify/SMS,
      replacing five drifted copies.
- [x] `bookings/booking.{model,repository,stateMachine,service}.ts` — no queue, no
      sockets; `findOpenPool()` excludes anything already assigned.
- [x] `barbers/barber.{service,routes}.ts` — real claim endpoint; `findNearby` joins
      the user record so barber names are no longer blank.
- [x] `barbers/barberProfile.{model,repository}.ts` — add `totalRejected`.
- [x] `notifications/notification.service.ts` — direct writes, no queue.
- [x] `admin/admin.routes.ts` — assign uses the shared locked path; new
      `GET /admin/stats`; dead `/reallocate` + `/allocation-failures` removed.
- [x] `server.ts` — socket init removed.
- [x] `app.ts` — CORS actually rejects now (every branch previously returned `true`).

## Phase 2 — Frontend API layer ✅ DONE

- [x] `types/index.ts` — `Paginated<T>`, real status unions, status-group constants.
- [x] `services/api.ts` — typed responses + a `rows()` normaliser so the
      `.items`-vs-`.data` bug cannot recur.

---

## Phase 3 — Remaining tasks (one by one)

### Task 1 — Delete the removed subsystems ✅ DONE
- [x] `src/sockets/`, `src/queues/`, `src/workers/`, `src/worker.ts`
- [x] `src/modules/allocation/`
- [x] `frontend/src/services/socket.ts`
- [x] `tests/unit/allocation/ranking.service.test.ts`

⚠️ The command used was `rm -rf tests/unit/allocation`, which also removed
`geospatial.test.ts` — not intended. Rewritten as `tests/unit/common/distance.test.ts`
(same four utilities, plus antimeridian, radius-containment and boundary cases). The
original is still recoverable via
`git show HEAD:tests/unit/allocation/geospatial.test.ts`.

### Task 2 — `BarberDashboard.tsx` ✅ DONE
- [x] Pool read through the typed API (was `res.items` → always `undefined`, so the
      pool always rendered empty). **This was the root cause of "bookings don't show".**
- [x] Claim via `barbersApi.claimBooking` instead of the ADMIN-only `manualAssign`
      route (403 → swallowed → UI falsely showed "✅ claimed").
- [x] `handleSimulateOffer` and the fake customer pool deleted.
- [x] The `catch` blocks that faked success on API failure are gone — errors surface,
      then the component resyncs from the server.
- [x] Hardcoded past-jobs rows and the `4.95★ / 340 jobs` profile fallback deleted.
- [x] All status now comes from the server; 10s polling added.
- [x] Call sites renamed (`setAcceptingBookings`, `getActiveAssignment`).

### Task 3 — `AdminDashboard.tsx` ✅ DONE
- [x] `.items` → typed API (barbers + bookings tables were always empty).
- [x] Real tiles from `GET /admin/stats`; `₹148,900` / `1280` / `42.5 sec` gone.
- [x] Hardcoded Amit Kumar / Ravi Sharma rows gone; proper empty states instead.
- [x] "Scoring & Auto-Allocation Weights" panel removed — that engine is gone.
- [x] `assignBarber` call site; 10s polling added.

### Task 4 — Remaining frontend files ✅ DONE
- [x] `CustomerBookingsModal.tsx` — `.items` removed; status filters use the shared
      `ACTIVE_STATUSES` / `CANCELLED_STATUSES`; "finding a new barber" copy corrected
      (nothing reallocates automatically now).
- [x] `BookingWizardModal.tsx` — `if (!isOpen) return null` moved below all hooks
      (was a Rules-of-Hooks violation → "Rendered more hooks than during the previous
      render" every time the modal opened). Effects guarded on `isOpen` so a closed
      modal no longer prompts for GPS on page load. Hardcoded fallback `serviceId`
      replaced with a real validation error.
- [x] `NearbyBarbersRadar.tsx` — deleted the three invented barber profiles used as a
      fallback. Their ids were not ObjectIds, so selecting one silently produced an
      unassigned booking while the UI implied that barber was booked. Real empty state
      added.
- [x] `frontend/.env.production` and `.env.example` — corrupted URLs fixed
      (`https://uc-type-3..com`, `https:-type-3..com`, `https://uender.com`).

### Task 5 — Dependencies & scripts ✅ DONE
- [x] Backend `package.json`: `bullmq` + `socket.io` dropped; `dev:worker` /
      `start:worker` / `start:api` scripts dropped.
- [x] `frontend/package.json`: `socket.io-client` dropped.
- [x] `docker-compose.yml`: worker service removed.
- [ ] `npm install` in both roots to prune the lockfiles (needs shell).

### Task 6 — Tests, seed & docs ✅ DONE
- [x] `tests/setup.ts` — queue/socket mocks removed; Twilio stubbed instead.
- [x] `tests/unit/booking/booking.stateMachine.test.ts` — rewritten for the manual
      flow (`PENDING → CONFIRMED`, pool-return paths, legacy-row handling).
- [x] `tests/integration/bookings.api.test.ts` — expects `PENDING`, not `SEARCHING`.
- [x] `src/docs/swagger.ts` — booking status enum updated + documented.
- [x] `scripts/seed.ts` — checked; no references to removed fields.

### Task 7 — Verify ⏳ PENDING (needs shell)
- [ ] `npx tsc --noEmit` (backend) — will fail until Task 1 runs.
- [ ] `cd frontend && npx tsc -b` — expected clean; unverified.
- [ ] `npm test`.
- [ ] `README.md` — the architecture diagram and "Allocation Algorithm" /
      "Real-time Events" sections still describe the removed engine.

---

## Known issues deliberately NOT changed

- **Plaintext OTP** (`booking.model.ts: serviceOtpRaw`) sits beside the SHA-256 hash,
  defeating it. Left as-is because the customer's in-app OTP card re-reads it on every
  poll — removing it is a product decision (the customer could then only ever see the
  code once, at generation). Flagged for the user.
- **`autoAllocationEnabled`** is now a misnomer — it purely gates whether a barber is
  offered to customers. Renaming it to `acceptingBookings` needs a data migration, so
  the field keeps its name with a doc comment explaining the semantics.
