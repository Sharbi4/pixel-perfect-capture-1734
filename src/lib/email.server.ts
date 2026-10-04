// Server-only: send email via the Resend connector gateway.
// Import this from *.functions.ts handlers or server routes — never from client code.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

export async function sendEmail(input: SendEmailInput) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!lovableKey || !resendKey) {
    throw new Error("Email is not configured (missing LOVABLE_API_KEY or RESEND_API_KEY)");
  }
  if (!input.html && !input.text) {
    throw new Error("Email needs html or text content");
  }

  const response = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      // onboarding@resend.dev only delivers to the Resend account owner.
      // Use an address on a domain verified in Resend to email real recipients.
      from: input.from ?? "Salon Pro Agent <onboarding@resend.dev>",
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      ...(input.html ? { html: input.html } : {}),
      ...(input.text ? { text: input.text } : {}),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Resend request failed [${response.status}]: ${errorBody}`);
    throw new Error(`Email send failed [${response.status}]: ${errorBody}`);
  }
  return response.json() as Promise<{ id: string }>;
}
