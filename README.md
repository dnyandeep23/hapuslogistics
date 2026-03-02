# Hapus Logistics

Hapus Logistics is a full-stack logistics booking and operations platform built on Next.js.  
It supports multi-role workflows for customers, operators, admins, and super admins, including package booking, route-based bus assignment, order tracking, operator coordination, coupon/banner management, and payment handling.

## Highlights

- Multi-step package booking with pickup/drop route validation
- Dynamic pricing with coupon support
- Razorpay-based payment flow for booking and order adjustments
- Admin manual booking flow (book on behalf of customer by email)
- Order tracking with OTP verification and tracking ID normalization (`HAP-XXXXXXXX`)
- Role-based dashboards (`user`, `operator`, `admin`, `superadmin`)
- Operator/company workflow (invites, approvals, company requests/offers)
- Bus transfer for orders (same route + capacity checks)
- Banner and coupon management for super admin
- Cloudinary image upload support for packages, buses, proofs, and banners

## Tech Stack

- Framework: Next.js 16 (App Router)
- Language: TypeScript, React 19
- State: Redux Toolkit + React Redux
- Database: MongoDB + Mongoose
- Payments: Razorpay
- Media: Cloudinary
- Email: Nodemailer (SMTP)
- Maps and routing:
  - OpenStreetMap Nominatim (geocode/reverse geocode)
  - OpenRouteService (road route and distance/duration)
- UI:
  - Tailwind CSS v4
  - Iconify
  - Recharts
  - Leaflet / React-Leaflet

## Role Capabilities

| Role | Key Capabilities |
| --- | --- |
| `user` | Book package, view/track own orders, OTP-based tracking, download invoice |
| `operator` | View assigned/active orders, update order status (`in-transit`, `delivered`), upload pickup/drop proof |
| `admin` | Manage buses/locations/operators, view all company orders, edit orders, transfer orders, cancel/update notes |
| `superadmin` | All admin-level controls plus global coupons, banners, and user management (with auth-provider-aware edit rules) |

## Business Rules Implemented

- Tracking input auto-normalizes `HAP` prefix and inserts hyphen automatically in UI.
- Admin and super admin can update order details until **1 hour before bus start time**.
- Customer can edit sender/receiver contact details until **3 hours before bus start time**.
- Order transfer is available (admin/superadmin) only within allowed time window and only when:
  - target bus supports the route
  - target bus has enough capacity
- Order amount changes after admin edits are tracked as:
  - `pending_payment` (extra amount to collect)
  - `pending_refund` (refund to process)
  - `settled`

## Annotated Project Structure

```text
src/
  app/
    api/                          # Backend API route handlers (auth, orders, buses, locations, etc.)
      admin/                      # Admin-only APIs (bus/operator management)
      auth/                       # Login/register/logout, OTP, Google auth, profile
      dashboard/                  # Dashboard APIs (orders, coupons, banners)
      orders/                     # Booking session, payment callback, order CRUD/update/transfer
      operator/                   # Operator-specific APIs (active order, proof uploads, company flow)
      superadmin/                 # Super admin APIs (global user management)
    dashboard/                    # Role-aware dashboard pages
    package/                      # Multi-step package booking UI
    Home/                         # Landing page sections
  components/                     # Reusable UI components (sidebar, tracking widget, custom pickers, etc.)
  context/                        # React context providers (toast)
  data/                           # Static data and role menus
  lib/                            # Shared utilities (invoice generation, redux, auth errors)
  services/                       # Frontend service wrappers for API calls
  types/                          # Shared TypeScript types
  proxy.ts                        # Route guarding and token checks (public/protected redirects)
```

## Key API Areas

- Auth and profile: `/api/auth/*`
- Booking and payment:
  - `/api/pricing`
  - `/api/orders/session`
  - `/api/orders/payment-callback`
  - `/api/orders/admin-confirm`
  - `/api/orders/[orderId]/adjustment-payment`
- Orders and tracking:
  - `/api/orders/[orderId]`
  - `/api/orders/track/me`
  - `/api/orders/track/request-code`
  - `/api/orders/track/verify-code`
  - `/api/recent-orders`
- Bus and operator management:
  - `/api/admin/buses`
  - `/api/admin/operators`
  - `/api/operator/*`
- Super admin management:
  - `/api/dashboard/coupons`
  - `/api/dashboard/banners`
  - `/api/superadmin/users`
- Maps/location:
  - `/api/locations/*`
  - `/api/locations/road-route`

## Environment Variables

Create a `.env.local` file at project root.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | JWT signing/verification for auth cookies/tokens |
| `DOMAIN` | Yes | Base URL used in email links (verification/reset) |
| `EMAIL_HOST` | Yes | SMTP host |
| `EMAIL_PORT` | Yes | SMTP port |
| `EMAIL_USER` | Yes | SMTP username |
| `EMAIL_PASS` | Yes | SMTP password/app password |
| `RAZORPAY_KEY_ID` | Yes | Server-side Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Yes | Server-side Razorpay key secret |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Yes | Client-side Razorpay key ID |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth login |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth login |
| `GOOGLE_OAUTH_REDIRECT_URI` | Optional | OAuth callback URL |
| `OPENROUTESERVICE_API_KEY` | Optional | Route preview distance/duration API |
| `CLOUDINARY_CLOUD_NAME` | Yes (for uploads) | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes (for uploads) | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes (for uploads) | Cloudinary API secret |
| `CLOUDINARY_UPLOAD_FOLDER` | Optional | Base folder prefix in Cloudinary |
| `NODE_ENV` | Optional | Runtime environment (`development`/`production`) |

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
# create/update .env.local with the variables listed above
```

### 3. Run development server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

Note: There is no dedicated `test` script configured in `package.json` at the moment.

## Authentication and Access Notes

- JWT token is stored in cookie `token`.
- Route guard logic is implemented in `src/proxy.ts`.
- Admin login supports OTP verification flow.
- Super admin user edit behavior is provider-aware:
  - Google-only users: name and phone editable, email locked
  - Local-auth users: full editable fields (including email and role)

## Operational Notes

- Booking session model uses TTL (`expiresAt`) to auto-expire stale holds.
- Order tracking OTP codes are stored hashed with TTL expiration.
- Image uploads are validated for type and size (8 MB max) before Cloudinary upload.
- Dashboard and order APIs return guarded errors and role-scoped data.

## Troubleshooting

- If DB is not connecting:
  - verify `DATABASE_URL`
  - check MongoDB network access and credentials
- If payments fail:
  - verify `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- If image uploads fail:
  - verify Cloudinary env variables and upload folder permissions
- If tracking OTP emails are not delivered:
  - verify SMTP env vars and sender account restrictions

## Deployment Checklist

- Set all required environment variables in target environment
- Run `npm run build` and resolve all build/lint issues
- Ensure MongoDB, SMTP, Razorpay, and Cloudinary credentials are production-ready
- Verify callback URLs for Google OAuth and Razorpay webhook/payment callback flows
