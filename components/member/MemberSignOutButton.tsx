"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";
import { clearChatCacheForUser } from "@/lib/chat-storage";

export function MemberSignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="text-right">
    <button type="button" disabled={busy} className="min-h-11 rounded-xl border border-primary/20 px-4 py-2 text-sm text-primary"
      onClick={async () => {
        setBusy(true);
        setError("");
        try {
          const client = createBrowserClient();
          const { data } = await client.auth.getSession();
          const { error: signOutError } = await client.auth.signOut({ scope: "local" });
          if (signOutError) throw signOutError;
          clearChatCacheForUser(data.session?.user.id);
          window.location.replace("/login");
        } catch {
          setError("未能登出，請再試。");
          setBusy(false);
        }
      }}>
      {busy ? "登出中…" : "登出"}
    </button>
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
