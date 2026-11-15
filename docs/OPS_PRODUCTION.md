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
