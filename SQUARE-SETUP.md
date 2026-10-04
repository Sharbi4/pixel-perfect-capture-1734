# Square checkout setup

Status: implemented in the repository; see the release verification record. No real or sandbox charge has been made. Checkout stays disabled until credentials are configured. Square Appointments OAuth is a separate integration and is not implemented by these payment routes.

## Configure a sandbox first

Use the platform owner's Square developer application and sandbox seller account. This account receives SaaS subscription payments; it is separate from each salon's appointment account. Keep all access tokens and signature keys in Lovable/server secrets, never browser variables or chat.

| Server variable | Value |
| --- | --- |
| `SQUARE_CHECKOUT_ENABLED` | `false` until the rest is configured; `true` enables checkout in the selected environment |
| `SQUARE_ENVIRONMENT` | `sandbox` initially |
| `SQUARE_APPLICATION_ID` | Application ID for that environment (the SDK receives this public ID) |
| `SQUARE_ACCESS_TOKEN` | Server access token for that environment |
| `SQUARE_LOCATION_ID` | Active USD location with card processing enabled |
| `SQUARE_PLAN_VARIATION_ID_ESSENTIAL` | USD 29900 cents, MONTHLY STATIC unlimited phase |
| `SQUARE_PLAN_VARIATION_ID_PRO` | USD 44900 cents; legacy `SQUARE_PLAN_VARIATION_ID` is accepted only for Pro |
| `SQUARE_PLAN_VARIATION_ID_PREMIER` | USD 69900 cents, MONTHLY STATIC unlimited phase |
| `CHECKOUT_ENCRYPTION_KEY` | Random 32-byte key encoded as base64; retain while any checkout needs recovery |
| `PUBLIC_APP_ORIGIN` | Canonical deployed origin, HTTPS in production, without a path |
| `SQUARE_BILLING_WEBHOOK_SIGNATURE_KEY` | Signature key from the webhook subscription below |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Existing backend database credentials; server only |

The server verifies the location and catalog price before accepting payment. It charges $1,495 setup plus the selected first month: Essential $1,794, Pro $1,944, Premier $2,194. It stores the card with Square and starts the selected monthly subscription one calendar month later. Each variation must have no fixed catalog billing anchor or proration. Card numbers never pass through this server. Month ends are clamped, and access boundaries use the Square location's time zone.

Configure `https://YOUR-ORIGIN/api/public/square-billing-webhook` with the exact same origin as `PUBLIC_APP_ORIGIN`. Subscribe to payment.created/updated, subscription.created/updated, invoice.payment_made/updated/refunded, and refund.created/updated events supported by the app's API version. Localhost requires a separately configured HTTPS development endpoint for provider callbacks; do not put production credentials in a local sandbox.

Allow `https://YOUR-ORIGIN/complete-account` in Supabase Auth redirect URLs. Configure and verify the production transactional email sender. Production purchases request one Supabase invitation to finish the account; sandbox purchases do not send this invitation. Existing users can sign in using the purchase email. No email was sent during development.

## Verify before accepting customers

1. Use Square sandbox cards to complete preview → checkout → verified account → saved setup. Confirm a single initial charge and a future-dated subscription, with no double charge for the first month.
2. Interrupt the browser after submitting payment, reload, and resume. Verify the original payment/customer/card/subscription IDs are reused. Test duplicate and delayed webhook delivery.
3. Complete email verification from another browser. Confirm the purchase binds only to that verified email and imports preview notes as unapproved draft data.
4. Verify a paid renewal extends access, an unpaid invoice does not, a refund requires review, and an old event cannot restore refunded access. Verify failed signatures are rejected.
5. Sandbox purchases must never unlock live agent/number creation. Production readiness also requires the actual calendar, call, texting and launch checks in RELEASE-2026-10-04.md; a successful subscription is not proof those features work.
6. Configure customer-facing cancellation/refund terms and the support contact before enabling production. Subscription cancellation, refunds, chargebacks, card updates and operator recovery currently require Square Dashboard/support; there is no self-service billing portal. Refunding in Square does not automatically cancel the subscription, so operators must handle both when appropriate.

## Recovery

`checkout_purchases` and `billing_events` are service-only. Never grant them to browser roles. No redirect parameter or client flag grants paid access.

The worker holds a five-minute lease and uses immutable idempotency keys per purchase. It saves each provider ID before the next operation. Encrypted payment tokens permit resuming only within one hour of purchase creation and are erased on success. After that window, or a failed/uncertain payment, operators must inspect Square before any new purchase. Do not delete/recreate purchases or change their idempotency keys to retry. Expired unfinished encrypted tokens need server-side retention cleanup after reconciliation.

Inspect `state`, `error_code`, `invite_state`, and stored provider IDs with backend tools. Invitation states `sending` or `needs_attention` require a delivery-status check before sending another message. An abandoned draft tied to an email currently needs support if the original browser cookie is lost. Monitor unfinished purchases and unprocessed billing events; scheduled reconciliation and a recovery console remain follow-up work.

Renewal access requires the latest Square invoice to be paid with the expected customer, subscription, location and amount. `charged_through_date` alone is not payment proof. Refund access changes are irreversible through webhook replay. Webhook failures return a retryable response, so monitor delivery failures in Square.

## References

- [Square charge and store](https://developer.squareup.com/docs/web-payments/charge-and-store-cards)
- [Create subscription](https://developer.squareup.com/reference/square/subscriptions-api/create-subscription)
- [Validate webhooks](https://developer.squareup.com/docs/webhooks/step3validate)
- [Subscription invoice dates](https://developer.squareup.com/reference/square/objects/Subscription)
- [Supabase invitations](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
