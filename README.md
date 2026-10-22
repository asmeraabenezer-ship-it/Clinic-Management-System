# 🏥 ClinicCare Pro - Complete Clinic Management System

A production-ready, full-stack Clinic Management System built with **Vanilla JavaScript, HTML5, CSS3, Node.js + Express.js**, and **Supabase (PostgreSQL, Auth, Storage, and Row-Level Security)**.

---

## 🚀 Key Features

### 1. 👥 Multi-Role Role-Based Access Control (RBAC)
- **Admin**: Full access to all clinical, financial, inventory, reports, and user administration features.
- **Doctor**: View assigned appointments, consult patients, write clinical consultation notes, prescribe medications, and order laboratory diagnostics.
- **Receptionist**: Patient registration, scheduling appointments, rescheduling, check-ins, generating invoices, and recording payments.
- **Nurse**: Patient triage, recording vital signs (blood pressure, temperature, heart rate, SpO2, BMI calculation), sample collection for lab tests.
- **Pharmacist**: Pharmacy dispensing queue, inventory stock tracking, restocking, batch & expiry monitoring.

### 2. 📋 Patient Directory & Comprehensive Profiles
- Register patients with demographics, emergency contacts, blood type, known allergies, and chronic medical history.
- Patient unique ID format (`PAT-YYYY-XXXXX`).
- Profile view with tabs: Overview, Consultation History, Vital Signs Timeline, and Uploaded Documents.

### 3. 👨‍⚕️ Doctor Management & Weekly Working Schedules
- Manage physician specializations, license numbers, consulting fees, and room numbers.
- Configure weekly working schedules per physician (customizable days, working hours, and appointment slot durations in minutes).

### 4. 📅 Smart Appointment Booking & Double-Booking Prevention
- Real-time availability checks preventing conflicts and double-booking.
- Status workflow: `scheduled` → `confirmed` → `in_progress` → `completed` (or `cancelled` / `no_show`).
- Rescheduling modal with automatic slot re-validation.
- Cancellation reasons logging.

### 5. 🩺 Medical Records & Clinical Consultations
- Record chief complaints/symptoms, physical examination findings, diagnoses, treatment plans, and doctor follow-up notes.
- Direct quick-actions to write prescriptions and order laboratory investigations.

### 6. ❤️ Vital Signs & Triage Monitoring
- Record systolic/diastolic blood pressure, temperature (°C), heart rate/pulse (bpm), respiratory rate, and oxygen saturation (SpO2 %).
- Automatic real-time Body Mass Index (BMI) calculator with health category classifications (Underweight, Normal, Overweight, Obese).
- Color-coded abnormal indicators for critical vitals.

### 7. 💊 E-Prescriptions & Pharmacy Dispensing
- Physician e-prescribing with dynamic medication rows (dosage, frequency, duration, quantity, special instructions).
- Integrated pharmacy queue: dispensing checks inventory and automatically deducts stock levels.
- Printable official **Rx Prescription Slip**.

### 8. 📦 Medicine Inventory & Expiry Alerts
- Pharmaceutical inventory catalog with categories, dosage forms, strength, unit prices, and batch tracking.
- Stock levels with threshold progress bars.
- Automatic alerts for **Low Stock** and **Medicines Expiring within 30 Days**.
- Fast restock modal to replenish stock quantities and log new batch expiration dates.

### 9. 🔬 Laboratory Diagnostics & Results Tracking
- Order lab tests with urgency prioritization: `routine`, `urgent`, `stat`.
- 4-Stage visual timeline: `Requested` → `Sample Collected` → `Processing` → `Completed`.
- Technologist results entry with reference ranges, units, abnormality flags, and remarks.

### 10. 📁 Secure Medical File Storage
- Upload and attach lab reports, X-rays, MRIs, and PDF medical histories directly to patient profiles.
- Securely backed by Supabase Storage with protected access policies.

### 11. 💳 Invoicing, Billing & Thermal Receipts
- Customizable billing statements with multiple line items, tax rate calculations, and discount deductions.
- Outstanding balance tracking (`unpaid`, `partial`, `paid`, `refunded`).
- Printable itemized **Clinic Invoices**.
- Payment transactions recording across multiple payment methods: Cash, Credit Card, Debit Card, Insurance, and Bank Transfer.
- Printable thermal-style **Payment Receipts**.

### 12. 🔔 Real-time Notifications & Operational Alerts
- Background notification polling for appointment updates, critical lab results, unpaid invoices, and inventory warnings.
- Unread badge counter in header with mark-as-read actions.

### 13. 📊 Analytics & Financial Reports
- Summary dashboard metrics: total revenue collections, appointment outcomes breakdown, new patient volume, and diagnostic counts.
- Customizable date range filtering.
- 6-month visual revenue trends.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Vanilla JavaScript (ES6+ Modules), HTML5 Semantic Shell, Vanilla CSS3 (Custom Design System with CSS Variables, Dark/Light palettes, Glassmorphism, Micro-animations) |
| **Icons & Fonts** | FontAwesome 6.4, Google Fonts (Inter) |
| **Backend** | Node.js, Express.js |
| **Database** | Supabase (PostgreSQL with RLS Policies & Triggers) |
| **Authentication** | Supabase Auth (JWT tokens verified via middleware) |
| **Storage** | Supabase Storage (`clinic-files` bucket) |
| **Security** | Helmet, CORS, Express-Rate-Limit, Express-Validator, Service Role isolation |

