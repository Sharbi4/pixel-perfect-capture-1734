# NailDesk Pro: salon setup (all three parts)

Built in three phases, each one usable before the next starts.

## Phase 1: "How setup works" on the landing page
- A new section with 4 steps: Tell us about your salon, Pick your voice, We build your receptionist, Go live.
- Shows the three setup options: do it online, set it up by phone with NailDesk Pro, or we set it up for you.
- Short note that calls can go live first, and texting starts once business texting approval comes through.
- "Start setup" buttons across the site go to the new setup page.

## Phase 2: Step-by-step setup pages (/setup)
1. **Salon details**: name, address, current phone, website, hours, languages, contact person.
2. **Services**: add them by hand (name, price, minutes, add-on yes/no), starting from common nail services. Upload a menu or paste a website link to have them filled in automatically.
3. **Pick your receptionist**: 6 curated voices (Mia, Sophie, Emma, Linh, Ava, plus one more). Each has a play button that says "Thank you for calling {your salon}. How can I help you today?" in that voice.
4. **Policies**: deposits, cancellations, walk-ins, booking app used.
5. **Review & launch**: a summary of everything, then a status screen ("Receptionist built", "Phone number", "Texting: pending approval").

## Phase 3: Make it real
- Salon owners create an account and sign in. Their setup saves as they go, so they can come back later.
- Uploaded menus and website links get read by AI and turned into a services list they can edit.
- The voice previews are real spoken audio with their salon's name.
- Each salon gets a dashboard showing its setup status.
- **Needs you later:** building the phone agent and getting a phone number requires a voice-phone provider account (for example Vapi). Once you add that, launching will create the agent and number automatically. Until then, the launch step records the request and shows it as "Setting up".

## Technical details
- Lovable Cloud for auth plus tables: salons, services, salon_settings, user_roles. RLS scopes each row to its owner.
- Server functions handle menu/website extraction (default chat model with structured output), TTS previews (default TTS model, cached for each salon and voice), and launch (provider call behind a secret once one is added).
- Routes: /setup (wizard, protected), /auth, /account (status).
