"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertTriangle, Check, Loader2, Upload } from "lucide-react";

type FormState = Record<string, string>;

const initialForm: FormState = {
  patientChineseName: "",
  patientEnglishName: "",
  whatsapp: "",
  email: "",
  country: "",
  city: "",
  timezone: "",
  preferredDate: "",
  preferredTime: "",
  alternateTimes: "",
  recipientName: "",
  recipientPhone: "",
  addressLine1: "",
  addressLine2: "",
  shippingCity: "",
  shippingRegion: "",
  postalCode: "",
  shippingCountry: "",
  mainConcern: "",
  symptomDuration: "",
  firstVisit: "",
  pregnant: "",
  postpartum: "",
  postpartumDuration: "",
  breastfeeding: "",
  chronicIllness: "",
  medications: "",
  supplements: "",
  drugAllergy: "",
  foodAllergy: "",
  surgeryHistory: "",
  paymentPayerName: "",
  paymentTime: "",
  paymentNotes: "",
};

const emergencyOptions = [
  "劇痛",
  "發燒",
  "出血",
  "胸痛",
  "呼吸困難",
  "嚴重頭暈或昏厥",
  "嚴重情緒問題或自殺念頭",
  "懷孕高危情況",
  "產後大量出血",
  "病情突然惡化",
  "其他需要即時醫療處理的情況",
];

const consentOptions = [
  "我明白 HKD$400 為海外網診基本費，不包括中藥費、行政費、香港郵政郵費及海外當地費用。",
  "我明白中藥費需由醫師診症後，按實際處方及配藥日數確認。",
  "我明白如需海外寄送，另需支付海外郵寄行政費 HKD$250。",
  "我明白香港郵政實際郵費需待藥物配好後確認，診所會先代付並寄出，之後我需補付實際郵費。",
  "我明白包裹到達海外後，當地關稅、VAT／GST、清關費、郵政處理費或其他費用需由本人自行支付。",
  "我明白海外寄送中藥／草本產品存在延誤、扣查、退件、沒收或銷毀風險，相關風險由本人自行承擔。",
  "我明白本服務不適合急症或嚴重疾病。如有急症、嚴重不適或病情惡化，我會先在當地立即求醫。",
  "我確認所提供資料真實準確，並同意診所按以上安排處理預約、網診及後續寄送事宜。",
];

function fieldClassName(hasError?: boolean) {
  return `mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-4 ${
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-red-100"
      : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-100"
  }`;
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = true,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      {label}
      <input
        className={fieldClassName()}
        name={name}
        value={value}
        onChange={onChange}
        type={type}
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
}

function Textarea({
  label,
  name,
  value,
  onChange,
  required = true,
  rows = 3,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  required?: boolean;
  rows?: number;
}) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      {label}
      <textarea
        className={fieldClassName()}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        rows={rows}
      />
    </label>
  );
}

