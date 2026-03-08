import type { Metadata } from "next";
import { LegalPageLayout, LegalSection } from "@/components/legal/LegalPageLayout";
import { buildPublicUrl } from "@/lib/public-url";

export const metadata: Metadata = {
  title: "Terms of Service | EDEN TCM Clinic",
  description:
    "Terms of Service for EDEN TCM Clinic messaging, booking enquiries, and Meta Business communication channels.",
  alternates: {
    canonical: buildPublicUrl("/terms-of-service"),
  },
};

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      eyebrow="Meta Business Compliance"
      title="Terms of Service"
      lede="These terms govern your use of EDEN TCM Clinic messaging channels, including WhatsApp, Meta Business tools, Chatwoot, and website enquiry forms."
      lastUpdated="March 8, 2026"
    >
      <LegalSection title="1. Service scope">
        <p>
          These channels are provided by EDEN TCM Clinic for customer service, appointment enquiries, booking
          coordination, and general clinic communication.
        </p>
        <p>
          Submitting a message does not guarantee an appointment, treatment outcome, or immediate response.
        </p>
      </LegalSection>

      <LegalSection title="2. Appropriate use">
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide accurate contact and booking information.</li>
          <li>Do not use these channels for unlawful, abusive, or misleading activity.</li>
          <li>Do not send content that infringes the rights or privacy of others.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Medical limitation">
        <p>
          Messages sent through WhatsApp, Meta Business tools, Chatwoot, or our website are for administrative
          support and general communication. They do not replace professional medical assessment, diagnosis,
          emergency care, or urgent treatment.
        </p>
        <p>
          If you have an emergency, contact emergency services or seek urgent medical attention directly.
        </p>
      </LegalSection>

      <LegalSection title="4. Third-party platforms">
        <p>
          Our communication channels rely on third-party platforms, including Meta, WhatsApp, Chatwoot, and web
          infrastructure providers. Availability, delivery speed, and message retention may depend in part on those
          services.
        </p>
      </LegalSection>

      <LegalSection title="5. Privacy">
        <p>
          Your use of these channels is also subject to our{" "}
          <a className="font-semibold text-primary hover:underline" href="/privacy-policy">
            Privacy Policy
          </a>, which explains how we collect, use, store, and process personal data.
        </p>
      </LegalSection>

      <LegalSection title="6. Changes and contact">
        <p>
          We may update these terms from time to time by posting the revised version on this page.
        </p>
        <p>
          For questions, contact{" "}
          <a className="font-semibold text-primary hover:underline" href="mailto:drleungeden@gmail.com">
            drleungeden@gmail.com
          </a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
