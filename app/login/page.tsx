"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { createBrowserClient } from "@/lib/supabase-browser";
import {
  buildGoogleOAuthOptions,
  getWebAuthCallbackUrl,
  sanitizeAuthNextPath,
} from "@/lib/auth-redirect";

type LoginMethod = "whatsapp" | "google" | "email";
type EmailAuthMode = "signin" | "signup";
type WhatsAppStep = "phone" | "otp";

function mapSignUpError(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("email rate limit") ||
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("rate limit")
  ) {
    return "確認信發送太頻密，請約 60 秒後再試。";
  }
  if (normalized.includes("password")) {
    return "密碼格式未符合要求，請使用更強密碼後再試。";
  }
  return "註冊失敗，請稍後再試。";
}

function mapResendError(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("email rate limit") ||
    normalized.includes("over_email_send_rate_limit") ||
    normalized.includes("rate limit")
  ) {
    return "確認信發送太頻密，請稍候再重發。";
  }
  return "重發確認信失敗，請稍後再試。";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error") === "auth";
  const nextPath = sanitizeAuthNextPath(searchParams.get("next"));
  const isStaffConsoleEntry =
    nextPath === "/doctor" ||
    nextPath.startsWith("/doctor/") ||
    nextPath.startsWith("/doctor?") ||
    nextPath === "/nurse" ||
    nextPath.startsWith("/nurse/") ||
    nextPath.startsWith("/nurse?");

  const defaultMethod: LoginMethod = isStaffConsoleEntry ? "google" : "whatsapp";
  const [activeMethod, setActiveMethod] = useState<LoginMethod>(defaultMethod);

  // WhatsApp OTP state
  const [waPhone, setWaPhone] = useState("");
  const [waStep, setWaStep] = useState<WhatsAppStep>("phone");
  const [waMaskedPhone, setWaMaskedPhone] = useState("");
  const [waCode, setWaCode] = useState("");
  const [waCooldown, setWaCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Email state
  const [emailAuthMode, setEmailAuthMode] = useState<EmailAuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);

  // Shared state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        if (active && session?.user) {
          router.replace(nextPath);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        router.replace(nextPath);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [nextPath, router]);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  function startCooldown(seconds = 60) {
    setWaCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setWaCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function clearMessages() {
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function switchMethod(method: LoginMethod) {
    setActiveMethod(method);
    clearMessages();
    setPendingConfirmationEmail(null);
    setWaStep("phone");
    setWaCode("");
  }

  // WhatsApp OTP — send code
  async function handleRequestOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearMessages();
    const trimmedPhone = waPhone.trim();
    if (!trimmedPhone) {
      setErrorMessage("請輸入 WhatsApp 電話號碼。");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/phone/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmedPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "發送驗證碼失敗，請稍後再試。");
      } else {
        setWaMaskedPhone(data.maskedPhone || trimmedPhone);
        setWaStep("otp");
        setSuccessMessage(data.message || "驗證碼已發送。");
        startCooldown(60);
      }
    } catch {
      setErrorMessage("網絡錯誤，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  // WhatsApp OTP — verify code
  async function handleVerifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearMessages();
    if (!waCode.trim()) {
      setErrorMessage("請輸入驗證碼。");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: waPhone.trim(), code: waCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "驗證失敗，請再試。");
      } else {
        setSuccessMessage("登入成功，正在跳轉...");
        // Reload so Supabase SSR picks up the new cookie.
        window.location.replace(nextPath);
      }
    } catch {
      setErrorMessage("網絡錯誤，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (waCooldown > 0 || loading) return;
    clearMessages();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/phone/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: waPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "重發驗證碼失敗。");
      } else {
        setSuccessMessage("驗證碼已重新發送。");
        startCooldown(60);
      }
    } catch {
      setErrorMessage("網絡錯誤，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    clearMessages();
    setLoading(true);
    const supabase = createBrowserClient();

    if (Capacitor.isNativePlatform()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: buildGoogleOAuthOptions(nextPath, true),
      });
      if (error || !data?.url) {
        setErrorMessage("Google 登入失敗，請稍後再試。");
        setLoading(false);
        return;
      }
      try {
        await Browser.open({ url: data.url });
      } catch {
        setErrorMessage("無法開啟 Google 登入頁面，請稍後再試。");
        setLoading(false);
      }
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: buildGoogleOAuthOptions(nextPath),
    });
    if (error) {
      setErrorMessage("Google 登入失敗，請稍後再試。");
      setLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    clearMessages();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setErrorMessage("請輸入電郵及密碼。");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("密碼至少需要 8 個字元。");
      return;
    }

    setLoading(true);
    const supabase = createBrowserClient();

    if (emailAuthMode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        setErrorMessage("電郵或密碼不正確，請再試一次。");
      } else {
        setSuccessMessage("登入成功，正在跳轉...");
        setPendingConfirmationEmail(null);
        router.replace(nextPath);
      }
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: { emailRedirectTo: getWebAuthCallbackUrl(nextPath) },
    });

    if (error) {
      setErrorMessage(mapSignUpError(error.message));
      setLoading(false);
      return;
    }

    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setErrorMessage(
        "此電郵可能已經註冊。請直接用「電郵登入」；如果之前用 Google 開戶，請用 Google 登入。",
      );
      setPendingConfirmationEmail(null);
      setLoading(false);
      return;
    }

    if (!data.session) {
      setSuccessMessage("註冊成功，請到電郵收取確認信後完成驗證。");
      setPendingConfirmationEmail(trimmedEmail);
      setLoading(false);
      return;
    }

    setSuccessMessage("註冊成功，已自動登入。");
    setPendingConfirmationEmail(null);
    router.replace(nextPath);
    setLoading(false);
  }

  async function handleResendConfirmationEmail() {
    if (!pendingConfirmationEmail) return;
    clearMessages();
    setLoading(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingConfirmationEmail,
      options: { emailRedirectTo: getWebAuthCallbackUrl(nextPath) },
    });
    if (error) {
      setErrorMessage(mapResendError(error.message));
    } else {
      setSuccessMessage("確認信已重新發送，請檢查收件箱及垃圾郵件。");
    }
    setLoading(false);
  }

  const tabs: { key: LoginMethod; label: string }[] = isStaffConsoleEntry
    ? [
        { key: "google", label: "Google 登入" },
        { key: "email", label: "電郵登入" },
      ]
    : [
        { key: "whatsapp", label: "WhatsApp" },
        { key: "google", label: "Google" },
        { key: "email", label: "電郵" },
      ];

  return (
    <div className="patient-pane flex min-h-[calc(100dvh-130px)] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white shadow-sm">
            醫
          </div>
          <h1 className="text-2xl font-bold text-primary">醫天圓</h1>
          <p className="text-sm text-slate-500">Eden TCM Clinic</p>
        </div>

        {/* Card */}
        <div className="patient-card space-y-6 p-8">
          <div className={`text-center ${isStaffConsoleEntry ? "space-y-3" : ""}`}>
            <h2 className="text-lg font-semibold text-slate-900">
              {isStaffConsoleEntry ? "登入 staff 控制台" : "登入帳號"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isStaffConsoleEntry ? "登入後直接進入醫師 / 姑娘工作台" : "選擇登入方式以繼續"}
            </p>
            {isStaffConsoleEntry && (
              <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 px-4 py-4 text-left shadow-[0_8px_24px_rgba(8,145,178,0.08)]">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <p className="text-sm font-semibold text-slate-800">staff 專用入口</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["病人列表", "語音記錄", "內容管理", "姑娘代約"].map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-cyan-100"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Method tabs */}
          <div
            className={`grid gap-2 rounded-full bg-slate-100 p-1`}
            style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchMethod(tab.key)}
                className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  activeMethod === tab.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Alerts */}
          {(authError || errorMessage) && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {authError ? "登入失敗，請重新嘗試。" : errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </div>
          )}

          {/* ── WhatsApp OTP ── */}
          {activeMethod === "whatsapp" && waStep === "phone" && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="wa-phone" className="text-sm font-medium text-gray-700">
                  WhatsApp 電話號碼
                </label>
                <input
                  id="wa-phone"
                  type="tel"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  autoComplete="tel"
                  required
                  placeholder="例：98765432 或 +85298765432"
                  className="w-full rounded-[16px] border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#20bd5a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "發送中..." : "發送驗證碼到 WhatsApp"}
              </button>
            </form>
          )}

          {activeMethod === "whatsapp" && waStep === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-slate-500 text-center">
                驗證碼已發送到 <span className="font-medium text-slate-800">{waMaskedPhone}</span> 的 WhatsApp
              </p>
              <div className="space-y-2">
                <label htmlFor="wa-code" className="text-sm font-medium text-gray-700">
                  6 位數驗證碼
                </label>
                <input
                  id="wa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={waCode}
                  onChange={(e) => setWaCode(e.target.value.replace(/\D/g, ""))}
                  autoComplete="one-time-code"
                  required
                  placeholder="000000"
                  className="w-full rounded-[16px] border border-slate-300 px-3 py-2.5 text-center text-lg tracking-widest text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "驗證中..." : "驗證並登入"}
              </button>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setWaStep("phone");
                    setWaCode("");
                  }}
                  className="underline hover:text-slate-700"
                >
                  更改號碼
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={waCooldown > 0 || loading}
                  className="underline hover:text-slate-700 disabled:no-underline disabled:opacity-50"
                >
                  {waCooldown > 0 ? `重發 (${waCooldown}s)` : "重發驗證碼"}
                </button>
              </div>
            </form>
          )}

          {/* ── Google ── */}
          {activeMethod === "google" && (
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-[18px] border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                  fill="#4285F4"
                />
                <path
                  d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                  fill="#34A853"
                />
                <path
                  d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
                  fill="#FBBC05"
                />
                <path
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z"
                  fill="#EA4335"
                />
              </svg>
              {loading ? "正在跳轉..." : "使用 Google 登入"}
            </button>
          )}

          {/* ── Email ── */}
          {activeMethod === "email" && (
            <>
              {emailAuthMode === "signup" && pendingConfirmationEmail && (
                <button
                  type="button"
                  onClick={handleResendConfirmationEmail}
                  disabled={loading}
                  className="w-full rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "重發中..." : "重新發送確認信"}
                </button>
              )}

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div className="grid grid-cols-2 gap-2 rounded-full bg-slate-100 p-1">
                  {(["signin", "signup"] as EmailAuthMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setEmailAuthMode(mode);
                        clearMessages();
                        setPendingConfirmationEmail(null);
                      }}
                      className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                        emailAuthMode === mode
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {mode === "signin" ? "電郵登入" : "建立帳戶"}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-gray-700">
                    電郵地址
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className="w-full rounded-[16px] border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-gray-700">
                    密碼
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={emailAuthMode === "signin" ? "current-password" : "new-password"}
                    required
                    minLength={8}
                    className="w-full rounded-[16px] border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="至少 8 個字元"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? "處理中..."
                    : emailAuthMode === "signin"
                      ? "使用電郵登入"
                      : "建立電郵帳戶"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} 醫天圓中醫診所
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-130px)] items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