function Select({
  label,
  name,
  value,
  onChange,
  options,
  required = true,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      {label}
      <select className={fieldClassName()} name={name} value={value} onChange={onChange} required={required}>
        <option value="">請選擇</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

export default function OverseasConsultationForm() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [emergencyFlags, setEmergencyFlags] = useState<string[]>([]);
  const [consents, setConsents] = useState<string[]>([]);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const allConsentsChecked = consents.length === consentOptions.length;
  const hasEmergencyFlag = emergencyFlags.length > 0;

  const whatsappCopy = useMemo(() => {
    if (!successId) return "";
    return [
      "您好，我們已收到您的海外網診預約資料及付款證明。",
      "",
      "我們會先核對資料及付款狀態，然後再為您確認視像／電話網診時間。",
      "",
      "提提您：HKD$400 為海外網診基本費，未包括中藥費、海外郵寄行政費、香港郵政郵費及海外當地清關／稅項／處理費。",
      "",
      "醫師診症後，如建議配藥，我們會再通知您實際中藥費及建議配藥日數。如需海外寄送，另收海外郵寄行政費 HKD$250。",
      "",
      "如您現時有急症、嚴重不適或病情突然惡化，請先在當地立即求醫。",
      "",
      `申請編號：${successId}`,
    ].join("\n");
  }, [successId]);

  function updateText(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleArrayValue(value: string, current: string[], setter: (next: string[]) => void) {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!paymentProof) {
      setError("請上載付款證明。");
      return;
    }

    if (paymentProof.size > 10 * 1024 * 1024) {
      setError("付款證明不可超過 10MB。");
      return;
    }

    if (!allConsentsChecked) {
      setError("請確認所有費用、寄送及急症提醒。");
      return;
    }

    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    body.append(
      "healthData",
      JSON.stringify({
        mainConcern: form.mainConcern,
        symptomDuration: form.symptomDuration,
        firstVisit: form.firstVisit,
        pregnant: form.pregnant,
        postpartum: form.postpartum,
        postpartumDuration: form.postpartumDuration,
        breastfeeding: form.breastfeeding,
        chronicIllness: form.chronicIllness,
        medications: form.medications,
        supplements: form.supplements,
        drugAllergy: form.drugAllergy,
        foodAllergy: form.foodAllergy,
        surgeryHistory: form.surgeryHistory,
      }),
    );
    body.append("emergencyFlags", JSON.stringify(emergencyFlags));
    body.append("consentConfirmations", JSON.stringify(consents));
    body.append("paymentProof", paymentProof);

    setSubmitting(true);
    try {
      const response = await fetch("/api/overseas-consultation", {
        method: "POST",
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "提交失敗，請稍後再試。");
      }
      setSuccessId(payload.submissionId);
      setForm(initialForm);
      setEmergencyFlags([]);
      setConsents([]);
      setPaymentProof(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失敗，請稍後再試。");
    } finally {
      setSubmitting(false);
    }
  }

  if (successId) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-emerald-800">
          <Check className="h-5 w-5" />
          <h2 className="text-xl font-semibold text-slate-950">感謝您的預約申請</h2>
        </div>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          我們已收到您的海外網診預約資料及付款證明。診所職員會核對資料及付款狀態，並透過 WhatsApp 或 Email 與您確認網診時間。
        </p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-950">申請編號：{successId}</p>
          <p className="mt-2">HKD$400 為海外網診基本費。中藥費、行政費、香港郵政郵費及海外當地費用另計。</p>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-800">
          姑娘 WhatsApp 回覆文字
          <textarea className={fieldClassName()} value={whatsappCopy} readOnly rows={9} />
        </label>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Section title="基本資料">
        <Field label="病人中文姓名" name="patientChineseName" value={form.patientChineseName} onChange={updateText} />
        <Field label="病人英文姓名" name="patientEnglishName" value={form.patientEnglishName} onChange={updateText} required={false} />
        <Field label="WhatsApp 電話" name="whatsapp" value={form.whatsapp} onChange={updateText} />
        <Field label="Email" name="email" value={form.email} onChange={updateText} type="email" />
        <Field label="所在國家" name="country" value={form.country} onChange={updateText} />
        <Field label="所在城市" name="city" value={form.city} onChange={updateText} />
        <Field label="時區" name="timezone" value={form.timezone} onChange={updateText} placeholder="例：GMT+8 / UK / US Pacific" />
        <Field label="首選網診日期" name="preferredDate" value={form.preferredDate} onChange={updateText} type="date" />
        <Field label="首選網診時間" name="preferredTime" value={form.preferredTime} onChange={updateText} type="time" />
        <Textarea label="可接受的其他時段" name="alternateTimes" value={form.alternateTimes} onChange={updateText} required={false} />
      </Section>

      <Section title="收件資料">
        <Field label="收件人姓名" name="recipientName" value={form.recipientName} onChange={updateText} />
        <Field label="收件電話" name="recipientPhone" value={form.recipientPhone} onChange={updateText} />
        <Field label="收件地址第一行" name="addressLine1" value={form.addressLine1} onChange={updateText} />
        <Field label="收件地址第二行" name="addressLine2" value={form.addressLine2} onChange={updateText} required={false} />
        <Field label="城市" name="shippingCity" value={form.shippingCity} onChange={updateText} />
        <Field label="州／省／地區" name="shippingRegion" value={form.shippingRegion} onChange={updateText} required={false} />
        <Field label="郵政編碼" name="postalCode" value={form.postalCode} onChange={updateText} required={false} />
        <Field label="國家" name="shippingCountry" value={form.shippingCountry} onChange={updateText} />
        <p className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          請確保收件資料準確。若因地址錯誤導致延誤、退件或額外費用，需由收件人自行承擔。
        </p>
      </Section>

      <Section title="健康資料">
        <Textarea label="主要想調理的問題" name="mainConcern" value={form.mainConcern} onChange={updateText} />
        <Field label="症狀持續多久" name="symptomDuration" value={form.symptomDuration} onChange={updateText} />
        <Select label="是否第一次向本診所求診" name="firstVisit" value={form.firstVisit} onChange={updateText} options={["是", "否"]} />
        <Select label="是否懷孕" name="pregnant" value={form.pregnant} onChange={updateText} options={["是", "否", "不適用"]} />
        <Select label="是否產後" name="postpartum" value={form.postpartum} onChange={updateText} options={["是", "否", "不適用"]} />
        <Field label="如產後，產後多久" name="postpartumDuration" value={form.postpartumDuration} onChange={updateText} required={false} />
        <Select label="是否正在哺乳" name="breastfeeding" value={form.breastfeeding} onChange={updateText} options={["是", "否", "不適用"]} />
        <Textarea label="是否有長期病" name="chronicIllness" value={form.chronicIllness} onChange={updateText} required={false} />
        <Textarea label="是否正在服用西藥" name="medications" value={form.medications} onChange={updateText} required={false} />
        <Textarea label="是否正在服用保健品或其他草本產品" name="supplements" value={form.supplements} onChange={updateText} required={false} />
        <Textarea label="是否有藥物敏感" name="drugAllergy" value={form.drugAllergy} onChange={updateText} required={false} />
        <Textarea label="是否有食物敏感" name="foodAllergy" value={form.foodAllergy} onChange={updateText} required={false} />
        <Textarea label="是否有手術史或重大疾病史" name="surgeryHistory" value={form.surgeryHistory} onChange={updateText} required={false} />
      </Section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">急症篩查</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {emergencyOptions.map((option) => (
            <label key={option} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700"
                checked={emergencyFlags.includes(option)}
                onChange={() => toggleArrayValue(option, emergencyFlags, setEmergencyFlags)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {hasEmergencyFlag ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>您所描述的情況可能需要即時醫療檢查或急症處理。請先在當地立即求醫。本海外網診服務不適合處理急症或嚴重疾病。</p>
          </div>
        ) : null}
      </section>

      <Section title="付款資料">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
          <p className="font-semibold">海外網診基本費：HKD$400</p>
          <p className="mt-1">請完成付款後上載證明。接受 jpg、png、pdf，最大 10MB。</p>
        </div>
        <label className="block text-sm font-medium text-slate-800">
          上載付款證明
          <span className="mt-1 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50">
            <Upload className="mb-2 h-5 w-5 text-emerald-700" />
            {paymentProof ? paymentProof.name : "選擇付款證明"}
            <input
              className="sr-only"
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              required
              onChange={(event) => setPaymentProof(event.target.files?.[0] || null)}
            />
          </span>
        </label>
        <Field label="付款人姓名" name="paymentPayerName" value={form.paymentPayerName} onChange={updateText} />
        <Field label="付款時間" name="paymentTime" value={form.paymentTime} onChange={updateText} placeholder="例：2026-06-04 14:30" />
        <Textarea label="備註" name="paymentNotes" value={form.paymentNotes} onChange={updateText} required={false} />
      </Section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">同意確認</h2>
        <div className="mt-4 space-y-2">
          {consentOptions.map((option, index) => (
            <label key={option} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700"
                checked={consents.includes(option)}
                onChange={() => toggleArrayValue(option, consents, setConsents)}
              />
              <span>{index + 1}. {option}</span>
            </label>
          ))}
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={submitting || !allConsentsChecked}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        提交海外網診預約
      </button>
    </form>
  );
}
