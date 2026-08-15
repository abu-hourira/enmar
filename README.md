# ENMAR (Harvest Market Bangladesh)

A dependency-free, full-stack JavaScript organic-food storefront and management system tailored for Bangladesh. Built entirely with vanilla JavaScript on both the frontend and backend using native Node.js core modules.

---

## Directory Structure

```
enma/
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules for logs, secrets, and data
├── database.sql              # MySQL 8+ relational schema
├── package.json              # Project configuration and npm scripts
├── README.md                 # Project documentation
├── server.js                 # Native Node.js HTTP server & REST/SSE API
│
├── index.html                # Storefront homepage & product catalog
├── product.html              # Product details & customer reviews
├── checkout.html             # BDT checkout (COD, bKash, Nagad)
├── my-orders.html            # Customer portal & order tracking
│
├── admin/                    # Administrative suite
│   ├── admin-charts.js       # HTML5 canvas analytics charts
│   ├── admin-core.js         # Shared auth, sidebar, and SSE alerts
│   ├── admin.css             # Admin panel styling
│   ├── ads.html              # Ad Maker banner tool
│   ├── analytics.html        # Sales analytics & revenue reports
│   ├── apis.html             # SMS & SMTP gateway connection settings
│   ├── customers.html        # Customer directory & access controls
│   ├── dashboard.html        # Main admin dashboard
│   ├── orders.html           # Order processing & delivery status
│   ├── products.html         # Product catalog management & image uploads
│   ├── reviews.html          # Review moderation
│   ├── settings.html         # Store settings, branding & page content
│   ├── staff.html            # Staff account provisioning (superadmin)
│   └── subscribers.html      # Newsletter subscriber management
│
├── css/
│   └── harvest-market.css    # Core storefront design system & theme
│
├── js/
│   ├── app.js                # Customer account, auth modal, & cart state
│   ├── branding.js           # Dynamic store logo & name synchronization
│   ├── devtools-guard.js     # DevTools & inspection protection
│   ├── harvest-market.js     # Catalog rendering, filters & cart drawer
│   ├── product.js            # Product detail view & review submission
│   └── theme.js              # Dynamic CSS color theme applicator
│
├── data/
│   ├── .gitkeep              # Directory placeholder
│   └── store.json            # Local JSON database (auto-generated)
│
└── uploads/                  # User & product uploaded media
    └── .gitkeep              # Directory placeholder
```

---

## Quick Start

### Requirements
- **Node.js 20 or newer** (No `npm install` needed).

### Run Locally
```powershell
# Start server
npm start

# Or with hot-reload (Node.js 20+)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Key Features

- **Storefront & Catalog**: Category filters, real-time cart drawer, promo banner slider.
- **Localized Checkout**: Bangladesh Taka (`৳`), flat shipping (৳80) with free delivery threshold (৳1,500), COD, bKash, and Nagad.
- **SMS OTP Verification**: 6-digit phone verification via Alpha SMS / SMS.NET.BD during registration.
- **Native SMTP Email**: RFC-compliant zero-dependency email notifications (welcome emails, order confirmations).
- **Admin Dashboard**: Real-time Server-Sent Events (SSE) order alerts with Web Audio sound effects, status updates, analytics, product image uploads, and staff management.
- **Security**: Salted `crypto.scrypt` password hashes with `crypto.timingSafeEqual`, HTTP-only session cookies, rate-limiting, and security headers.

---

## Admin Demo Account

- **Email**: `admin@example.com`
- **Password**: (Configured via `SUPERADMIN_PASSWORD` in `.env`)
