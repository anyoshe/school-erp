# Production ops (P0)

## Meals
- Not a separate finance module. Add **Lunch / meals** on the fee structure.
- Continuing students: **Finance → Returning billing → Include lunch**.
- Roster: **Students → Lunch program**. Collect via **Record payments**.

## Transport
- Create routes (term fee by distance) under **Transport**.
- Assign: Transport page, Clearance (School transport + route), or Returning billing.
- End subscription without deleting history: **End** on active list.

## Returning students / arrears SOP
1. Promote in Academics.
2. When learner reports: **Finance → Returning** → select structure → optional lunch/transport → Bill.
3. Collect under **Record payments** / statements.

## Period lock
- Lock term in **Academics → Years/Terms**.
- Finance **refuses new payments** on invoices for locked terms.

## Notifications (Kenya)
Set on Deplexo (backend):
```
AFRICASTALKING_USERNAME=...
AFRICASTALKING_API_KEY=...
AFRICASTALKING_SENDER_ID=...
WHATSAPP_PROVIDER=meta|ultramsg|twilio|log
```
Cron (daily):
```
python manage.py scan_risks
python manage.py send_risk_digest --channel SMS
python manage.py send_fee_reminders
python manage.py process_library_notifications
```

## Hosting
- Netlify: `NEXT_PUBLIC_API_URL=https://<deplexo-host>/api`
- Deplexo: `CLOUDINARY_URL=...`, DB URL, secret key, notify env above.

## Phase A checklist (product honesty + stability)

### Modules
- Shell modules (`events`, `health`, `alumni`, `elearning`, `inventory`, `procurement`) are **not** in the sidebar.
- New schools get core modules only (includes library, transport, reports).
- After deploy, prune leftovers on existing tenants:
  ```bash
  python manage.py prune_shell_modules
  python manage.py prune_shell_modules --dry-run   # preview
  ```

### Meals
- No Finance → Meals product. Use fee structure / Returning billing / Students → Lunch program.

### Parent portal
- Staff manage links: **Parent Portal** (`/dashboard/modules/parent-portal`).
- Parents view child data + **Print report** / **Print fee statement**: `/dashboard/modules/parent`.

### Notifications (verify on Deplexo)
```bash
# Env
AFRICASTALKING_USERNAME=...
AFRICASTALKING_API_KEY=...
AFRICASTALKING_SENDER_ID=...

# Daily cron (example)
python manage.py scan_risks
python manage.py send_risk_digest --channel SMS
python manage.py send_fee_reminders
python manage.py process_library_notifications
```
Confirm one absence SMS and one fee reminder in LOG or live before calling notify "live".



## Phase B (term excellence)

- **Timetable:** Academics → Timetable. Seed periods, pick section, place subjects on the grid.
- **Reports CSV:** Reports → Enrollment funnel / Fee arrears / Attendance summary.
- **Transport day sheet:** Transport → Load day sheet → Print.
- **Offer SMS:** Admissions offer letter → Finalize + SMS (needs Africa’s Talking env).
- Migrate: `python manage.py migrate academics` (0007 timetable).
