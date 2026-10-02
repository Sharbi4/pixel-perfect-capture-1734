// Client-safe, customer-facing copy for sanitized setup codes. No provider names.
const MESSAGES: Record<string, string> = {
  not_configured: "Phone setup isn't available yet. Please contact Salon Agent support or check back soon.",
  needs_agent: "Your receptionist needs to be built first.",
  needs_business_number: "Add your salon's current phone number in setup first.",
  search_failed: "We couldn't look up local numbers just now. Please try again in a few minutes.",
  no_local_numbers: "We couldn't find a local number near your salon right now. Our team will help — please try again later.",
  number_unavailable: "That number was just taken by someone else. Please try again.",
  provider_rejected: "We couldn't complete this step. Please try again or contact Salon Agent support.",
  unconfirmed: "We're confirming whether this finished. Tap “Check status” in a moment — we won't do it twice.",
  interrupted: "This step was interrupted. Tap “Check status” and we'll confirm what happened.",
  check_failed: "We couldn't confirm yet. Please tap “Check status” again in a minute.",
  lock_lost: "This step is being double-checked. Tap “Check status” in a moment.",
  not_saved: "We couldn't save confirmation yet. Tap “Check status” before trying again.",
  not_found_yet: "We're still confirming the result. Tap “Check status” again later, or contact Salon Agent support.",
  not_purchased: "No number was set up. You can try again.",
  not_created: "Your receptionist wasn't created. You can try again.",
};

export function setupMessage(code: string): string {
  return MESSAGES[code] ?? "Something went wrong. Please try again or contact Salon Agent support.";
}

export type PhoneSetup = {
  salon_id: string; business_number: string; portability_status: string;
  agent_status: string; agent_error: string; temp_number_status: string; temp_number_error: string;
  voice_status: string; forwarding_status: string; texting_status: string;
};
