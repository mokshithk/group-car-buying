# Group Car Buying Platform - Architecture & Codebase Overview

> Graphify Architectural Summary & System Topology

The **Group Car Buying Platform** connects prospective car buyers in the same district seeking the exact same vehicle variant into aggregated purchasing groups. Licensed dealerships compete to provide transparent on-road quotations. Buyers can signal non-binding interest or lock in their price via simulated booking.

---

## 1. High-Level System Architecture

```mermaid
graph TD
    Client["Vite + React + Tailwind Frontend"]
    Router["React Router v6"]
    AuthContext["Auth Context & Role Guards"]
    
    subgraph Frontend Pages
        Public["Public Pages\n(Home, CarDetail, Login, Register)"]
        Buyer["Buyer Module\n(Dashboard, Find Groups, Offers, Booking, Privacy)"]
        Dealer["Dealer Module\n(Dashboard, Eligible Groups, Submit Quote, Leads, Bookings)"]
    end

    subgraph Service Layer
        GroupSvc["Group Service\n(Visibility, Joining, Milestones)"]
        QuoteSvc["Quote Service\n(Price History, Incomplete Isolation)"]
        BookingSvc["Booking Service\n(Price Lock, Auto-Removal, Cancellation Math)"]
        PaymentSvc["Simulated Payment Service\n(createPayment, verifyPayment, refundPayment)"]
    end

    subgraph Supabase Backend
        Auth["Supabase Auth / Session"]
        Postgres["PostgreSQL Database"]
        RLS["Row-Level Security Policies"]
        Triggers["Triggers & Functions\n(Visibility View, Price Versioning, Auto-Removal)"]
    end

    Client --> Router
    Router --> AuthContext
    AuthContext --> Public
    AuthContext --> Buyer
    AuthContext --> Dealer
    
    Buyer --> GroupSvc
    Buyer --> QuoteSvc
    Buyer --> BookingSvc
    BookingSvc --> PaymentSvc
    
    Dealer --> GroupSvc
    Dealer --> QuoteSvc
    Dealer --> BookingSvc
    
    GroupSvc --> Postgres
    QuoteSvc --> Postgres
    BookingSvc --> Postgres
    Postgres --- RLS
    Postgres --- Triggers
```

---

## 2. Directory Structure & Modular Breakdown

```
D:\group-car-buying
├── docs/
│   ├── architecture.md           # This document (Graphify overview)
│   ├── progress.md               # Task checklist & verification state
│   └── screenshots/              # Responsive Playwright verification captures
│       ├── 360px-landing.png     # Mobile viewport
│       ├── 768px-landing.png     # Tablet viewport
│       ├── 1440px-landing.png    # Desktop viewport
│       ├── 1440px-car-detail.png
│       ├── 1440px-buyer-dashboard.png
│       ├── 1440px-offers-comparison.png
│       ├── 1440px-interested-flow.png
│       ├── 1440px-booking-confirmed.png
│       └── 1440px-dealer-dashboard.png
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx        # Responsive public header
│   │   │   ├── Footer.tsx        # Standard footer & disclaimers
│   │   │   ├── BuyerLayout.tsx   # Buyer shell with sidebar navigation
│   │   │   └── DealerLayout.tsx  # Dealer shell with showroom navigation
│   │   └── ui/                   # Reusable atomic UI components
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Badge.tsx
│   │       ├── Modal.tsx
│   │       ├── Select.tsx
│   │       ├── Tabs.tsx
│   │       ├── Toast.tsx
│   │       └── Skeleton.tsx
│   ├── context/
│   │   └── AuthContext.tsx       # Auth provider, role switching, mock & Supabase state
│   ├── data/
│   │   └── catalogData.ts        # Comprehensive car specifications & variants data
│   ├── lib/
│   │   ├── bookingService.ts     # Booking workflows, cancellation calculations
│   │   ├── formatters.ts         # Currency (INR) and date/time formatters
│   │   ├── groupService.ts       # Group matching and visibility queries
│   │   ├── paymentService.ts     # Exactly 3 simulated functions: create, verify, refund
│   │   ├── quoteService.ts       # Quotation rankings, incomplete quote isolation
│   │   └── supabase.ts           # Supabase client instantiation
│   ├── pages/
│   │   ├── auth/                 # Login, Buyer & Dealer Registration, Pending Screen
│   │   ├── buyer/                # Dashboard, Find Groups, Group Detail, Offers, Bookings
│   │   ├── dealer/               # Dashboard, Eligible Groups, Submit Quote, Leads, Bookings
│   │   └── public/               # Landing Page, Car Detail Page
│   ├── types/
│   │   └── database.ts           # TypeScript interfaces matching database schema
│   ├── App.tsx                   # Main route configuration
│   └── main.tsx                  # React entry point
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql # Tables, triggers, visibility functions, views
│   │   └── 002_rls_policies.sql   # Comprehensive row level security policies
│   ├── seed.sql                  # Realistic demo data (cars, groups, quotes, dealerships)
│   └── RUN_ME_FIRST.md           # Migration instructions & dealer approval SQL snippet
├── tests/
│   └── e2e.spec.ts               # End-to-end test suite
└── playwright.config.ts          # Playwright configuration (cached on D: drive)
```

---

## 3. Core Business Rules & Database Logic

### 3.1 Group Visibility Rule
A group becomes visible to licensed dealerships only when:
1. It has **3 or more active members**, OR
2. It has **exactly 2 members and 20 days have elapsed** since group creation.
Groups with 1 member are **never** visible to dealers.

- **PostgreSQL Implementation**: `fn_is_group_visible_to_dealers(p_group_id UUID)`
- **Exposed View**: `dealer_eligible_groups_view` filtering by dealership district and brand authorization.

### 3.2 Quotation Integrity & Incomplete Quote Isolation
Quotations require itemization:
- Ex-showroom price
- Insurance premium
- Registration & road safety taxes
- Accessories & optional extras
- Discounts & concessions
- Total on-road price (auto-calculated)

**Rule**: Any quotation missing mandatory components (e.g. insurance = 0 or registration = 0) is flagged with `is_complete = false` and strictly **excluded** from "Lowest Price" badges, price sorting, and savings calculations. Savings are only computed against other complete quotes or official ex-showroom benchmarks.

### 3.3 Price Versioning
Every modification of a quotation by a dealership triggers `trg_log_quote_price_history`, preserving an immutable audit log (`quotation_price_history`) containing previous amounts, updated amounts, and timestamp.

### 3.4 Price Lock & Simulated Payment
When a buyer proceeds with "Book Now":
- Booking Deposit: ₹5,000 (payable to Showroom account)
- Platform Convenience Fee: ₹100 (payable to Platform)
- Total: ₹5,100 (always configured below ₹10,000 threshold)
- Payment Layer: Simulated via `createPayment`, `verifyPayment`, and `refundPayment`.
- Upon successful payment (`PAID`), a database trigger (`trg_on_booking_paid`) automatically updates the member's group status to `BOOKED` and removes them from the active bidding group. The locked on-road price is frozen in an immutable snapshot.

### 3.5 Cancellation & Refund Calculations
- **Buyer Cancellation**: Showroom retains 5% of booking deposit (₹250). Remaining deposit (₹4,750) is refunded to buyer. Platform fee (₹100) is non-refundable. Total refunded = ₹4,750.
- **Dealer Fault / Inability to Supply**: Showroom refund = 100% (₹5,000) + Platform fee refund = 100% (₹100). Total refunded = ₹5,100.
