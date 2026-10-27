# Fee Management System - Complete Implementation Guide

## 🎯 Overview

The School ERP **Fee Management System** is a complete, synchronized student billing solution that handles:
- **Fee Structure Management** — Define fees per grade/term
- **Payment Plans** — Flexible installment schedules (weekly, monthly, termly)
- **Student Fee Assignment** — Personalize fees with waivers and optional items
- **Auto Invoice Generation** — Automatic creation of installment invoices
- **Payment Recording & Tracking** — Record payments and track balances
- **Financial Reporting** — Real-time dashboards and reports

## 🔄 Complete Workflow

```
┌─────────────────────────────┐
│   1. ENROLLMENT             │
│   Student → Application     │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│   2. FEE ASSIGNMENT         │
│   Assign fee structure      │
│   Select payment plan       │
│   Apply waivers/options     │
└─────────────┬───────────────┘
              ↓
         [SIGNAL FIRES]
              ↓
┌─────────────────────────────┐
│   3. AUTO INVOICE GEN       │
│   Invoices created based    │
│   on payment plan           │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│   4. PAYMENT RECORDING      │
│   Record M-PESA, Cash, etc. │
│   Auto-update balances      │
└─────────────┬───────────────┘
              ↓
┌─────────────────────────────┐
│   5. FINANCIAL TRACKING     │
│   Dashboard shows:          │
│   - Outstanding balance     │
│   - Overdue invoices        │
│   - Collection rate         │
│   - Student financial health│
└─────────────────────────────┘
```

## 📋 Components Implemented

### Backend

#### 1. **Auto-Invoice Signal** (`apps/finance/signals.py`)
```python
# Automatically generates invoices when StudentFeeAssignment is created
# Supports both single-payment and multi-installment scenarios
# Respects payment plan intervals (weekly, monthly, termly)
```

**Triggered when:**
- User creates a fee assignment for a student
- Finance creates a fee assignment during clearance using the grade, academic year, and term selected at enrollment

Enrollment does not assign a fee structure. Clearance uses an active structure only when its grade,
academic year, and term match the enrollment selection exactly; if no matching structure exists,
Finance must create it before billing.

**Features:**
- Single invoice for full payment plans
- Multiple invoices split by payment plan installments
- Automatic due date calculation based on interval
- System-generated (no manual action needed)

#### 2. **Management Command** (`apps/finance/management/commands/generate_invoices.py`)
```bash
# Generate invoices for students without them (for backfilling)
python manage.py generate_invoices

# Options:
#   --force              # Regenerate even if invoices exist
#   --assignment-id      # Process only one student
#   --year              # Process specific academic year
```

**Use cases:**
- Bulk process existing assignments that don't have invoices yet
- Create invoices for new term
- Recover from invoice generation failures

#### 3. **Fixed StudentFeeAssignmentViewSet Queryset**
```python
# Changed from: filter(school__in=...) → filter(student__school__in=...)
# StudentFeeAssignment doesn't have a direct school field
# Routes through: assignment → student → school
```

### Frontend

#### 1. **Student Fee Assignment Page** 
**Path:** `/dashboard/modules/finance/student-assignments`

**Features:**
- Search & select students
- Select fee structure with details display
- Choose payment plan
- Apply waivers with reasons
- Select optional fee items
- View effective total after adjustments
- **Generate invoices button** (manual trigger)
- Summary of all current assignments

#### 2. **Invoices Management Page**
**Path:** `/dashboard/modules/finance/invoices`

**Features:**
- List all invoices with status indicators
- Filter by: status (paid/unpaid/overdue), term, year
- Search by student name or invoice number
- Real-time stats:
  - Total billed
  - Total collected
  - Outstanding balance
  - Overdue amount
- View invoice details including payment history
- Print invoices

#### 3. **Payments Recording & Tracking**
**Path:** `/dashboard/modules/finance/payments`

**Features:**
- Record new payments with:
  - Invoice selection
  - Amount
  - Payment method (Cash, M-PESA, Bank, Cheque)
  - Reference number
  - Notes
- Unpaid invoices quick list
- Payment history with all methods
- Stats: Pending payment, recorded today, transaction count

#### 4. **Finance Dashboard**
**Path:** `/dashboard/modules/finance`

**Displays:**
- Outstanding balance (KES amount + invoice count)
- Overdue balance (past-due invoices only)
- Total revenue collected
- Number of students with fees
- Total invoiced amount
- Collection rate percentage
- Quick action buttons for all finance operations
- Financial health summary

## 🔑 Key Features

### 1. **Synchronized Fee Assignment → Invoices**
- Signal triggers automatically when `StudentFeeAssignment` is created
- No manual "Generate Invoice" step needed (though button provided for manual trigger)
- Invoices match payment plan structure exactly

### 2. **Smart Balance Calculation**
```
Student Outstanding Balance =
  Fee Structure Total
  - Admission Payments (during enrollment)
  - Invoice Payments (ongoing)
```

**Updated in real-time when:**
- Enrollment happens → admission payment deducted
- Payment recorded → invoice balance updated
- Waiver applied → effective total recalculated

### 3. **Multi-Level Payment Plans**
| Plan Type | Interval | Example |
|-----------|----------|---------|
| Full Payment | Immediate | Total amount due now |
| Weekly | 7 days | 10 invoices over 70 days |
| Monthly | 30 days | 3 invoices over 90 days |
| Termly | 120 days | Split across term |

