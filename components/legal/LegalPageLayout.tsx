import type { ReactNode } from "react";
import Link from "next/link";

type LegalPageLayoutProps = {
  eyebrow: string;
  title: string;
  lede: string;
  lastUpdated: string;
  children: ReactNode;
};

const LEGAL_LINKS = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-of-service", label: "Terms of Service" },
  { href: "/data-deletion", label: "Data Deletion" },
];

export function LegalPageLayout({
  eyebrow,
  title,
  lede,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <main className="min-h-screen bg-primary-pale px-5 py-8 text-slate-800 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[32px] border border-primary/10 bg-white/90 p-6 shadow-sm sm:p-10">
          <div className="flex flex-col gap-5 border-b border-primary/10 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <a
                href="https://edenclinic.hk"
                className="inline-flex min-h-11 items-center rounded-full border border-primary/15 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                EDEN TCM Clinic
              </a>
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                  {eyebrow}
                </p>
                <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-primary sm:text-5xl">
                  {title}
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  {lede}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-primary-light/60 p-4 sm:w-[240px]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                Quick Links
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {LEGAL_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6 py-6 sm:py-8">{children}</div>

          <div className="flex flex-col gap-3 border-t border-primary/10 pt-6 text-sm leading-6 text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-800">EDEN TCM Clinic (醫天圓中醫診所)</p>
              <p>Email: drleungeden@gmail.com</p>
            </div>
            <p>Last updated: {lastUpdated}</p>
          </div>
        </div>
      </div>
    </main>
  );
}

type LegalSectionProps = {
  title: string;
  children: ReactNode;
};

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="rounded-3xl border border-primary/10 bg-primary-light/25 p-5 sm:p-6">
      <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-base leading-7 text-slate-700">{children}</div>
    </section>
  );
}
