# Admissions Module - Flow Documentation

## Overview

The Admissions module has been reorganized to provide clear, separated workflows for different admission scenarios:

1. **New Application** - Standard application submission workflow
2. **Direct Enrollment** - Fast-track enrollment for approved/registered students
3. **Application Management** - Review, edit, and manage existing applications

---

## Folder Structure

```
admissions/
├── page.tsx                          # Main dashboard - lists applications & entry points
├── new/
│   └── page.tsx                      # Create new application
├── enroll/
│   └── page.tsx                      # Direct student enrollment
├── [id]/
│   └── page.tsx                      # View & edit single application
├── components/
│   ├── ApplicationForm.tsx           # Universal form component (all fields)
│   ├── ApplicationTable.tsx          # Application list display
│   ├── ApplicationActions.tsx        # Status actions (review, approve, enroll)
│   ├── DocumentUpload.tsx            # Document attachment handler
│   ├── FeePaymentForm.tsx            # Payment recording
│   ├── AdmissionActions.tsx          # Admission workflow actions
│   └── OnboardButton.tsx             # Onboarding trigger
└── hooks/                            # Custom hooks if needed
```

---

## Workflow Descriptions

### 1. New Application (`/new`)

**Purpose:** Create a new student application through a standard multi-step form

**Flow:**
1. User navigates to `/dashboard/modules/admissions/new`
2. Fills out `ApplicationForm` with all student/guardian/academic details
3. Optionally uploads documents
4. Submits with status `DRAFT`
5. Application appears in the main dashboard with `DRAFT` status
6. School can review, request updates, or approve the application
7. Once approved → status changes to `ACCEPTED`
8. Payment/enrollment follows after approval

**Form Includes:**
- Student Details (name, gender, DOB, photo)
- Guardian Information (name, contact, relationship, ID)
- Emergency Contact (optional if different from guardian)
- Address & Location (region/district)
- Academic Info (learner ID, previous school, entry exam details)
- Health Info (blood group, allergies, disabilities, immunization status)
- Documents (birth certificate, reports, etc.)

**Status Flow:** `DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `OFFERED` → `ACCEPTED` → `ENROLLED`

---

### 2. Direct Enrollment (`/enroll`)

**Purpose:** Enroll a student immediately into the system (for pre-verified/transfer students)

**Flow:**
1. User navigates to `/dashboard/modules/admissions/enroll`
2. Fills out the same comprehensive `ApplicationForm`
3. **All required fields must be completed** (more strict validation)
4. Submits with status `ACCEPTED` and automatic enrollment
5. System immediately:
   - Creates an Application record (status: ACCEPTED)
   - Calls `/enroll/` endpoint to create a Student record
   - Redirects to student detail page
   - Student is immediately in the system

**Key Differences from New Application:**
- Application starts as `ACCEPTED` (not `DRAFT`)
- Automatically enrolls student immediately (no payment required first)
- No separate document upload tab needed
- Student record is created immediately
- Shorter feedback loops (directly to enrolled status)

**Status Flow:** `ACCEPTED` → `ENROLLED` (immediate)

**Use Cases:**
- Transfer students from another school
- Government placement/public authority assignments
- Direct admissions by school decision
- Late enrollments needing quick processing

---

### 3. Application Management (`/[id]`)

**Purpose:** View, edit, and manage a single application throughout its lifecycle

**Flow:**
1. User opens an existing application from the dashboard
2. Can view all current information
3. Can edit application data (if not yet enrolled)
4. Can upload additional documents
5. Can record fee payments
6. School admin can:
   - Change status (review, test, offer, accept, reject)
   - Send application for additional info
   - Schedule tests
   - Record fees and enroll

**Available Actions by Status:**
- `DRAFT` → Submit for review, Edit
- `SUBMITTED` → Move to review, Request info, Reject
- `UNDER_REVIEW` → Schedule test, Send offer, Reject
- `TEST_SCHEDULED` → Schedule test dates
- `OFFERED` → Accept/Reject offer
- `ACCEPTED` → Accept payment, Enroll student
- `ENROLLED` → View enrolled student record

---

## Form Component (`ApplicationForm.tsx`)

The `ApplicationForm` is a unified, reusable component used in both flows with intelligent features:

### Key Features:

1. **Responsive Tabs:**
   - Student Details
   - Guardian & Emergency Contact
   - Academic & Health Information
   - Documents (hidden in direct enrollment)

2. **Intelligent Field Visibility:**
   - **For Elementary/Primary Levels:**
     - Shows birth certificate requirement
     - Shows immunization status
     - Hides entry exam fields
     - Restricts placement type to `SELF`
   
   - **For Secondary/High School Levels:**
     - Shows entry exam ID and year
     - Shows pathway selection (STEM/ARTS/VOCATIONAL)
     - Shows placement type options
     - Health info still required

3. **Comprehensive Fields (All Backend-Aligned):**
   ```
   Personal:
   - First name, middle name, last name, preferred name
   - Gender, date of birth, nationality, passport number
   
   Guardian:
   - Name, relationship, phone, email, ID number
   
   Emergency Contact:
   - Name, phone, relationship
   
   Address:
   - Full address, region (county/state), district (sub-county)
   
   Academic:
   - Class/grade level, learner ID
   - Entry exam ID and year (secondary only)
   - Placement type (SELF/PUBLIC/TRANSFER/OTHER)
   - Previous school, pathway (secondary only)
   
   Health:
   - Photo (passport-size)
   - Blood group, allergies, chronic conditions, disabilities
   - Immunization status (primary only)
   - Birth certificate number (primary only)
   
   Other:
   - Religion, category, notes
   ```

4. **Conditional Validation:**
   - Different requirements for primary vs secondary
   - Required fields marked with `*`
   - Real-time error messages

5. **Document Handling:**
   - Multiple file upload (non-direct enrollment only)
   - File type validation
   - Progress indicators

---

## Backend Integration

### Endpoints Used:

```
POST /admissions/applications/              # Create new application
GET  /admissions/applications/              # List applications
GET  /admissions/applications/{id}/         # Get single application
PATCH /admissions/applications/{id}/        # Update application
POST /admissions/applications/{id}/enroll/  # Enroll student

