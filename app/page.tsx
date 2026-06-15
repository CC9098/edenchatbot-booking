import { CalendarCheck, ClipboardList, MessageCircle, MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { createServerClient } from "@/lib/supabase-server";
import { isNativeAppUserAgent } from "@/lib/platform";
import { CLINICS, DOCTORS } from "@/shared/clinic-data";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

const HOME_HERO_DOCTORS = DOCTORS.filter((doctor) => doctor.avatarSrc);
const PHYSICAL_CLINICS = CLINICS.filter((clinic) => clinic.id !== 'online');

const PATIENT_ACTIONS = [
  {
    title: '預約看診',
    href: '/booking',
    icon: CalendarCheck,
    primary: true,
  },
  {
    title: '體質諮詢',
    href: '/chat',
    icon: MessageCircle,
    primary: false,
  },
  {
    title: '管理預約',
    href: '/manage-booking',
    icon: ClipboardList,
    primary: false,
  },
] as const;

export default async function Home() {
  const userAgent = headers().get("user-agent") ?? "";
  if (isNativeAppUserAgent(userAgent)) {
    redirect("/chat");
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/chat");
  }

  return (
    <main className="min-h-screen bg-primary-pale text-slate-900">
      <section className="border-b border-primary/10 bg-white">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 pb-12 pt-7 sm:px-10 lg:min-h-[760px] lg:pb-16">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="https://edenclinic.hk"
              className="text-sm font-semibold text-primary transition hover:text-primary-hover"
            >
              醫天圓中醫診所
            </Link>
            <div className="flex items-center justify-end gap-2">
              <Link
                href="/login"
                className="inline-flex min-h-10 items-center rounded-lg border border-primary/20 bg-white px-4 text-sm font-medium text-primary shadow-sm transition hover:bg-primary-light"
              >
                登入
              </Link>
              <Link
                href="/doctor"
                className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-primary-pale hover:text-primary"
              >
                醫師入口
              </Link>
            </div>
          </div>

          <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[0.86fr_1.14fr] lg:gap-14 lg:py-16">
            <div className="max-w-xl">
              <p className="text-sm font-semibold tracking-[0.16em] text-primary">
                網上預約及病人服務
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-primary sm:text-6xl">
                醫天圓中醫診所
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
                預約看診、查看或更改預約，或先作簡單體質諮詢。
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:max-w-xl">
                {PATIENT_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      className={[
                        'group flex min-h-[74px] items-center gap-3 rounded-lg border px-4 py-3 text-left transition',
                        action.primary
                          ? 'border-primary bg-primary text-white shadow-sm hover:bg-primary-hover'
                          : 'border-primary/15 bg-white text-primary shadow-sm hover:bg-primary-light',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                          action.primary ? 'bg-white/16' : 'bg-primary-light',
                        ].join(' ')}
                      >
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <span className="whitespace-nowrap text-base font-semibold leading-tight">
                        {action.title}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600">
                <span>註冊中醫師團隊</span>
                <span className="h-1 w-1 rounded-full bg-primary/40" />
                <span>中環 / 佐敦 / 荃灣</span>
                <span className="h-1 w-1 rounded-full bg-primary/40" />
                <span>WhatsApp 預約</span>
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-primary">醫師團隊</p>
                  <p className="mt-1 text-sm text-slate-500">選擇醫師後可直接查看可預約時段</p>
                </div>
                <Link
                  href="/booking"
                  className="hidden rounded-lg border border-primary/15 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary-light sm:inline-flex"
                >
                  全部預約
                </Link>
              </div>

              <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-3 [scrollbar-width:none] sm:-mx-10 sm:px-10 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
                {HOME_HERO_DOCTORS.map((doctor) => (
                  <Link
                    key={doctor.id}
                    href={doctor.bookingUrl || "/booking"}
                    className="group relative h-52 w-36 shrink-0 overflow-hidden rounded-lg border border-primary/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:h-60 sm:w-40 lg:h-64 lg:w-auto"
                    aria-label={`預約${doctor.nameZh}`}
                  >
                    <Image
                      src={doctor.avatarSrc!}
                      alt={doctor.nameZh}
                      fill
                      priority={doctor.id === HOME_HERO_DOCTORS[0]?.id}
                      sizes="(min-width: 1024px) 160px, 42vw"
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                      style={{ objectPosition: doctor.avatarObjectPosition || "center" }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/72 via-slate-950/28 to-transparent px-3 pb-3 pt-14">
                      <p className="text-sm font-semibold leading-tight text-white">
                        {doctor.nameZh}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 py-8 sm:px-10 lg:grid-cols-3 lg:py-10">
        {PHYSICAL_CLINICS.map((clinic) => (
          <article
            key={clinic.id}
            className="rounded-lg border border-primary/10 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                <MapPin aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{clinic.nameZh}診所</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{clinic.address}</p>
                <p className="mt-3 text-sm font-medium text-primary">{clinic.contactPhone}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
