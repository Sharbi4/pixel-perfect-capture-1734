# Salon Pro Agent onboarding

The public journey is business name/type and optional website, calendar/phone preferences, a personalized greeting illustration, three plans and optional upgrade interests, then Square checkout. The browser voice sample is labeled as an illustration. No provider resources are allocated by the public preview. Upgrade interests are saved for the launch team and explicitly excluded from payment.

After verified paid access: business address/hours/timezone and phone preference, Square or Google authorization (or native scheduling), reviewed services, ElevenLabs voice preview, policies, build, then number reservation and phone/booking tests. Progress is stored in setup_draft.onboarding with a revision-checked update; Save & finish later returns to the dashboard. Square’s signed state allows only /setup or /dashboard/agent as return destinations.

Square catalog reads paginate, exclude retail/unbookable/incomplete/non-USD entries and require approval before inserts. Existing services are kept. PDF/photo/CSV/website/text imports propose rows; approval merges matching names while preserving service IDs and unrelated services. New salons no longer receive a sample nail menu.

Phone selection supports a real existing number or a preferred area code for a new business. It retains durable phone_jobs locks, explicit reservation, and read-only reconciliation of uncertain purchases. Porting is a managed request, not an automatic transfer. Forwarding and SMS registration remain separate and are never marked verified by a button click.

Square booking creation now rechecks live availability and sends provider-returned staff, duration and variation version. Availability uses the Square location timezone. Native agent scheduling checks the plan/add-on entitlement.

## Required live acceptance checks
- Configure Square SaaS billing credentials/plan mappings and enable checkout only after sandbox validation. This is separate from each salon’s Square Appointments OAuth.
- Square OAuth needs the declared permissions (including seller-level appointments, business booking settings and employees), production callback origin and encryption configuration. Previously connected accounts may need reconnecting. Verify the merchant’s seller-level booking support and correct Square location.
- Authorize a real Square and Google test account; exercise denial, expiry, reconnect and return to setup. Google needs the Lovable App User Connector configuration.
- Approve a small service import, verify IDs and prices, then create/cancel a test booking in the connected calendar. Provider-level tests have not been executed by this release’s automated tests.
- Complete the payment/account-claim path, then explicitly reserve and test an available phone number using configured Twilio/ElevenLabs services. No live charge, number purchase, transfer, or customer message was made during development.
- Add-on interests require follow-up and separate billing activation; they are not automatically purchased. Porting and carrier forwarding require the launch team/carrier.

Source references: https://developer.squareup.com/docs/bookings-api/use-the-api and https://developer.squareup.com/reference/square/objects/AppointmentSegment

This commit is intended for GitHub sync. The owner publishes in Lovable.