GET /academics/grade-levels/                # Fetch available grades
```

### Form Data Mapping:

All form fields directly map to the backend `Application` model:

| Frontend Field | Backend Field | Notes |
|---|---|---|
| first_name | first_name | Required |
| last_name | last_name | Required |
| class_applied | class_applied | FK to GradeLevel |
| primary_guardian_name | primary_guardian_name | Required |
| primary_guardian_phone | primary_guardian_phone | Required, min 9 chars |
| learner_id | learner_id | Student/UPI number |
| entry_exam_id | entry_exam_id | National exam ID |
| placement_type | placement_type | SELF/PUBLIC/TRANSFER/OTHER |
| region | region | Formerly "county" |
| district | district | Formerly "sub_county" |
| pathway | pathway | (stored in separate pathway field) |
| ... | ... | See ApplicationForm for full list |

---

## Key Data Points Captured

### At New Application:
- ✅ Student demographics
- ✅ Guardian information
- ✅ Academic background
- ✅ Entry requirements
- ✅ Health screening info
- ✅ Photo for identification
- ❌ Payment (recorded later)

### At Direct Enrollment:
- ✅ **All of the above** (same form, same data)
- ✅ Immediate student record creation
- ✅ Immediate enrollment status

### During Application Lifecycle:
- Grade level progression
- Status transitions
- Payment records
- Document attachments
- Test scheduling
- Additional communications

---

## Navigation

### From Main Dashboard (`/admissions`):
- **"New Application" button** → `/new`
- **"Direct Enroll Student" button** → `/enroll`
- **Application row click** → `/[id]`

### From Each Page:
- Back button returns to main dashboard
- Application detail loads from the ID
- Form submission redirects appropriately

---

## Error Handling

All pages include:
- **Loading states** - spinner while fetching data
- **Error alerts** - clear messages for failures
- **Toast notifications** - success/error feedback
- **Form validation** - real-time field errors
- **Network fallbacks** - graceful degradation

---

## Future Enhancements

1. **Bulk actions** - Accept/reject multiple applications
2. **Email notifications** - Applicant status updates
3. **Interview scheduling** - Built-in calendar
4. **Document verification** - File scanning/OCR
5. **Payment integration** - Direct payment in form
6. **Interview feedback forms** - Assessor input
7. **Waitlist management** - Overflow handling
8. **API export** - Data download options

---

## Testing Checklist

- [ ] New Application flow (create → draft → submit)
- [ ] Direct Enrollment flow (create → immediate enroll)
- [ ] Application edit (update existing fields)
- [ ] Form validation (required fields, format)
- [ ] Photo upload (size/format limits)
- [ ] Document upload (multiple files)
- [ ] Grade level selection (primary vs secondary fields)
- [ ] Status transitions (all workflow states)
- [ ] Error states (network, permission, validation)
- [ ] Mobile responsiveness (all pages)

---

## Questions & Support

For issues or questions about the admissions flow, refer to:
- Backend API documentation: `/backend/apps/admissions/`
- Form schema: `ApplicationForm.tsx` (lines 20-80)
- Navigation: This document (see Navigation section)
