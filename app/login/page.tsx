"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

type EmailAuthMode = "signin" | "signup";

function LoginForm() {
  const searchParams = useSearchParams();
  const authError = searchParams.get("error") === "auth";
  const [activeMethod, setActiveMethod] = useState<"google" | "email">("google");
  const [emailAuthMode, setEmailAuthMode] = useState<EmailAuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      console.error("OAuth error:", error.message);
      setErrorMessage("Google 登入失敗，請稍後再試。");
      setLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

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
        console.error("Email sign-in error:", error.message);
        setErrorMessage("電郵或密碼不正確，請再試一次。");
      } else {
        setSuccessMessage("登入成功，正在跳轉...");
      }
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });

    if (error) {
      console.error("Email sign-up error:", error.message);
      setErrorMessage("註冊失敗，請稍後再試。");
      setLoading(false);
      return;
    }

    if (!data.session) {
      setSuccessMessage("註冊成功，請到電郵收取驗證信後再登入。");
      setLoading(false);
      return;
    }

    setSuccessMessage("註冊成功，已自動登入。");
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary-pale px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary text-white text-2xl font-bold">
            醫
          </div>
          <h1 className="text-2xl font-bold text-primary">醫天圓</h1>
          <p className="text-sm text-gray-500">Eden TCM Clinic</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900">登入帳號</h2>
            <p className="text-sm text-gray-500 mt-1">選擇登入方式以繼續</p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => {
                setActiveMethod("google");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeMethod === "google"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Google 登入
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMethod("email");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeMethod === "email"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              電郵登入
            </button>
          </div>

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

          {activeMethod === "google" ? (
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Google icon */}
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
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setEmailAuthMode("signin");
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    emailAuthMode === "signin"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  電郵登入
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailAuthMode("signup");
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    emailAuthMode === "signup"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  建立帳戶
                </button>
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                  autoComplete={
                    emailAuthMode === "signin" ? "current-password" : "new-password"
                  }
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="至少 8 個字元"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? "處理中..."
                  : emailAuthMode === "signin"
                    ? "使用電郵登入"
                    : "建立電郵帳戶"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
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
        <div className="min-h-screen flex items-center justify-center bg-primary-pale">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
