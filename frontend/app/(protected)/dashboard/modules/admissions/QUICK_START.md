# Quick Start Guide - Admissions Module

## 🎯 Three Main Entry Points

### 1. **New Application** 
**URL:** `/dashboard/modules/admissions/new`
- Student applies for admission
- Form saves as DRAFT status
- Can be reviewed and approved later
- Documents uploaded during application
- Payment collected after approval
- **Result:** Student in "Pending Review" state

### 2. **Direct Enrollment**
**URL:** `/dashboard/modules/admissions/enroll`
- Immediate enrollment (no waiting period)
- All fields required (full form)
- Application created as ACCEPTED immediately
- Student record created instantly
- **Result:** Student immediately in system

### 3. **Manage Application**
**URL:** `/dashboard/modules/admissions/{id}`
- View existing application
- Edit student/guardian information
- Upload additional documents
- Change application status
- Record payments
- Enroll approved students

---

## 📋 Form Sections

The `ApplicationForm` is used in all three flows. It has 3-4 tabs:

### Tab 1: Student Details
- First name, middle name, last name *
- Preferred name
- Gender
- Date of birth
- Photo (passport-size)
- **Class/Grade Level*** ← Determines which other fields appear

### Tab 2: Guardian & Emergency Contact
- Guardian name *
- Relationship *
- Phone number *
- Email
- Guardian ID/Passport number
- Emergency contact (if different)

### Tab 3: Academic & Health
**Content varies by Grade Level:**

**For Primary/Elementary:**
- Learner ID (recommended)
- Birth certificate number *
- Immunization status *
- Health info (blood group, allergies, conditions)
- Notes

**For Secondary/High School:**
- Learner ID (required)
- Entry exam ID & year
- Admission type (placement type)
- Pathway selection (STEM/ARTS/VOCATIONAL)
- Health info (blood group, allergies, conditions)
- Notes

### Tab 4: Documents (New Application Only)
- Birth certificate
- Previous school reports
- Immunization card
- ID/Passport copy
- Any supporting documents

---

## 🔄 Application Lifecycle

```
NEW APPLICATION FLOW:
1. Create (DRAFT)
   ↓
2. Submit for Review (SUBMITTED)
   ↓
3. Under Review (UNDER_REVIEW)
   ↓
4. Decision: Offered (OFFERED) or Rejected
   ↓
5. Accept Offer (ACCEPTED)
   ↓
6. Payment + Enroll (ENROLLED)

DIRECT ENROLLMENT FLOW:
1. Create (ACCEPTED) - Immediate
   ↓
2. Auto-Enroll (ENROLLED) - Same action
   → Student created in system immediately
```

---

## ✅ All Fields Captured

| Section | Fields |
|---------|--------|
| **Personal** | First/last name, gender, DOB, nationality, photo |
| **Guardian** | Name, relationship, phone, email, ID number |
| **Emergency** | Name, phone, relationship |
| **Address** | Full address, region, district |
| **Academic** | Class level, learner ID, previous school, entry exam (secondary), pathway (secondary) |
| **Admission** | Placement type, admission date |
| **Health** | Blood group, allergies, chronic conditions, disability, immunization (primary) |
| **Other** | Religion, category, notes |

---

## 🎓 Smart Field Logic

### Primary/Elementary Level Selected:
✅ Shows: Birth certificate, immunization status
❌ Hides: Entry exam fields, pathway, public placement
📌 Restricts: Placement type to "SELF" only

### Secondary/High School Selected:
✅ Shows: Entry exam fields, pathway options, all placement types
✅ Shows: Emergency contact section
✅ Shows: Health information section

---

## 📊 Database Alignment

All form fields map directly to backend `Application` model:

```python
# Student
first_name, middle_name, last_name, preferred_name
gender, date_of_birth, nationality, passport_number, photo

# Guardian
primary_guardian_name, primary_guardian_phone
primary_guardian_email, primary_guardian_relationship
primary_guardian_id_number

# Emergency
emergency_contact_name, emergency_contact_phone
emergency_relationship

# Address
address, region, district

# Academic
class_applied (GradeLevel FK)
learner_id, previous_school
entry_exam_id, entry_exam_year
placement_type

# Health
blood_group, allergies, chronic_conditions, disability

# Other
religion, category, notes, status, admission_date
```

---

## 🚀 Common Tasks

### Create New Application
1. Click **"New Application"** from dashboard
2. Fill form (required: name, class, guardian, nationality)
3. Upload documents (optional)
4. Click **"Submit Application"**
5. Application appears in dashboard as **DRAFT**

### Direct Enroll Student
1. Click **"Direct Enroll Student"** from dashboard
2. Fill **complete** form (all required fields)
3. Click **"Enroll Student Now"**
4. Student created and enrolled immediately
5. Redirect to student dashboard

### Edit Application
1. Click application from list
2. Edit any fields
3. Upload documents if needed
4. Click **"Submit Application"** to save
5. Admin can change status from Actions section

### Approve & Enroll
1. Open application from dashboard
2. Scroll to bottom → **"Admissions Actions"** section
3. Click **"Accept Application"** (if OFFERED)
4. Record payment in **"Fee Payments"** section
5. Click **"Enroll Student"** to create student record

---

## ❌ Common Mistakes

| Mistake | Fix |
|---------|-----|
| Direct Enroll not showing all fields | Make sure you click "Direct Enroll" not "New Application" |
| Missing learner ID in new app | It's optional for new apps, required for direct enrollment |
| Can't change class after creation | Create new application or contact admin |
| Primary student shows exam fields | Grade level determines fields - verify class selection |
| Documents disappear | Documents only in "New Application" flow, not direct enroll |

---

## 📞 Support

For detailed documentation, see:
- **Flow Documentation:** `/admissions/ADMISSIONS_FLOW.md`
- **Reorganization Summary:** `/ADMISSIONS_REORGANIZATION_SUMMARY.md`
- **Form Source Code:** `/components/ApplicationForm.tsx`
- **Backend Model:** `/backend/apps/admissions/models.py`

---

## 📱 Mobile Responsive

All pages are fully responsive:
- ✅ Mobile-first design
- ✅ Touch-friendly inputs
- ✅ Optimized layouts for small screens
- ✅ Stacked buttons on mobile
- ✅ Readable text sizes

---

**Last Updated:** January 2026
**Version:** 2.0 (Reorganized)
