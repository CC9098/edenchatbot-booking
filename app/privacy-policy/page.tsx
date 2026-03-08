import type { Metadata } from "next";
import { LegalPageLayout, LegalSection } from "@/components/legal/LegalPageLayout";
import { buildPublicUrl } from "@/lib/public-url";

export const metadata: Metadata = {
  title: "Privacy Policy | EDEN TCM Clinic",
  description:
    "Privacy Policy for EDEN TCM Clinic covering WhatsApp, Meta Business tools, Chatwoot, and appointment enquiries.",
  alternates: {
    canonical: buildPublicUrl("/privacy-policy"),
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Meta Business Compliance"
      title="Privacy Policy"
      lede="This policy explains how EDEN TCM Clinic handles personal data collected through WhatsApp, Meta Business tools, Chatwoot, and related booking or customer service channels."
      lastUpdated="March 8, 2026"
    >
      <LegalSection title="1. Who we are">
        <p>
          EDEN TCM Clinic (醫天圓中醫診所, &quot;EDEN TCM&quot;, &quot;we&quot;, &quot;our&quot;) provides traditional Chinese
          medicine consultation support, appointment handling, and customer service.
        </p>
        <p>
          If you contact us through WhatsApp, Facebook, Instagram, our website, or a Chatwoot inbox,
          this policy applies to that interaction.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we may collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>Your name, phone number, WhatsApp number, and email address if you provide them.</li>
          <li>Your message content, enquiry details, and replies sent through messaging channels.</li>
          <li>Booking-related information such as preferred branch, doctor, date, time, and service request.</li>
          <li>Basic technical or platform information that may be attached by Meta, WhatsApp, Chatwoot, or our website systems.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use your information">
        <ul className="list-disc space-y-2 pl-5">
          <li>To reply to enquiries and provide customer support.</li>
          <li>To arrange, confirm, route, reschedule, or cancel appointments.</li>
          <li>To direct your message to the appropriate clinic staff or branch.</li>
          <li>To follow up on service requests and improve our internal service workflow.</li>
          <li>To comply with applicable legal, regulatory, or record-keeping requirements.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Third-party processing">
        <p>
          Our communications may be processed through third-party services, including WhatsApp, Meta
          Business tools, Chatwoot, website hosting providers, and email service providers used by the clinic.
        </p>
        <p>
          We do not sell your personal data. We only use or share it as reasonably required to operate our
          communication and booking services.
        </p>
      </LegalSection>

      <LegalSection title="5. Retention and security">
        <p>
          We keep personal data only for as long as reasonably necessary for customer service, booking follow-up,
          clinic administration, dispute handling, or legal compliance.
        </p>
        <p>
          We apply reasonable administrative and technical measures to protect information, but no internet-based
          system can be guaranteed to be completely secure.
        </p>
      </LegalSection>

      <LegalSection title="6. Your rights and deletion requests">
        <p>
          You may request access, correction, or deletion of the personal data you provided to us. To make a
          request, email <a className="font-semibold text-primary hover:underline" href="mailto:drleungeden@gmail.com">drleungeden@gmail.com</a>.
        </p>
        <p>
          Please include your name, contact number, and enough detail for us to identify the relevant conversation
          or booking record. We may retain limited information where required for legal or administrative reasons.
        </p>
      </LegalSection>

      <LegalSection title="7. Contact">
        <p>
          For privacy enquiries, please contact EDEN TCM Clinic at{" "}
          <a className="font-semibold text-primary hover:underline" href="mailto:drleungeden@gmail.com">
            drleungeden@gmail.com
          </a>.
        </p>
        <p>
          Main website:{" "}
          <a className="font-semibold text-primary hover:underline" href="https://edenclinic.hk">
            https://edenclinic.hk
          </a>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
