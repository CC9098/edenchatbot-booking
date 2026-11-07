# In-person appointment reminder templates

The booking reminder cron sends the next day's reminders. When the patient has an open WhatsApp messaging window, Chatwoot can send the reminder as text. Outside that window, create the following Utility templates in WhatsApp Manager for both Traditional Chinese (Hong Kong) and English. After Meta approves them, sync the WhatsApp inbox in Chatwoot. The existing reminder template remains available as a fallback while the new templates are pending or if a send fails.

| Template name | Extra lines |
| --- | --- |
| `booking_reminder_visit_v2` | Base body only |
| `booking_reminder_visit_v2_first` | First visit |
| `booking_reminder_visit_v2_last` | Last appointment |
| `booking_reminder_visit_v2_first_last` | Last appointment, then first visit |

Insert the applicable extra lines before the booking management line. Use the same seven named BODY parameters in every variant and keep the management link in the BODY.

## Traditional Chinese (Hong Kong)

```text
醫天圓中醫診所預約提醒

你好 {{patient_name}}，
提提你，明天有診症預約。
醫師：{{doctor_name}}
診所：{{clinic_name}}
預約時間：{{appointment_datetime}}
診症類型：{{visit_type}}
預約編號：{{booking_id}}

診所只接受現金、轉數快（FPS）及銀行轉帳。不接受信用卡或易辦事（EPS）。
如需取消或更改預約，請盡早通知我們。
如有發燒或咳嗽，到診時請佩戴外科口罩。

如需更改或取消預約，請到 {{manage_url}} 辦理。
```

- Last appointment — 這是本節最後一個看診時段，請預留交通時間，準時到診。
- First visit — 首次到診請帶同身份證登記。

## English

```text
Eden Clinic — appointment reminder

Hello {{patient_name}},
This is a reminder of your appointment tomorrow.
Practitioner: {{doctor_name}}
Clinic: {{clinic_name}}
Appointment: {{appointment_datetime}} (Hong Kong time)
Visit: {{visit_type}}
Booking reference: {{booking_id}}

We accept cash, FPS (Faster Payment System) and bank transfer only. Credit cards and EPS are not accepted.
If you need to cancel or reschedule, please let us know as soon as possible.
If you have a fever or cough, please wear a surgical mask when you come to the clinic.

To change or cancel your appointment, visit {{manage_url}} to manage your booking.
```

- Last appointment — Your appointment is the last of this session. Please allow enough travel time to arrive on time.
- First visit — For your first visit, please bring your identity card for registration.
