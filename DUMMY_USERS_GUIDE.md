# 👥 Dummy Users & End-to-End Testing Guide

This guide explains how seeded test accounts work, their credentials, role-based views, and step-by-step instructions for testing the entire booking and auto-allocation workflow.

---

## 🔑 Seeded Test Credentials

To populate your database with these accounts, run:
```bash
npm run seed
```

### 1. Root Administrator
| Role | Email | Password | Phone | Description |
| :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@salonbooking.com` | `Admin@123` | `+911234567890` | Accesses the **System Administrator Portal** with live network statistics, partner activation/deactivation, and manual assignment controls. |

---

### 2. Customer
| Role | Email | Password | Phone | Location |
| :--- | :--- | :--- | :--- | :--- |
| **CUSTOMER** | `priya@example.com` | `Customer@123` | `+919876543210` | Bhubaneswar Center (`20.2961, 85.8245`). Used for booking services and testing doorstep OTP verification. |

---

### 3. Partner Barbers
| Rank / Name | Email | Password | Phone | Distance to Center | Auto-Allocation | Rating |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **#1 Amit Kumar** | `amit.kumar@salonbooking.com` | `Barber@123` | `+919876543220` | ~1.2 km | `ENABLED` | 4.4 ★ |
| **#2 Ravi Sharma** | `ravi.sharma@salonbooking.com` | `Barber@123` | `+919876543221` | ~2.7 km | `ENABLED` | 4.9 ★ |
| **#3 Suresh Panda** | `suresh.panda@salonbooking.com` | `Barber@123` | `+919876543222` | ~4.3 km | `ENABLED` | 4.7 ★ |
| **#4 Deepak Nayak** | `deepak.nayak@salonbooking.com` | `Barber@123` | `+919876543223` | ~7.5 km *(Out of 5km radius)* | `DISABLED` | 5.0 ★ |

---

## 🔄 How Dummy User Sign-In & Role Redirection Works

```
                        ┌────────────────────────────────────────┐
                        │      User Logs in with Email/Password  │
                        └───────────────────┬────────────────────┘
                                            │
                                 Backend verifies bcrypt
                                 & returns JWT with role
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
           role === 'CUSTOMER'      role === 'BARBER'       role === 'ADMIN'
                    │                       │                       │
           Shows Customer App      Shows Barber Portal     Shows Admin Dashboard
           (Catalog, GPS Radar,    (Live job dispatch,     (Partner controls,
            Booking Wizard, OTP)    Accept/Reject, OTP)     Live platform metrics)
```

1. When you enter an email and password in the **Sign In** modal, the frontend sends a `POST /api/v1/auth/login` request.
2. The backend responds with the user's role (`CUSTOMER`, `BARBER`, or `ADMIN`) and an `accessToken`.
3. The frontend stores the token in `localStorage` and automatically renders the appropriate portal:
   - **Admin**: Redirects to `/admin` view with live statistics and partner toggles.
   - **Barber**: Redirects to the partner dashboard with GPS toggles and instant job dispatch timers.
   - **Customer**: Shows catalog, active booking status bar, and real-time OTP card.

---

## 🧪 Step-by-Step End-to-End Testing Walkthrough

### Scenario A: Booking and Auto-Allocation Flow
1. **Sign In as Customer**:
   - Log in with `priya@example.com` / `Customer@123`.
   - Click **Book Appointment** or choose **Haircut (₹300)**.
   - Select today/tomorrow's date and a future time slot.
   - Click **Detect Live GPS** (or keep detected coordinates) and click **Confirm Appointment**.
   - The booking will enter `SEARCHING` state.

2. **Sign In as Barber #1 in another browser/incognito window**:
   - Log in with `amit.kumar@salonbooking.com` / `Barber@123`.
   - You will see the incoming job offer with a **30-second countdown**.
   - Click **Accept Booking**.

3. **Doorstep Arrival & OTP Verification**:
   - As the barber, click **"I Have Arrived at Location"**.
   - The customer's screen immediately shows a **6-Digit Verification Code** (and Twilio SMS is dispatched).
   - Enter the 6 digits in the barber's portal and click **Verify OTP**.
   - The status updates to `IN_PROGRESS`.
   - Click **"Complete Service"** when finished.

---

### Scenario B: Testing Admin Controls
1. Log in with `admin@salonbooking.com` / `Admin@123`.
2. View total platform revenue, registered barbers, and active booking history.
3. Click the status button next to any barber to toggle between `ACTIVE` and `INACTIVE`.

---

## 📱 Testing Password Reset via OTP
1. On the login modal, click **"Forgot Password?"**.
2. Enter `priya@example.com` or `+919876543210`.
3. An OTP is dispatched (and printed to backend server console logs).
4. Enter the 6 digits, set your new password, and sign in.
