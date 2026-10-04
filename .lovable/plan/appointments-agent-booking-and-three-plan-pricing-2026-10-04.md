# Appointments, agent booking, and three-plan pricing

## Before we start: two things to know
- **Team members:** the setup wizard doesn't collect them yet, so there's no team to pull in. I'll add a **Team & hours** screen where you can add technicians and their working hours. The Staff view will use that list.
- **Pricing:** the switch to three plans changes the pricing page and the setup paywall. Recurring monthly billing still isn't connected (it needs a Square subscription plan for each tier). Until then, checkout still only collects the one-time setup fee. The plan the salon picked is saved so billing can follow later.

## 1. Appointments page (Dashboard → Appointments)
- At the top: the salon name, previous/next date arrows, and **Calendar | List | Waitlist** tabs. There's always a **+ New Appointment** button.
- **Calendar views:** Today, Day, Week, Month, and **Staff**. Staff shows one column per technician, appointment cards in time slots, and "Available" gaps.
- **Filters:** staff, service, status (booked / confirmed / completed / cancelled / no-show), and source (AI call, AI text, staff).
- **Appointment card:** client name, service, time, technician and status, plus small badges for "AI Booked" and "Text confirmed".
- **Side panel for each appointment:** client, phone, service, technician, notes, source, confirmation status, and a link to the call it came from. Actions: Text, Call, Reschedule, Cancel, Mark completed or no-show.
- **List tab:** upcoming and past appointments in a searchable table.
- **Waitlist tab:** client, wanted service, preferred technician and times. When an appointment is cancelled, matching waitlist people are shown so staff can text them with one tap (staff approve every text).
- A status chip reading **"Salon Pro Scheduling"** shows where the calendar comes from. Square and Google sync can plug in later.

## 2. Team & hours
- Add, rename and remove technicians, and set the services each one does.
- Set weekly working hours and days off for each technician.
- Default rules for the salon: cleanup buffer between appointments, how far ahead clients can book, and minimum notice.

## 3. Salon Agent books for real
- When a client calls or texts, the agent can check real open times, then book, reschedule or cancel. Every booking checks for double-bookings and conflicts at the moment it's saved.
- On calls: tools are added to each salon's voice agent that reach secured web addresses on this site.
- On texts: the text agent uses the same booking logic.
- Each booking records where it came from, so it shows as "AI Booked". When a booking came from a call, it links back to that call.
- When the agent books, the client gets a confirmation text. It's sent only when the salon has a number, and it can be turned off.

## 4. Woven into the rest of the dashboard
- **Overview:** a "Today's Appointments" card with a View Calendar link. "Appointments booked" and "Est. revenue captured" become real numbers.
- **Calls:** a Book Appointment action in the call panel, plus the linked appointment when there is one.
- **Messages:** the client panel shows their last and next appointment and total visits.

## 5. Three plans
- The pricing page shows **Essential $299, Pro $449, and Premier $699**, using the comparison table from your brief. Salon Pro Scheduling is **+$79/mo** on Essential and included on Pro and Premier.
- The $1,500 setup fee stays as it is today, unless you want it changed.
- The setup paywall lets the salon pick a plan, and the choice is saved with the salon.
- Your saved rule about having one plan will be updated to match.

## Not in this round
- Square, Google and Outlook calendar sync. Each salon would sign in to its own account, and each service needs its own app set up first.
- Automatic reminders (24 hours or 2 hours before), thank-you and review texts, email notifications, deposits, and the text allowance counter. Each of these needs a scheduled job or a payment step, so they come next.
- "Fill My Books" and automatic waitlist texting.

## Technical section
- **New tables, all limited to the salon's own team:**
  - `staff` (name, services, active)
  - `staff_hours` (weekday, start, end, breaks)
  - `staff_time_off`
  - `appointments` (salon, staff, service(s), client name and phone, start and end, status, source, call_id, notes, price snapshot)
  - `waitlist`
  - `booking_rules` columns on `salons` (buffer, lead time, horizon)
- **Double-booking protection:** a database exclusion constraint on staff plus a time range for active appointments, so two bookings can't overlap.
- **Availability:** a pure function, computed from hours, time off, existing appointments, the service length and the buffer. It's shared by the dashboard, the voice-agent tools and the text agent, and has unit tests.
- **Voice-agent tools:** routes under `/api/public/agent-tools/*`, protected by a per-salon secret in the URL that's checked on every request. They're added to the voice agent through its existing create/update path.
- **Text agent:** booking intent is handled with tool calls through the AI gateway.
- **Pricing:** `src/lib/pricing.ts` becomes three tiers. The pricing section is re-rendered from it, and the plan memory and project notes are updated.
