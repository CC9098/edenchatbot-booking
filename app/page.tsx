import ChatWidget from '@/components/ChatWidget';

export default function Home() {
  return (
    <main className="relative min-h-screen bg-[#f5f9f2] text-slate-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-24 pt-20 sm:px-10 sm:pb-32 sm:pt-28">
        <div className="max-w-3xl space-y-6">
          <p className="inline-flex items-center rounded-full bg-[#e8f5e0] px-3 py-1 text-xs font-semibold text-[#2d5016]">
            醫天圓中醫診所 · 醫天圓小助手
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-[#2d5016] sm:text-5xl">
            友善的中醫診所 Chatbot Widget
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-slate-600">
            點擊右下角的浮動圓點即可開啟「醫天圓小助手」。它提供收費、診所資訊、預約、醫師時間表、表單諮詢，並預留 AI
            回答通道，為診所網站帶來即時互動體驗。
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#e8f5e0] bg-white/80 p-4 shadow-sm backdrop-blur">
              <p className="text-sm font-semibold text-[#2d5016]">決策樹邏輯</p>
              <p className="mt-2 text-sm text-slate-600">
                預設主選單 + 表單收集 + AI 後備，所有回應皆已硬編碼。
              </p>
            </div>
            <div className="rounded-2xl border border-[#e8f5e0] bg-white/80 p-4 shadow-sm backdrop-blur">
              <p className="text-sm font-semibold text-[#2d5016]">流暢動效</p>
              <p className="mt-2 text-sm text-slate-600">
                Framer Motion 支援的開啟/訊息過場，貼近 Intercom 體驗。
              </p>
            </div>
            <div className="rounded-2xl border border-[#e8f5e0] bg-white/80 p-4 shadow-sm backdrop-blur">
              <p className="text-sm font-semibold text-[#2d5016]">行動優先</p>
              <p className="mt-2 text-sm text-slate-600">
                行動裝置全螢幕模式，桌面版固定 350×600 widget。
              </p>
            </div>
          </div>
        </div>
      </div>
      <ChatWidget />
    </main>
  );
}
