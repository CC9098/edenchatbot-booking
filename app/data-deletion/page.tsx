import type { Metadata } from "next";
import { LegalPageLayout, LegalSection } from "@/components/legal/LegalPageLayout";
import { buildPublicUrl } from "@/lib/public-url";

export const metadata: Metadata = {
  title: "Data Deletion Instructions | EDEN TCM Clinic",
  description:
    "Instructions for requesting deletion of personal data submitted to EDEN TCM Clinic through WhatsApp, Meta Business tools, Chatwoot, or website enquiries.",
  alternates: {
    canonical: buildPublicUrl("/data-deletion"),
  },
};

export default function DataDeletionPage() {
  return (
    <LegalPageLayout
      eyebrow="Meta Business Compliance"
      title="Data Deletion Instructions"
      lede="If you want EDEN TCM Clinic to delete personal data provided through WhatsApp, Meta Business tools, Chatwoot, or related booking enquiries, follow the steps below."
      lastUpdated="March 8, 2026"
    >
      <LegalSection title="1. How to submit a request">
        <p>
          Email your request to{" "}
          <a className="font-semibold text-primary hover:underline" href="mailto:drleungeden@gmail.com">
            drleungeden@gmail.com
          </a>{" "}
          with the subject line <span className="font-semibold text-slate-900">Data Deletion Request</span>.
        </p>
      </LegalSection>

      <LegalSection title="2. What to include">
        <ul className="list-disc space-y-2 pl-5">
          <li>Your full name.</li>
          <li>Your phone number or WhatsApp number used to contact the clinic.</li>
          <li>Your email address, if relevant.</li>
          <li>A short description of the conversation, booking, or record you want deleted.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Verification and response time">
        <p>
          We may ask for additional details to verify that the request is made by the correct person. After
          verification, we aim to respond within 30 days.
        </p>
      </LegalSection>

      <LegalSection title="4. Important limitation">
        <p>
          We may retain limited records where necessary for legal obligations, dispute handling, accounting,
          fraud prevention, or clinic administration.
        </p>
      </LegalSection>

      <LegalSection title="5. Related policy">
        <p>
          For more information about how we handle personal data, please review our{" "}
          <a className="font-semibold text-primary hover:underline" href="/privacy-policy">
            Privacy Policy
          </a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
