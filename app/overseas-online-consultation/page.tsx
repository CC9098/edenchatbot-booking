import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, ClipboardList, CreditCard, PackageCheck, Plane } from "lucide-react";

import OverseasConsultationForm from "./OverseasConsultationForm";

export const metadata: Metadata = {
  title: "海外寄藥網診服務 | 醫天圓",
  description: "海外病人可預約視像或電話中醫網診，診症後按醫師評估安排中藥或草本產品海外寄送。",
};

const steps = [
  {
    title: "預約及支付基本網診費",
    icon: CreditCard,
    body: "HKD$400，包括視像／電話中醫網診、體質分析及初步調理方向。",
  },
  {
    title: "診症後確認藥費",
    icon: ClipboardList,
    body: "醫師判斷是否適合配藥。中藥費一般約 HKD$80-100／天，海外郵寄行政費 HKD$250。",
  },
  {
    title: "配藥及香港郵政寄出",
    icon: PackageCheck,
    body: "實際郵費約 HKD$250-650，需按目的地、方式和重量由香港郵政確認。",
  },
  {
    title: "海外收件及當地費用",
    icon: Plane,
    body: "關稅、VAT／GST、清關費、郵政處理費或其他當地費用由收件人支付。",
  },
];

export default function OverseasOnlineConsultationPage() {
  return (
    <main className="min-h-screen bg-[#f7f8f3] text-slate-900">
      <section className="border-b border-emerald-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:py-14">
          <div>
            <p className="text-sm font-semibold text-emerald-800">Overseas Online Consultation & Herbal Delivery</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
              海外寄藥網診服務
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-700">
              身處海外亦可透過視像／電話方式接受香港註冊中醫師的中醫網診及體質調理建議。醫師診症後，如評估適合，可安排個人化中藥／草本調理產品及海外寄送。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#booking-form"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
              >
                立即預約海外網診
              </a>
              <a
                href="#fees"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
              >
                查看收費及寄送注意事項
              </a>
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <h2 className="text-lg font-semibold text-amber-950">急症或嚴重疾病請先在當地求醫</h2>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  劇痛、發燒、出血、胸痛、呼吸困難、嚴重情緒問題、懷孕高危、產後大量出血或病情突然惡化，請立即在當地求醫。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-3 md:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-normal text-emerald-800">Step {index + 1}</span>
                  <Icon className="h-5 w-5 text-emerald-700" />
                </div>
                <h2 className="mt-3 text-base font-semibold leading-6 text-slate-950">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="fees" className="mx-auto grid max-w-6xl gap-4 px-4 pb-8 sm:px-6 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-800">第一次費用</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">HKD$400</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">海外網診基本費。不包括中藥費、行政費、香港郵政郵費及海外當地費用。</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-800">第二次費用</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">藥費 + HKD$250</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">中藥費由醫師診症後確認，一般約 HKD$80-100／天。如需寄送，另收海外郵寄行政費。</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-800">第三次費用</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">約 HKD$250-650</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">香港郵政實際郵費由診所先代付並寄出，病人其後補付。海外當地費用由收件人支付。</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <div className="rounded-lg border border-red-100 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
            <div>
              <h2 className="text-lg font-semibold text-red-950">海外寄送注意事項</h2>
              <p className="mt-2 text-sm leading-6 text-red-900">
                中藥／草本產品寄送海外可能被當地海關扣留、延誤、退回、沒收或銷毀。診所會妥善包裝、按需要提供中英文成分說明並標示個人自用，但無法保證清關或送達。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="booking-form" className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          填寫海外網診預約資料
        </div>
        <OverseasConsultationForm />
      </section>
    </main>
  );
}
