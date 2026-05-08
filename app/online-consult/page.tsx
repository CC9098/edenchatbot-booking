import OnlineConsultClient from "./OnlineConsultClient";
import { verifyOnlineConsultToken } from "@/lib/online-consult-token";

interface OnlineConsultPageProps {
  searchParams?: {
    token?: string;
  };
}

function formatAppointment(date: string, time: string) {
  const dateObj = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(dateObj.getTime())) {
    return `${date} ${time}`;
  }

  const formattedDate = new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(dateObj);

  return `${formattedDate} ${time}`;
}

export default function OnlineConsultPage({ searchParams }: OnlineConsultPageProps) {
  const token = typeof searchParams?.token === "string" ? searchParams.token : "";
  const tokenResult = token ? verifyOnlineConsultToken(token) : null;

  if (!tokenResult?.success) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-10">
        <section className="mx-auto max-w-xl rounded-md border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-emerald-800">醫天圓中醫診所</p>
          <h1 className="mt-3 text-2xl font-semibold text-stone-950">網上診症連結無效</h1>
          <p className="mt-3 text-sm leading-6 text-stone-700">
            {tokenResult?.error || "請使用 WhatsApp 預約確認訊息內的網上診症按鈕重新進入。"}
          </p>
        </section>
      </main>
    );
  }

  const payload = tokenResult.payload;

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-10">
      <section className="mx-auto max-w-xl rounded-md border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-emerald-800">醫天圓中醫診所</p>
        <h1 className="mt-3 text-2xl font-semibold text-stone-950">網上診症候診</h1>
        <div className="mt-5 space-y-2 rounded-md border border-stone-200 bg-stone-50 p-4 text-sm text-stone-800">
          <p>
            <span className="text-stone-500">醫師：</span>
            <span className="font-medium">{payload.doctorNameZh}</span>
          </p>
          <p>
            <span className="text-stone-500">時間：</span>
            <span className="font-medium">
              {formatAppointment(payload.appointmentDate, payload.appointmentTime)}
            </span>
          </p>
          <p>
            <span className="text-stone-500">預約編號：</span>
            <span className="font-medium">{payload.bookingId}</span>
          </p>
        </div>

        <div className="mt-6">
          <OnlineConsultClient token={token} meetLink={payload.meetLink} />
        </div>

        <p className="mt-5 text-sm leading-6 text-stone-600">
          如醫師未即時進入，請保持 Google Meet 開啟。系統已在你進入此頁時自動通知醫師。
        </p>
      </section>
    </main>
  );
}