### 4. **Financial Health Indicators**
- **Overdue Status** — Invoices past due date
- **Collection Rate** — Percentage of money collected
- **Outstanding vs Overdue** — Distinguish normal pending from past-due
- **Per-Invoice Tracking** — Every payment is tied to specific invoice

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/finance/student-assignments/` | GET | List assignments |
| `/finance/student-assignments/` | POST | Create assignment |
| `/finance/student-assignments/{id}/` | PATCH | Update assignment |
| `/finance/student-assignments/{id}/generate-invoice/` | POST | Manual invoice generation |
| `/finance/invoices/` | GET | List invoices (filterable) |
| `/finance/invoices/{id}/` | GET | Invoice details |
| `/finance/payments/` | GET | List all payments |
| `/finance/payments/` | POST | Record payment |
| `/students/{id}/finance-summary/` | GET | Student financial overview |

## 🚀 Usage Guide

### For Administrators

#### Step 1: Set Up Fee Structures
1. Go to **Manage Fee Structures**
2. Create structure for each grade and term
3. Add mandatory items (tuition, boarding, etc.)
4. Mark optional items available

#### Step 2: Define Payment Plans
1. Go to **Manage Payment Plans**
2. Create plans (e.g., "3-Month Installments")
3. Set intervals and number of installments

#### Step 3: Assign Fees to Students
1. Go to **Assign Fees to Students**
2. Search and select student
3. Choose fee structure
4. Select payment plan
5. (Optional) Apply waiver or discounts
6. (Optional) Add optional items
7. Click **Create Assignment**
   - ✓ Auto-generates invoices (via signal)
8. Or click **Generate Invoices** (manual trigger)

#### Step 4: Track Payments
1. Go to **Record Payments**
2. Select unpaid invoice
3. Enter payment method and amount
4. Add reference number (M-PESA code, etc.)
5. Click **Record Payment**
   - ✓ Invoice balance updates automatically

#### Step 5: Monitor Financials
1. Dashboard shows:
   - Outstanding balance by category
   - Overdue amounts in red
   - Collection rate percentage
2. **Invoices** page shows detailed status
3. **Payments** page shows all transactions

### Batch Operations

#### Generate Invoices for Existing Assignments
```bash
python manage.py generate_invoices
# Processes all assignments without invoices
```

#### Regenerate for Specific Year
```bash
python manage.py generate_invoices --year 2026
```

#### Process Single Student
```bash
python manage.py generate_invoices --assignment-id <uuid>
```

## 📊 Financial Reports

The dashboard provides:
- **Outstanding Balance** — Total unpaid invoices
- **Overdue Balance** — How much is past due
- **Total Revenue** — Amount collected
- **Collection Rate** — Percentage of total billed
- **Students with Fees** — Active enrollment count
- **Invoice Count** — Total billing lines

## 🔒 Data Integrity

- **Transactions are atomic** — Payment recording either succeeds completely or fails entirely
- **Balance calculations are dynamic** — Never stale, always up-to-date
- **Invoice amounts are locked** — Can't change invoice amount after creation
- **Audit trail** — All payments record who made them and when

##  ✅ Workflow Validation Checklist

```
✓ Fee structures created and published
✓ Payment plans defined with intervals
✓ Students assigned to grades/classes
✓ Fee assignments created for enrolled students
✓ Invoices auto-generated from assignments
✓ Payment methods configured (Cash/M-PESA/Bank/Cheque)
✓ Staff trained on payment recording
✓ Dashboard monitored weekly for outstanding balances
✓ Overdue invoices followed up monthly
✓ Reports generated monthly for management
```

## 🎓 Student Perspective

Each student's financial record shows:
- Assignment fee structure (e.g., Grade 1 2026 Term 1)
- Payment plan (e.g., 3 monthly installments)
- Effective total (after waivers)
- Admission payment (made during enrollment)
- Outstanding balance (calculated in real-time)
- Monthly due dates for each invoice
- Payment history (all receipts)

## 📧 Integration Points

The system integrates with:
- **Student Enrollment** — Fee assignment happens at enrollment
- **Student Management** — Financial summary shown on student profile
- **Reports** — Financial data available for reporting
- **Notifications** — (Future) Email overdue reminders

## 🛠️ Troubleshooting

### Invoices Not Being Generated
1. Check that `StudentFeeAssignment.objects.create()` was called
2. Verify signal is registered: Check `apps/finance/apps.py` has `ready()` method
3. Manually trigger: Use **Generate Invoices** button in UI
4. Or run: `python manage.py generate_invoices`

### Balance Not Updating After Payment
1. Refresh page (browser cache)
2. Check payment status in `/finance/payments/`
3. Verify invoice balance recalculated in `/finance/invoices/`
4. Check student finance summary: `/students/{id}/finance-summary/`

### Student Shows No Fee Assignment
1. Student must be enrolled (have `fee_structure` on Student model)
2. Or have explicit `StudentFeeAssignment` record
3. Check: `StudentFeeAssignment.objects.filter(student_id=...)`

---

**Last Updated:** April 5, 2026  
**System Status:** ✅ **Fully Implemented & Synchronized**