---

## 📂 Project Directory Structure

```
clinic.management/
├── backend/
│   ├── config/
│   │   └── supabase.js            # Supabase Admin & Client configuration
│   ├── middleware/
│   │   ├── auth.js                # JWT verification and RBAC authorization
│   │   └── validate.js            # Express-validator schemas
│   ├── routes/
│   │   ├── appointments.js        # Appointment booking & scheduling endpoints
│   │   ├── auth.js                # Login, logout, session, user management
│   │   ├── dashboard.js           # Live statistics & charts
│   │   ├── doctors.js             # Doctor profiles & availability slots
│   │   ├── files.js               # Supabase Storage medical file uploads
│   │   ├── invoices.js            # Invoicing & line-item calculations
│   │   ├── labTests.js            # Laboratory ordering & results
│   │   ├── medicalRecords.js      # Consultation notes & clinical history
│   │   ├── medicines.js           # Pharmacy inventory & restock
│   │   ├── notifications.js       # System notifications & alerts
│   │   ├── patients.js            # Patient directory & registrations
│   │   ├── payments.js            # Payments & receipt generation
│   │   ├── prescriptions.js       # E-prescribing & stock deduction
│   │   ├── reports.js             # Financial & clinical analytics
│   │   └── vitalSigns.js          # Triage & BMI tracking
│   ├── scripts/
│   │   └── seed.js                # Database seeder with sample accounts
│   └── server.js                  # Main Express entry point & static file server
├── database/
│   └── schema.sql                 # Complete PostgreSQL schema, RLS, indexes & sample data
├── frontend/
│   ├── css/
│   │   ├── components.css         # UI design system: buttons, cards, tables, badges
│   │   ├── main.css               # Core layout, sidebar, topbar, modal & toast styles
│   │   └── pages.css              # Page-specific views, charts, and print layouts
│   ├── js/
│   │   ├── api.js                 # Centralized API fetch client
│   │   ├── app.js                 # Application bootstrap & entry routing
│   │   ├── appointments.js        # Appointments controller & availability checks
│   │   ├── auth.js                # Session management & login handler
│   │   ├── dashboard.js           # Analytics dashboard controller
│   │   ├── doctors.js             # Doctors & working schedules
│   │   ├── invoices.js            # Billing & invoices controller
│   │   ├── labTests.js            # Diagnostics & sample tracking
│   │   ├── medicalRecords.js      # Consultations controller
│   │   ├── medicines.js           # Pharmacy inventory controller
│   │   ├── navigation.js          # Role-based sidebar navigation
│   │   ├── notifications.js       # Dropdown & polling notifications
│   │   ├── patients.js            # Patients directory & profile modals
│   │   ├── payments.js            # Payment receipts controller
│   │   ├── prescriptions.js       # Prescription controller & dispensing
│   │   ├── reports.js             # Reporting module
│   │   ├── utils.js               # Modals, toasts, formatters & printing
│   │   └── vitalSigns.js          # Vitals & BMI controller
│   └── index.html                 # Single page application shell
├── .env                           # Environment configuration
├── .env.example                   # Environment configuration template
└── package.json                   # Dependencies and scripts
```

---

## ⚡ Quick Start Guide

### Step 1: Run SQL Schema in Supabase
1. Log in to your [Supabase Dashboard](https://app.supabase.com).
2. Go to the **SQL Editor** in your project.
3. Open `database/schema.sql` from this repository, copy its contents, and click **Run**.
4. *(Optional for File Uploads)*: In Supabase Dashboard -> **Storage**, create a bucket named `clinic-files`.

### Step 2: Configure Environment Variables
Open the `.env` file in the project root and fill in your Supabase credentials (found in **Project Settings -> API**):
```env
PORT=3000
NODE_ENV=development

SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

JWT_SECRET=cliniccare-super-secret-jwt-key-2026-secure-production
APP_URL=http://localhost:3000
STORAGE_BUCKET=clinic-files
```

### Step 3: Seed Database (Demo Users & Sample Data)
Run the automated seed script to populate test accounts and sample patients/medicines:
```bash
npm run seed
```

### Step 4: Start the Application
Start the server:
```bash
npm start
```
Or with auto-reload during development:
```bash
npm run dev
```

Open your browser at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Pre-Configured Demo Credentials

Click any of the quick-fill demo buttons on the login screen or use these credentials:

| Role | Email | Password |
|---|---|---|
| **System Administrator** | `admin@clinic.com` | `Admin@123456` |
| **Physician / Doctor** | `dr.smith@clinic.com` | `Doctor@123456` |
| **Front Desk Receptionist** | `receptionist@clinic.com` | `Recept@123456` |
| **Clinical Nurse** | `nurse@clinic.com` | `Nurse@123456` |
| **Pharmacist** | `pharmacist@clinic.com` | `Pharma@123456` |
| **Laboratorist** | `laboratorist@clinic.com` | `Lab@123456` |
| **Cashier / Billing** | `cashier@clinic.com` | `Cashier@123456` |

---

## 🔒 Security Architecture
- **Row-Level Security (RLS)**: Enforced directly on PostgreSQL tables.
- **Service Role Protection**: Never exposed to the client; all operations requiring administrative privileges run strictly on the Node.js Express server.
- **JWT Authorization**: Requests transmit standard Bearer tokens validated against Supabase Auth.
- **Security Headers & Limits**: Protected via Helmet, CORS origin control, and Express Rate Limiting.
