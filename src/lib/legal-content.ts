export type LegalDocument = {
  slug: string;
  title: string;
  summary: string;
  sections: { title: string; body: string[] }[];
};
export const legalDocuments: LegalDocument[] = [
  {
    slug: "terms",
    title: "Terms of service",
    summary: "The terms for using the Salon Pro Agent website and business platform.",
    sections: [
      {
        title: "About these terms",
        body: [
          "Salon Pro Agent LLC provides Salon Pro Agent. These terms apply to the website and platform. An accepted order or separate written agreement may contain additional terms. If an order expressly overrides a term here, that order controls for the relevant service.",
          "You must be at least 18 and authorized to act for the business you register. Keep account information accurate, protect your login, and notify us if you suspect unauthorized access.",
        ],
      },
      {
        title: "Your subscription",
        body: [
          "Your order identifies the selected plan, monthly allowance, recurring charge and one-time Custom Setup & Launch charge. Monthly subscriptions renew until cancelled. Additional locations, usage and optional services are governed by the rates and authorizations presented with your order. We will not treat a requested feature as an authorization to buy an undisclosed add-on.",
          "Provider connection, messaging approval, number portability and technical readiness can affect activation. A roadmap listing is not a commitment that a feature is currently available. Do not rely on a planned integration for business-critical operations.",
        ],
      },
      {
        title: "Your business and customer data",
        body: [
          "You retain rights in your business information and customer content. You authorize us and the service providers needed to operate the platform to process that content to deliver, maintain, secure and support the service.",
          "You are responsible for the accuracy of your menu, prices, hours, policies and booking rules, for granting appropriate staff access, and for the notices and permissions needed to process customer information, send messages or record calls. See our privacy, messaging and AI/call policies.",
        ],
      },
      {
        title: "AI and third-party services",
        body: [
          "AI output can be incomplete or inaccurate. Review important settings and monitor outcomes. Availability, appointments, transfers, messages and payments depend on the relevant connected systems. Maintain a way for clients to reach a person. Salon Pro Agent is not an emergency service.",
          "Connected providers may impose separate terms, fees, approval requirements and service limits. A connection does not transfer ownership of a salon's phone number or payment account to us. We do not guarantee uninterrupted operation of third-party systems.",
        ],
      },
      {
        title: "Acceptable use and intellectual property",
        body: [
          "Use the service lawfully and follow our Acceptable Use Policy. Do not attempt unauthorized access, bypass usage limits, send unlawful communications or interfere with another business's service.",
          "We and our licensors retain rights in the platform, software and brand. Your subscription grants permission to use the service for your authorized business activities; it does not transfer ownership of the software.",
        ],
      },
      {
        title: "Cancellation, suspension and responsibility",
        body: [
          "Contact support to request cancellation or account closure. Our Cancellation & Refund Policy explains the process. We may restrict access where needed to address unlawful activity, security threats, provider restrictions or nonpayment. When practical, we will explain the issue and a path to resolve it.",
          "To the extent permitted by applicable law, the service is provided as available without a guarantee of specific revenue, booking volume or error-free AI output. Nothing in these terms excludes a right or remedy that cannot lawfully be excluded.",
        ],
      },
      {
        title: "Updates and contact",
        body: [
          "We may update these terms as the service changes. Material commercial changes will be communicated before they apply to an existing subscription. Contact support@salonagentai.com or 520-551-1113 with questions. Salon Pro Agent LLC's business address is 1 S Church Ave, Tucson, AZ 85701.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy policy",
    summary:
      "How information is handled when you visit the site or use our salon front-desk platform.",
    sections: [
      {
        title: "Who this policy covers",
        body: [
          "Salon Pro Agent LLC operates the platform. This policy covers our website, account relationships and platform operations. When we process a salon's client information to provide its service, the salon also determines how that information is used and may have its own privacy notice. Contact the relevant salon for questions about its appointments or communications.",
        ],
      },
      {
        title: "Information we process",
        body: [
          "Account and business information can include names, email addresses, phone numbers, business addresses, locations, staff access, service menus, operating hours, policies and connection settings.",
          "Service records can include caller/customer contact information, messages, appointment details, call metadata, summaries, transcripts, notes and recordings where enabled and appropriately authorized. Payment and subscription records can include provider references, plan, billing contact, status and transaction history. Card details entered in Square's secure form are handled by Square; our checkout does not receive raw card numbers.",
          "Technical information can include network and device information, authentication events, service logs and support correspondence needed to operate and secure the platform.",
        ],
      },
      {
        title: "How information is used",
        body: [
          "We process information to provide the requested front-desk functions, authenticate accounts, manage permissions, maintain service records, process platform billing, respond to support requests and protect the service. AI providers process relevant conversation and business context to deliver the configured receptionist functions.",
          "Salons should provide only information needed for those functions. Do not place payment-card numbers, passwords or unnecessary sensitive information in menus, notes, messages or agent instructions.",
        ],
      },
      {
        title: "Service providers and disclosure",
        body: [
          "Hosting/database, voice/AI, telephony/messaging, payment and support providers may process relevant information to deliver the service. The current technical stack includes Lovable/Supabase infrastructure, ElevenLabs, Twilio and Square, with additional AI processing through configured providers. Actual use depends on the feature and account configuration.",
          "We may disclose information when required by law, to respond to lawful requests, to protect rights and security, or as part of a business transaction subject to appropriate safeguards. Staff and service providers should receive information appropriate to their role and the service they perform.",
        ],
      },
      {
        title: "Retention and security",
        body: [
          "Retention varies by record type, configuration, provider and legal or operational need. Closing an account may not immediately erase backups, transaction records or information that must be retained. Contact us to confirm available retention controls and deletion procedures for your account; plan examples are not proof of an active deletion schedule.",
          "We use access controls and server-side credential handling to limit unauthorized access. No system can promise absolute security. Report suspected exposure promptly and do not send credentials through a support message.",
        ],
      },
      {
        title: "Your choices and requests",
        body: [
          "You can ask about access, correction, deletion, restriction or export of your information by contacting support@salonagentai.com. Rights depend on applicable law and the context of the processing. We may verify identity and direct a request about a salon's client records to that salon.",
          "Use the opt-out instructions in a text to stop that sender's messages. Browser controls can manage cookies and local storage, though blocking necessary storage may prevent sign-in or saved setup. See our Cookie Policy and Messaging Policy.",
        ],
      },
      {
        title: "International processing, children and updates",
        body: [
          "Service providers may process information in countries other than yours. Businesses with specific data-location or cross-border requirements should confirm them with us before uploading data and request appropriate contractual terms.",
          "The platform is intended for adult business users, not accounts for children. Salons remain responsible for appropriate handling of information about their own clients, including minors. We may update this policy and will identify its latest revision date.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie & storage policy",
    summary: "The storage used for account security, checkout and a smoother setup experience.",
    sections: [
      {
        title: "Necessary storage",
        body: [
          "The platform uses browser storage and cookies for authentication/session continuity, checkout recovery, your selected salon/location and saved setup preferences. The checkout session cookie is used to retrieve the same purchase instead of starting a duplicate payment. Browser-local preview data helps you return to your business setup.",
        ],
      },
      {
        title: "Connected services",
        body: [
          "Embedded payment or voice services may use their own storage when loaded. Square's payment form and the voice demonstration are subject to the relevant providers' privacy and storage practices. Third-party storage behavior can vary with browser settings and provider updates.",
        ],
      },
      {
        title: "Your controls",
        body: [
          "You can inspect or clear cookies and local storage in your browser. Clearing them may sign you out or remove an unfinished local preview. If you already submitted a payment, contact support rather than starting another purchase solely because you cleared your browser data.",
          "Google Analytics loads only after you select Allow analytics. It measures visits to public pages; account, checkout and dashboard routes are excluded from our page-view tracking. Choose Essential only or reopen Cookie preferences in the footer to stop future analytics collection in this browser. Existing cookies can be cleared using browser controls.",
        ],
      },
    ],
  },
  {
    slug: "acceptable-use",
    title: "Acceptable use policy",
    summary: "Standards that protect salons, their customers and the platform.",
    sections: [
      {
        title: "Permitted use",
        body: [
          "Use Salon Pro Agent for authorized business communications and salon operations. Keep account access limited to people authorized for the relevant business and location. Provide accurate business details and honor customer communication choices.",
        ],
      },
      {
        title: "Prohibited activity",
        body: [
          "Do not use the platform for fraud, impersonation, harassment, unlawful discrimination, deceptive offers, illegal goods or services, or communications that violate applicable law or carrier requirements. Do not send unsolicited bulk marketing or conceal the identity of the business sending a message.",
          "Do not upload malware, attempt to obtain another user's records, expose credentials, evade usage or permission controls, test others' systems without authorization, or interfere with the availability of the platform.",
        ],
      },
      {
        title: "Sensitive information and AI",
        body: [
          "Do not request payment-card details verbally through the agent or place them in transcripts and notes. Use an approved hosted payment workflow. Do not instruct the agent to make unsupported promises, invent availability or conceal a failed action.",
          "The service is not intended for emergency dispatch, regulated professional advice or decisions about eligibility for essential services. Keep appropriate human oversight over customer complaints, safety issues and uncertain outcomes.",
        ],
      },
      {
        title: "Enforcement",
        body: [
          "We may investigate reports, restrict affected features or suspend access to protect customers and service integrity. Provider/carrier enforcement may also apply. Contact support@salonagentai.com to report misuse or discuss a restriction.",
        ],
      },
    ],
  },
  {
    slug: "messaging-policy",
    title: "Messaging & SMS policy",
    summary: "Consent, customer choice and responsible salon text messaging.",
    sections: [
      {
        title: "Business identity and purpose",
        body: [
          "Messages sent for a salon must identify the appropriate business and reflect a purpose the recipient reasonably understands. Message categories can include requested booking links, appointment confirmations, reminders and customer support. Marketing messages require separate consideration and the consent required by applicable law and provider policies.",
        ],
      },
      {
        title: "Consent and opt-out",
        body: [
          "The salon is responsible for collecting and documenting appropriate permission before sending messages. Marketing consent must not be assumed from a phone call, appointment or consent to transactional reminders, and must not be made a condition of purchase where prohibited.",
          "Recipients can reply STOP to opt out and HELP for assistance where supported. Other clear revocation requests should also be honored. Opt-out may prevent further automated texts from that sender, including reminders. A salon should provide another way to manage an appointment.",
        ],
      },
      {
        title: "Frequency and charges",
        body: [
          "Message frequency varies with appointments, requests and enabled automations. Message and data rates may apply to the recipient under their mobile plan. Salon Pro Agent plan allowances measure SMS segments; long messages and certain characters may count as multiple segments.",
        ],
      },
      {
        title: "Registration, delivery and data",
        body: [
          "Business registration and carrier approval may be required before messaging can launch. Delivery is not guaranteed and should be checked before assuming a client received a message. Unlawful or unwanted messaging is prohibited.",
          "Recipient numbers, message content, consent and opt-out state should be used to operate the authorized messaging service. Do not disclose or repurpose opt-in information for another party's unrelated marketing. For privacy questions contact the salon or support@salonagentai.com.",
        ],
      },
    ],
  },
  {
    slug: "ai-call-policy",
    title: "AI & call recording policy",
    summary:
      "How to use an AI receptionist with clear expectations and appropriate human oversight.",
    sections: [
      {
        title: "AI receptionist",
        body: [
          "Salon Pro Agent uses an automated voice or text assistant to respond using configured business information and available tools. The salon should clearly identify the use of an AI assistant to customers. AI can make mistakes; it is not a substitute for human handling of urgent, sensitive or disputed matters.",
        ],
      },
      {
        title: "Calls, transcripts and recordings",
        body: [
          "Call metadata, transcripts and summaries may be processed to deliver the receptionist and conversation history. Audio recording is a separate setting and depends on enabled providers and applicable requirements. Recording availability must not be assumed from the presence of a call record.",
          "Before enabling recording, the salon must determine and provide the notices and consent required for the participants and jurisdictions involved. This can include callers located outside the salon's state. Do not rely only on the salon's physical location to determine recording rules.",
        ],
      },
      {
        title: "Control and retention",
        body: [
          "Limit access to recordings and transcripts to appropriately authorized staff. Confirm actual retention and deletion settings during launch. A described retention target is not a guarantee that every provider or backup has already applied it.",
          "Keep a human contact or fallback route available. Review representative calls and verify services, prices, calendar actions and transfers. Do not ask the assistant to collect full card details or make an unconfirmed booking sound completed.",
        ],
      },
    ],
  },
  {
    slug: "cancellation-refunds",
    title: "Cancellation & refunds",
    summary: "How to request changes, cancel a subscription or raise a billing concern.",
    sections: [
      {
        title: "Cancel a subscription",
        body: [
          "Email support@salonagentai.com or call 520-551-1113 with your salon name and account email. State that you want to cancel and request confirmation of the effective date. Do not include passwords or card numbers. Deleting the browser app, disconnecting a phone or clearing cookies does not itself cancel a subscription.",
          "For monthly subscriptions, request cancellation before the next renewal. Unless your accepted order or applicable law provides otherwise, cancellation stops future renewal and access continues through the paid period. Support should confirm the change rather than leave you to infer it from a missing screen.",
        ],
      },
      {
        title: "Setup services and refunds",
        body: [
          "Custom Setup & Launch is a separate one-time service. If you cancel before launch, contact us to discuss the work already performed, any third-party commitments and the applicable refund under your order and law. We do not publish a blanket no-refund promise for work that has not been reviewed.",
          "Report duplicate, incorrect or unauthorized charges promptly so they can be investigated. Refund eligibility and timing depend on the facts, the applicable agreement, law and payment provider. A refund does not necessarily cancel an active subscription; request both when needed.",
        ],
      },
      {
        title: "Phone numbers and your records",
        body: [
          "Before closing an account, discuss exports, call/text records and any number transfer you need. Do not cancel an existing carrier or release a number until the intended transfer is confirmed. Outstanding usage or third-party obligations may still apply as disclosed in your order.",
        ],
      },
    ],
  },
  {
    slug: "data-processing",
    title: "Data processing overview",
    summary: "How salon customer data fits into the service relationship.",
    sections: [
      {
        title: "Roles and instructions",
        body: [
          "The salon typically determines the purposes of processing its customer and staff information. Salon Pro Agent LLC processes relevant information to deliver the salon's configured service. For account administration, platform billing and our own security obligations, we may have independent responsibilities.",
          "The service can process contact details, appointments, messages, call metadata, transcripts, permitted recordings and salon instructions. Do not upload categories of sensitive information the service is not designed to handle.",
        ],
      },
      {
        title: "Providers, access and assistance",
        body: [
          "Relevant infrastructure, AI, telephony and payment providers support processing. Location membership, application permissions and server-side credentials help restrict access. Contact us to confirm the current provider list, data-location requirements or a security incident affecting your information.",
          "We will work with the account owner on applicable access, export and deletion requests, subject to identity checks, technical capabilities and legal retention duties. Salons should route their own client requests appropriately.",
        ],
      },
      {
        title: "Written data processing agreement",
        body: [
          "This overview is not a signed data processing addendum or a certification of compliance with a particular law. If your organization needs a DPA, transfer terms, subprocessors schedule or specific retention commitments, request the appropriate written agreement before sending data subject to those requirements.",
        ],
      },
    ],
  },
];
