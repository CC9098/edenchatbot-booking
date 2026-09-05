"use client";

/* eslint-disable @next/next/no-img-element -- Chat attachments use expiring URLs and local blob previews. */

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  FileText,
  Loader2,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  Reply,
  Search,
  Send,
  Stethoscope,
  UserCheck,
  WifiOff,
  X,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase-browser";
import {
  mergeEdenMessages,
  mergeEdenConversationPages,
  STAGE_LABELS,
  validateConversationAttachment,
  type ConversationActor,
  type EdenConversation,
  type EdenMessage,
} from "@/lib/eden-conversations";
import { resolveChatwootWorkbenchReplyParent } from "@/lib/staff-chatwoot-workbench";
import { buildStaffPatientMessageText } from "@/lib/staff-patient-messages";
import { NursePatientMessageClient } from "@/components/staff/NursePatientMessageClient";
import { CLINIC_BY_ID, PHYSICAL_CLINIC_IDS } from "@/shared/clinic-data";
import styles from "./EdenConversationsClient.module.css";

type InboxData = {
  conversations: EdenConversation[];
  actor: ConversationActor;
  inboxes: { id: number; name: string }[];
  nextPage: number | null;
};
type DetailData = {
  conversation: EdenConversation;
  messages: EdenMessage[];
  nextBefore: number | null;
  hasMore: boolean;
  doctors: { id: number; name: string }[];
  actor: ConversationActor;
};
const VIEWS = [
  ["all", "全部"],
  ["reply", "待回覆"],
  ["unread", "未讀"],
  ["mine", "我跟進"],
  ["doctor", "待醫師"],
  ["done", "已完成"],
];
const QUICK_REPLIES = [
  "你好，請問有咩可以幫你？",
  "收到，正向醫師查詢，稍後回覆你。",
  "請問想預約邊日、咩時間？",
  "請問今次係本人定家人預約？",
  "收到，多謝你。",
];
const clinics = PHYSICAL_CLINIC_IDS.map((id) => ({
  id,
  nameZh: CLINIC_BY_ID[id].nameZh,
}));
const loginHref = () =>
  `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
const time = (value: number | string | null) =>
  value
    ? new Date(
        typeof value === "number" ? value * 1000 : value,
      ).toLocaleTimeString("zh-HK", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "";
const day = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("zh-HK", {
        month: "long",
        day: "numeric",
      })
    : "";
function storeDraft(key: string, value: string) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    /* Private browsing may disable storage. */
  }
}
function getDraft(key: string) {
  try {
    return sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let response = await fetch(url, { ...init, cache: "no-store" });
  if (response.status === 401) {
    const { data } = await createBrowserClient().auth.refreshSession();
    if (data.session)
      response = await fetch(url, { ...init, cache: "no-store" });
    if (response.status === 401) {
      window.location.replace(loginHref());
      throw new Error("請重新登入 Eden。");
    }
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "暫時未能完成，請再試。");
  return data as T;
}

export function EdenConversationsClient() {
  const [actor, setActor] = useState<ConversationActor | null>(null);
  const [conversations, setConversations] = useState<EdenConversation[]>([]);
  const [inboxes, setInboxes] = useState<InboxData["inboxes"]>([]);
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [inbox, setInbox] = useState("");
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [active, setActive] = useState<EdenConversation | null>(null);
  const [contactHistory, setContactHistory] = useState<
    NonNullable<EdenConversation["contactHistory"]>
  >([]);
  const [messages, setMessages] = useState<EdenMessage[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [doctors, setDoctors] = useState<DetailData["doctors"]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [reply, setReply] = useState<EdenMessage | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [menu, setMenu] = useState(false);
  const [quickReplies, setQuickReplies] = useState(false);
  const [drawer, setDrawer] = useState<
    "handover" | "doctor" | "tools" | "followup" | null
  >(null);
  const [handover, setHandover] = useState({
    summary: "",
    nextStep: "",
    dueAt: "",
  });
  const [doctorId, setDoctorId] = useState("");
  const anchorAttempted = useRef<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const actorRef = useRef<ConversationActor | null>(null);
  const listSequence = useRef(0);
  const listPages = useRef(new Map<number, EdenConversation[]>());
  const listBusy = useRef(false);
  const detailBusy = useRef(false);
  const sendLock = useRef(false);
  const sendRequest = useRef<{ id: string; fingerprint: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const stayAtBottom = useRef(true);
  const draftKey = useRef("");
  const notificationEnabled = useRef(false);
  const drawerRef = useRef<HTMLElement>(null);
  const seenAssignments = useRef<Map<number, string>>(new Map());
  const seenIncoming = useRef<Map<number, number> | null>(null);
  const focusMessage = useRef<number | null>(null);
  const sw = useRef<ServiceWorkerRegistration | null>(null);

  const notify = useCallback((incoming: EdenConversation[]) => {
    if (seenIncoming.current && notificationEnabled.current) {
      incoming.forEach((c) => {
        const newMessage =
          c.lastIncomingId > (seenIncoming.current!.get(c.id) || 0) && c.unread;
        const newAssignment =
          c.stage === "doctor" &&
          c.state.doctorId === actorRef.current?.agentId &&
          c.state.revision !== seenAssignments.current.get(c.id);
        if (
          (newMessage || newAssignment) &&
          (document.hidden || c.id !== activeRef.current)
        ) {
          const options = {
            body: newAssignment ? "有對話交俾你跟進。" : "有新訊息需要查看。",
            tag: `eden-conversation-${c.id}`,
            icon: "/logo-eden.png",
            data: { url: `/conversations?id=${c.id}` },
          };
          if (sw.current)
            void sw.current
              .showNotification("Eden 對話", options)
              .catch(() => {});
          else if (
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const note = new Notification("Eden 對話", options);
            note.onclick = () => {
              window.focus();
              selectConversation(c.id);
              note.close();
            };
          }
        }
      });
    }
    const next = seenIncoming.current || new Map<number, number>();
    incoming.forEach((c) => {
      next.set(c.id, Math.max(next.get(c.id) || 0, c.lastIncomingId));
      seenAssignments.current.set(c.id, c.state.revision || "");
    });
    seenIncoming.current = next;
    // selectConversation only uses stable setters and refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadList = useCallback(
    async (page = 1, quiet = false) => {
      const sequence = ++listSequence.current;
      if (!quiet) setLoadingList(true);
      try {
        const params = new URLSearchParams({
          view,
          page: String(page),
          q: query,
          inbox,
        });
        const data = await api<InboxData>(`/api/staff/conversations?${params}`);
        if (sequence !== listSequence.current) return;
        actorRef.current = data.actor;
        setActor(data.actor);
        setInboxes(data.inboxes);
        notify(data.conversations);
        if (page === 1 && !quiet) listPages.current.clear();
        listPages.current.set(page, data.conversations);
        setConversations(
          mergeEdenConversationPages(listPages.current, Boolean(query.trim())),
        );
        setNextPage((previous) => (quiet ? previous : data.nextPage));
        setListError("");
        setOffline(false);
      } catch (cause) {
        if (sequence === listSequence.current)
          setListError(
            cause instanceof Error ? cause.message : "未能載入對話。",
          );
      } finally {
        if (sequence === listSequence.current) setLoadingList(false);
      }
    },
    [view, query, inbox, notify],
  );

  const loadDetail = useCallback(
    async (id: number, before?: number, initial = false) => {
      try {
        const data = await api<DetailData>(
          `/api/staff/conversations/${id}${before ? `?before=${before}` : ""}`,
        );
        if (activeRef.current !== id) return;
        setActor(data.actor);
        actorRef.current = data.actor;
        setActive(data.conversation);
        setDoctors(data.doctors);
        setMessages((previous) =>
          initial ? data.messages : mergeEdenMessages(previous, data.messages),
        );
        if (initial || before)
          setNextBefore(data.hasMore ? data.nextBefore : null);
        if (initial) {
          const key = `eden.conversation.draft:${data.actor.id}:${id}:reply`;
          draftKey.current = key;
          setText(getDraft(key));
        }
        setOffline(false);
        if (!before && data.conversation.unread && !document.hidden) {
          void api<{ conversation: EdenConversation }>(
            `/api/staff/conversations/${id}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "read",
                revision: data.conversation.state.revision || "",
              }),
            },
          )
            .then((result) => {
              if (activeRef.current === id)
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === id
                      ? { ...c, unread: result.conversation.unread }
                      : c,
                  ),
                );
            })
            .catch(() => {});
        }
      } catch (cause) {
        if (activeRef.current === id) {
          setError(cause instanceof Error ? cause.message : "未能載入訊息。");
          setOffline(true);
        }
      } finally {
        if (activeRef.current === id) setLoadingChat(false);
      }
    },
    [],
  );

  function selectConversation(
    id: number | null,
    history: EdenConversation["contactHistory"] = [],
  ) {
    activeRef.current = id;
    setActiveId(id);
    setActive(null);
    setContactHistory(history);
    setMessages([]);
    setText("");
    setReply(null);
    setFile(null);
    setError("");
    setInternal(false);
    setMenu(false);
    setDrawer(null);
    setNextBefore(null);
    draftKey.current = "";
    stayAtBottom.current = true;
    sendRequest.current = null;
    window.history.replaceState(
      null,
      "",
      id ? `/conversations?id=${id}` : "/conversations",
    );
  }

  useEffect(() => {
    createBrowserClient();
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("id"));
    if (VIEWS.some(([id]) => id === params.get("view")))
      setView(params.get("view")!);
    focusMessage.current = Number(params.get("messageId")) || null;
    if (Number.isSafeInteger(id) && id > 0) {
      activeRef.current = id;
      setActiveId(id);
    }
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/eden-conversations-sw.js", { scope: "/conversations" })
        .then((r) => {
          sw.current = r;
        })
        .catch(() => {});
    const goOnline = () => {
      setOffline(false);
      void loadList();
      if (activeRef.current) void loadDetail(activeRef.current);
    };
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
    // Initial URL and network listeners are mounted once; polling uses the latest filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    seenIncoming.current = null;
    listPages.current.clear();
    void loadList();
    return () => {
      // Invalidate requests from the old filter; this ref is a sequence, not a DOM node.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      listSequence.current++;
    };
  }, [loadList]);
  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (!navigator.onLine || listBusy.current) return;
      listBusy.current = true;
      try {
        await loadList(1, true);
      } finally {
        listBusy.current = false;
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [loadList]);
  useEffect(() => {
    if (!activeId) return;
    setLoadingChat(true);
    void loadDetail(activeId, undefined, true);
    const timer = window.setInterval(async () => {
      if (!navigator.onLine || detailBusy.current || document.hidden) return;
      detailBusy.current = true;
      try {
        await loadDetail(activeId);
      } finally {
        detailBusy.current = false;
      }
    }, 5000);
    const refresh = () => {
      if (!document.hidden) void loadDetail(activeId);
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [activeId, loadDetail]);
  useEffect(() => {
    notificationEnabled.current = notifications;
  }, [notifications]);
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setFileUrl("");
  }, [file]);
  useLayoutEffect(() => {
    if (stayAtBottom.current) bottom.current?.scrollIntoView({ block: "end" });
    if (
      focusMessage.current &&
      messages.some((m) => m.id === focusMessage.current)
    ) {
      document
        .getElementById(`eden-message-${focusMessage.current}`)
        ?.scrollIntoView({ block: "center" });
      focusMessage.current = null;
      stayAtBottom.current = false;
    }
  }, [messages]);
  useEffect(() => {
    if (
      focusMessage.current &&
      activeId &&
      !loadingChat &&
      anchorAttempted.current !== focusMessage.current &&
      !messages.some((m) => m.id === focusMessage.current)
    ) {
      anchorAttempted.current = focusMessage.current;
      void loadDetail(activeId, focusMessage.current + 1);
    }
  }, [activeId, loadingChat, messages, loadDetail]);

  useEffect(() => {
    if (!drawer) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const panel = drawerRef.current;
    panel
      ?.querySelector<HTMLElement>("button, input, textarea, select")
      ?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending && !busy) {
        setDrawer(null);
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const targets = [
        ...panel.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled):not([hidden]), textarea:not(:disabled), select:not(:disabled), a[href]",
        ),
      ].filter((el) => el.offsetParent !== null);
      const first = targets[0],
        last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [drawer, sending, busy]);

  function requestFor(fingerprint: string, storageKey: string) {
    let existing = sendRequest.current;
    try {
      existing = JSON.parse(getDraft(storageKey)) || existing;
    } catch {}
    const request =
      existing?.fingerprint === fingerprint
        ? existing
        : { fingerprint, id: crypto.randomUUID() };
    sendRequest.current = request;
    storeDraft(storageKey, JSON.stringify(request));
    return request.id;
  }
  function changeText(value: string) {
    setText(value);
    if (draftKey.current) storeDraft(draftKey.current, value);
  }
  function changeMode(value: boolean) {
    setInternal(value);
    setReply(null);
    const key = `eden.conversation.draft:${actor?.id}:${activeId}:${value ? "note" : "reply"}`;
    draftKey.current = key;
    setText(getDraft(key));
  }
  function chooseFile(value?: File) {
    if (!value) return;
    const error = validateConversationAttachment(value);
    if (error) {
      setError(error);
      return;
    }
    setFile(value);
    setError("");
  }
  async function action(type: string, values: Record<string, unknown> = {}) {
    if (!active || busy) return;
    const id = active.id;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ conversation: EdenConversation }>(
        `/api/staff/conversations/${id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            revision: active.state.revision || "",
            ...values,
          }),
        },
      );
      if (activeRef.current === id) {
        setActive(result.conversation);
        setDrawer(null);
        setMenu(false);
      }
      void loadList(1, true);
      void loadDetail(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "未能更新。");
      void loadDetail(id);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!active || (!text.trim() && !file) || sendLock.current || offline)
      return;
    const id = active.id;
    if (!internal && !active.canReply) {
      setDrawer("followup");
      return;
    }
    sendLock.current = true;
    setSending(true);
    setError("");
    const currentDraft = draftKey.current;
    const fingerprint = JSON.stringify([
      id,
      text.trim(),
      internal,
      reply?.id,
      file?.name,
      file?.size,
    ]);
    const requestKey = `eden.conversation.request:${actor?.id}:${id}`;
    const requestId = requestFor(fingerprint, requestKey);
    try {
      let init: RequestInit;
      if (file) {
        const body = new FormData();
        body.set("content", text);
        body.set("private", String(internal));
        body.set("requestId", requestId);
        body.set("attachment", file);
        if (reply) body.set("replyTo", String(reply.id));
        init = { method: "PUT", body };
      } else
        init = {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: text,
            private: internal,
            requestId,
            ...(reply ? { replyTo: reply.id } : {}),
          }),
        };
      const result = await api<{ message: EdenMessage }>(
        `/api/staff/conversations/${id}`,
        init,
      );
      if (activeRef.current === id) {
        stayAtBottom.current = true;
        setMessages((previous) =>
          mergeEdenMessages(previous, [result.message]),
        );
        if (draftKey.current === currentDraft) {
          setText((previous) => (previous === text ? "" : previous));
          setReply(null);
          setFile(null);
        }
        textarea.current?.focus();
      }
      if (getDraft(currentDraft) === text) storeDraft(currentDraft, "");
      sendRequest.current = null;
      storeDraft(requestKey, "");
      void loadList(1, true);
    } catch (cause) {
      if (activeRef.current === id)
        setError(cause instanceof Error ? cause.message : "未能發送。");
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }
  async function sendFollowup() {
    if (!active || sending || !text.trim()) return;
    const id = active.id;
    setSending(true);
    setError("");
    const requestKey = `eden.conversation.request:${actor?.id}:${id}`;
    const requestId = requestFor(`followup:${id}:${text}`, requestKey);
    try {
      await api(`/api/staff/conversations/${id}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, requestId }),
      });
      if (activeRef.current === id) {
        changeText("");
        setDrawer(null);
      }
      sendRequest.current = null;
      storeDraft(requestKey, "");
      await loadDetail(id);
      void loadList(1, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "未能發送跟進訊息。");
    } finally {
      setSending(false);
    }
  }
  async function older() {
    if (!activeId || !nextBefore || loadingOlder) return;
    setLoadingOlder(true);
    stayAtBottom.current = false;
    const previousHeight = scroller.current?.scrollHeight || 0;
    await loadDetail(activeId, nextBefore);
    requestAnimationFrame(() => {
      if (scroller.current)
        scroller.current.scrollTop +=
          scroller.current.scrollHeight - previousHeight;
    });
    setLoadingOlder(false);
  }
  async function toggleNotifications() {
    if (notifications) {
      setNotifications(false);
      return;
    }
    if (!("Notification" in window)) {
      setListError("此瀏覽器未支援通知；對話開啟時會自動更新。");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotifications(permission === "granted");
    if (permission !== "granted")
      setListError("可喺瀏覽器設定開啟 Eden 通知。");
  }
  async function logout() {
    await createBrowserClient().auth.signOut({ scope: "local" });
    try {
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith("eden.conversation."))
          sessionStorage.removeItem(key);
    } catch {}
    window.location.replace("/login?next=%2Fconversations");
  }
  const lastId = messages.at(-1)?.id;
  const followupPreview = buildStaffPatientMessageText({
    purpose: "follow_up",
    patientName: active?.name || "",
    clinicNameZh: "醫天圓中醫診所",
    note: text,
  });
  return (
    <main className={styles.app} data-version="eden-conversations-v1">
      <aside
        className={`${styles.sidebar} ${activeId ? styles.sidebarHidden : ""}`}
      >
        <header className={styles.sidebarHeader}>
          <Link
            href={actor?.role === "doctor" ? "/doctor" : "/nurse"}
            className={styles.brand}
          >
            <span>
              <MessageCircle size={23} />
            </span>
            <div>
              <h1>Eden 對話</h1>
              <p>{actor?.name || "正在連接"}</p>
            </div>
          </Link>
          <div className={styles.headerActions}>
            <button
              onClick={() => void toggleNotifications()}
              aria-label={notifications ? "關閉通知" : "開啟通知"}
              title="頁面開啟時通知"
            >
              {notifications ? <Bell size={19} /> : <BellOff size={19} />}
            </button>
            <button
              onClick={() => void logout()}
              aria-label="切換員工"
              title="切換員工"
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>
        <div className={styles.search}>
          <Search size={18} />
          <input
            aria-label="搜尋姓名或電話"
            placeholder="搜尋姓名或電話"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button aria-label="清除搜尋" onClick={() => setSearch("")}>
              <X size={16} />
            </button>
          )}
        </div>
        {inboxes.length > 1 && (
          <select
            aria-label="診所"
            className={styles.inboxSelect}
            value={inbox}
            onChange={(e) => setInbox(e.target.value)}
          >
            <option value="">所有診所</option>
            {inboxes.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        )}
        <nav className={styles.filters} aria-label="對話分類">
          {VIEWS.map(([id, name]) => (
            <button
              key={id}
              aria-pressed={view === id}
              className={view === id ? styles.selectedFilter : ""}
              onClick={() => setView(id)}
            >
              {name}
            </button>
          ))}
        </nav>
        {listError && (
          <div className={styles.listError} role="status">
            {listError}
            <button onClick={() => void loadList()}>重試</button>
          </div>
        )}
        <div className={styles.list} aria-busy={loadingList}>
          {loadingList && conversations.length === 0 ? (
            <div className={styles.empty}>
              <Loader2 className={styles.spin} />
              載入對話
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                className={`${styles.conversation} ${c.id === activeId || (query.trim() && c.contactId > 0 && c.contactId === active?.contactId) ? styles.activeConversation : ""}`}
                onClick={() => selectConversation(c.id, c.contactHistory)}
                aria-label={`${c.name}，${STAGE_LABELS[c.stage]}${c.unread ? "，未讀" : ""}`}
              >
                <span className={styles.avatar}>{c.name.slice(0, 1)}</span>
                <span className={styles.conversationText}>
                  <span className={styles.row}>
                    <strong>{c.name}</strong>
                    <time>{time(c.updatedAt)}</time>
                  </span>
                  {query.trim() && c.phone && (
                    <span className={styles.contactPhone}>{c.phone}</span>
                  )}
                  <span className={styles.row}>
                    <span className={styles.preview}>{c.preview}</span>
                    {c.unread && (
                      <span className={styles.unread} aria-label="未讀" />
                    )}
                  </span>
                  <span className={styles.row}>
                    <span className={`${styles.stage} ${styles[c.stage]}`}>
                      {c.bot ? "自動回覆中" : STAGE_LABELS[c.stage]}
                    </span>
                    <small>{c.assigneeName}</small>
                  </span>
                </span>
              </button>
            ))
          )}
          {!loadingList && !conversations.length && (
            <div className={styles.empty}>
              <MessageCircle size={34} />
              <p>{query ? "未找到相符聯絡人" : "暫時冇呢類對話"}</p>
            </div>
          )}
          {nextPage && (
            <button
              className={styles.loadMore}
              disabled={loadingList}
              onClick={() => void loadList(nextPage)}
            >
              {loadingList
                ? "載入中…"
                : query.trim()
                  ? "載入更多聯絡人"
                  : "載入更多對話"}
            </button>
          )}
        </div>
        <footer className={styles.listFooter}>
          <span className={offline ? styles.offlineDot : styles.onlineDot} />
          {offline ? "等候重新連線" : "自動更新"}
          <Link href="/nurse/messages/new">
            <Plus size={15} />
            新訊息
          </Link>
        </footer>
      </aside>
      <section
        className={`${styles.chat} ${!activeId ? styles.chatHidden : ""}`}
        aria-label="病人對話"
      >
        {!activeId ? (
          <div className={styles.welcome}>
            <span>
              <MessageCircle size={48} strokeWidth={1.3} />
            </span>
            <h2>Eden 對話</h2>
            <p>揀一段對話，開始跟進。</p>
          </div>
        ) : (
          <>
            <header className={styles.chatHeader}>
              <button
                className={styles.back}
                aria-label="返回對話清單"
                onClick={() => selectConversation(null)}
              >
                <ArrowLeft size={22} />
              </button>
              <span className={`${styles.avatar} ${styles.smallAvatar}`}>
                {active?.name.slice(0, 1) || "…"}
              </span>
              <div className={styles.contactHeading}>
                <h2>{active?.name || "載入中…"}</h2>
                <p>
                  {active?.phone}{" "}
                  {active && <span>· {active.assigneeName}</span>}
                </p>
              </div>
              <div className={styles.headerActions}>
                {active && (
                  <button
                    className={styles.claim}
                    disabled={busy}
                    onClick={() => void action("claim")}
                  >
                    <UserCheck size={17} />
                    <span>
                      {active.state.ownerId === actor?.id
                        ? "我跟進中"
                        : "我接手"}
                    </span>
                  </button>
                )}
                <button
                  aria-label="更多操作"
                  aria-expanded={menu}
                  onClick={() => setMenu(!menu)}
                >
                  <MoreHorizontal size={22} />
                </button>
              </div>
              {menu && (
                <div className={styles.menu}>
                  <button
                    onClick={() => {
                      setDrawer("doctor");
                      setMenu(false);
                    }}
                  >
                    <Stethoscope size={18} />
                    交俾醫師
                  </button>
                  <button
                    onClick={() => {
                      setHandover({
                        summary: active?.state.handover?.summary || "",
                        nextStep: active?.state.handover?.nextStep || "",
                        dueAt: active?.state.handover?.dueAt || "",
                      });
                      setDrawer("handover");
                      setMenu(false);
                    }}
                  >
                    <ClipboardList size={18} />
                    交更
                  </button>
                  <button
                    onClick={() => {
                      setDrawer("tools");
                      setMenu(false);
                    }}
                  >
                    <Plus size={18} />
                    預約及收費
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void action("stage", { stage: "patient" })}
                  >
                    等病人回覆
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void action("stage", {
                        stage: active?.stage === "done" ? "reply" : "done",
                      })
                    }
                  >
                    <CheckCheck size={18} />
                    {active?.stage === "done" ? "重新跟進" : "標記完成"}
                  </button>
                </div>
              )}
            </header>
            {active && (
              <div className={styles.contextBar}>
                <span className={`${styles.stage} ${styles[active.stage]}`}>
                  {STAGE_LABELS[active.stage]}
                </span>
                <span>
                  {active.bot
                    ? "自動回覆中 · 接手後由同事回覆"
                    : active.state.doctorName && active.stage === "doctor"
                      ? `${active.state.doctorName} 待覆`
                      : active.inboxName}
                </span>
                {contactHistory.length > 1 && (
                  <select
                    className={styles.historySelect}
                    aria-label="對話紀錄"
                    value={activeId || ""}
                    disabled={sending || busy}
                    onChange={(event) =>
                      selectConversation(
                        Number(event.target.value),
                        contactHistory,
                      )
                    }
                  >
                    {contactHistory.map((c) => (
                      <option key={c.id} value={c.id}>
                        {"對話紀錄 · "}
                        {new Date(c.updatedAt * 1000).toLocaleString("zh-HK", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                        {` · ${STAGE_LABELS[c.stage]}${inboxes.length > 1 ? ` · ${c.inboxName}` : ""}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {active?.state.handover && (
              <details className={styles.handoverCard} open>
                <summary>
                  <ClipboardList size={15} />
                  交更事項<span>{active.state.handover.by}</span>
                </summary>
                <p>{active.state.handover.summary}</p>
                <p>
                  <strong>下一步：</strong>
                  {active.state.handover.nextStep}
                </p>
                {active.state.handover.dueAt && (
                  <small>
                    跟進時間：
                    {new Date(active.state.handover.dueAt).toLocaleString(
                      "zh-HK",
                    )}
                  </small>
                )}
              </details>
            )}
            {offline && (
              <div className={styles.connection} role="status">
                <WifiOff size={16} />
                等候重新連線 · 草稿已保留
              </div>
            )}
            <div
              className={styles.messages}
              ref={scroller}
              onScroll={() => {
                const el = scroller.current;
                if (el)
                  stayAtBottom.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 100;
              }}
            >
              {loadingChat && (
                <div className={styles.empty}>
                  <Loader2 className={styles.spin} />
                  載入訊息
                </div>
              )}
              {nextBefore && (
                <button
                  className={styles.older}
                  disabled={loadingOlder}
                  onClick={() => void older()}
                >
                  {loadingOlder ? "載入中…" : "較早訊息"}
                </button>
              )}
              {messages.map((m, index) => {
                const parent = resolveChatwootWorkbenchReplyParent(
                  { messages },
                  m,
                );
                return (
                  <div key={m.id}>
                    {(index === 0 ||
                      day(m.createdAt) !==
                        day(messages[index - 1].createdAt)) && (
                      <div className={styles.date}>
                        <span>{day(m.createdAt)}</span>
                      </div>
                    )}
                    <div
                      id={`eden-message-${m.id}`}
                      className={`${styles.messageRow} ${m.direction === "outgoing" ? styles.outgoing : ""} ${m.private ? styles.noteRow : ""}`}
                    >
                      <article
                        className={`${styles.bubble} ${m.private ? styles.note : ""}`}
                      >
                        {m.direction === "outgoing" && (
                          <div className={styles.sender}>
                            {m.private ? "內部備註 · " : ""}
                            {m.senderName}
                          </div>
                        )}
                        {(m.replyToMessageId || m.replyToExternalId) && (
                          <button
                            className={styles.quote}
                            onClick={() => {
                              const target = parent?.id || m.replyToMessageId;
                              if (target) {
                                focusMessage.current = target;
                                if (parent)
                                  document
                                    .getElementById(`eden-message-${target}`)
                                    ?.scrollIntoView({ block: "center" });
                                else if (activeId)
                                  void loadDetail(activeId, target + 1);
                              }
                            }}
                          >
                            <strong>
                              {parent?.direction === "incoming"
                                ? active?.name
                                : "診所"}
                            </strong>
                            <span>{parent?.content || "查看較早訊息"}</span>
                          </button>
                        )}
                        {m.content && (
                          <div className={styles.messageContent}>
                            <ReactMarkdown
                              components={{
                                a: ({ children, href }) => (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {children}
                                  </a>
                                ),
                              }}
                            >
                              {m.content}
                            </ReactMarkdown>
                          </div>
                        )}
                        {m.attachments.map((a) =>
                          a.fileType === "image" ? (
                            <a
                              key={a.id}
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.imageAttachment}
                            >
                              <img src={a.url} alt="訊息圖片" loading="lazy" />
                            </a>
                          ) : a.fileType === "audio" ? (
                            <audio
                              key={a.id}
                              controls
                              preload="none"
                              src={a.url}
                            />
                          ) : a.fileType === "video" ? (
                            <video
                              key={a.id}
                              controls
                              preload="metadata"
                              src={a.url}
                            />
                          ) : (
                            <a
                              key={a.id}
                              className={styles.fileAttachment}
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileText size={22} />
                              {a.label || "開啟附件"}
                            </a>
                          ),
                        )}
                        <footer className={styles.messageMeta}>
                          <time>{time(m.createdAt)}</time>
                          {m.direction === "outgoing" &&
                            !m.private &&
                            (m.status === "failed" ? (
                              <span className={styles.failed}>未送出</span>
                            ) : m.status === "read" ? (
                              <CheckCheck
                                size={16}
                                color="#168fc1"
                                aria-label="病人已讀"
                              />
                            ) : m.status === "delivered" ? (
                              <CheckCheck size={16} aria-label="已送達" />
                            ) : (
                              <Check size={16} aria-label="已提交" />
                            ))}
                        </footer>
                      </article>
                      {!m.private && (
                        <button
                          className={styles.replyButton}
                          aria-label={`引用訊息 ${m.id}`}
                          onClick={() => {
                            if (internal) changeMode(false);
                            setReply(m);
                            textarea.current?.focus();
                          }}
                        >
                          <Reply size={17} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!loadingChat && !messages.length && (
                <div className={styles.empty}>未有訊息</div>
              )}
              <div ref={bottom} data-last-message={lastId} />
            </div>
            {error && (
              <div role="alert" className={styles.error}>
                {error}
                <button aria-label="關閉提示" onClick={() => setError("")}>
                  <X size={17} />
                </button>
              </div>
            )}
            <div
              className={`${styles.composer} ${internal ? styles.internalComposer : ""}`}
            >
              <div className={styles.composerModes}>
                <button
                  aria-pressed={!internal}
                  onClick={() => changeMode(false)}
                >
                  回覆病人
                </button>
                <button
                  aria-pressed={internal}
                  onClick={() => changeMode(true)}
                >
                  內部備註
                </button>
                <button
                  className={styles.quickToggle}
                  aria-expanded={quickReplies}
                  onClick={() => setQuickReplies(!quickReplies)}
                >
                  常用回覆
                  <ChevronDown size={13} />
                </button>
              </div>
              {quickReplies && (
                <div className={styles.quickReplies}>
                  {QUICK_REPLIES.map((value) => (
                    <button
                      key={value}
                      onClick={() => {
                        changeText(value);
                        setQuickReplies(false);
                        textarea.current?.focus();
                      }}
                    >
                      {value}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      changeText(
                        `你好，可以喺以下連結選擇預約時間：\n${window.location.origin}/booking-whatsapp`,
                      );
                      setQuickReplies(false);
                    }}
                  >
                    預約連結
                  </button>
                </div>
              )}
              {reply && (
                <div className={styles.replyPreview}>
                  <Reply size={16} />
                  <div>
                    <strong>
                      {reply.direction === "incoming"
                        ? active?.name
                        : reply.senderName}
                    </strong>
                    <p>{reply.content || "附件"}</p>
                  </div>
                  <button aria-label="取消引用" onClick={() => setReply(null)}>
                    <X size={17} />
                  </button>
                </div>
              )}
              {file && (
                <div className={styles.filePreview}>
                  {file.type.startsWith("image/") && fileUrl ? (
                    <img src={fileUrl} alt="待發送圖片" />
                  ) : (
                    <FileText size={30} />
                  )}
                  <span>{file.name}</span>
                  <button aria-label="移除附件" onClick={() => setFile(null)}>
                    <X size={18} />
                  </button>
                </div>
              )}
              {active && !active.canReply && !internal && (
                <p className={styles.windowHint}>
                  先發送跟進訊息；病人回覆後，就可以直接聊天。
                </p>
              )}
              <div className={styles.inputRow}>
                <button
                  className={styles.attach}
                  aria-label="加入附件"
                  disabled={sending || (!internal && !active?.canReply)}
                  onClick={() => attachmentInput.current?.click()}
                >
                  <Paperclip size={23} />
                </button>
                <input
                  ref={attachmentInput}
                  type="file"
                  hidden
                  accept="image/jpeg,image/png,application/pdf,audio/mpeg,audio/mp4,audio/aac,audio/ogg,video/mp4"
                  onChange={(e) => {
                    chooseFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <textarea
                  ref={textarea}
                  aria-label={internal ? "內部備註" : "輸入訊息"}
                  placeholder={internal ? "只供同事查看" : "輸入訊息"}
                  value={text}
                  maxLength={!internal && !active?.canReply ? 900 : 2000}
                  disabled={!active || sending}
                  rows={1}
                  onChange={(e) => {
                    changeText(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                  }}
                  onPaste={(e) => {
                    const image = [...e.clipboardData.items].find((i) =>
                      i.type.startsWith("image/"),
                    );
                    if (image) {
                      const f = image.getAsFile();
                      if (f) {
                        e.preventDefault();
                        chooseFile(f);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing &&
                      window.matchMedia("(pointer:fine)").matches
                    ) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <button
                  className={styles.send}
                  aria-label={
                    internal
                      ? "儲存內部備註"
                      : !active?.canReply
                        ? "預覽跟進訊息"
                        : "發送訊息"
                  }
                  disabled={
                    !active || sending || offline || (!text.trim() && !file)
                  }
                  onClick={() => void send()}
                >
                  {sending ? (
                    <Loader2 size={22} className={styles.spin} />
                  ) : (
                    <Send size={22} />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      {drawer && active && (
        <div
          className={styles.overlay}
          onClick={() => !sending && setDrawer(null)}
        >
          <section
            ref={drawerRef}
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label={
              drawer === "handover"
                ? "交更"
                : drawer === "doctor"
                  ? "交俾醫師"
                  : drawer === "followup"
                    ? "跟進訊息預覽"
                    : "預約及收費"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <h2>
                {drawer === "handover"
                  ? "交更"
                  : drawer === "doctor"
                    ? "交俾醫師"
                    : drawer === "followup"
                      ? "跟進訊息預覽"
                      : "預約及收費"}
              </h2>
              <button
                aria-label="關閉"
                disabled={sending}
                onClick={() => setDrawer(null)}
              >
                <X />
              </button>
            </header>
            <p className={styles.drawerContact}>
              {active.name} · {active.phone}
            </p>
            {drawer === "handover" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action("handover", handover);
                }}
              >
                <label>
                  跟進事項
                  <textarea
                    required
                    maxLength={500}
                    value={handover.summary}
                    onChange={(e) =>
                      setHandover({ ...handover, summary: e.target.value })
                    }
                    placeholder="病人需要乜、已經處理到邊"
                  />
                </label>
                <label>
                  下一步
                  <textarea
                    required
                    maxLength={500}
                    value={handover.nextStep}
                    onChange={(e) =>
                      setHandover({ ...handover, nextStep: e.target.value })
                    }
                    placeholder="下一更要做乜"
                  />
                </label>
                <label>
                  跟進時間
                  <input
                    type="datetime-local"
                    value={handover.dueAt}
                    onChange={(e) =>
                      setHandover({ ...handover, dueAt: e.target.value })
                    }
                  />
                </label>
                <button className={styles.primary} disabled={busy}>
                  儲存並交下一更
                </button>
              </form>
            )}
            {drawer === "doctor" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action("doctor", { doctorId: Number(doctorId) });
                }}
              >
                <label>
                  醫師
                  <select
                    required
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                  >
                    <option value="">揀醫師</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!doctors.length && <p>暫時未有可轉交嘅醫師。</p>}
                <button className={styles.primary} disabled={busy || !doctorId}>
                  轉交
                </button>
              </form>
            )}
            {drawer === "tools" && (
              <div className={styles.tools}>
                <NursePatientMessageClient
                  clinics={clinics}
                  formOnly
                  prefill={{
                    contactId: active.contactId,
                    conversationId: active.id,
                    patientName: active.name,
                    phone: active.phone,
                  }}
                />
              </div>
            )}
            {drawer === "followup" && (
              <>
                <div className={styles.followupPreview}>{followupPreview}</div>
                <button
                  className={styles.primary}
                  disabled={sending || !text.trim() || Boolean(file)}
                  onClick={() => void sendFollowup()}
                >
                  {sending ? "發送中…" : "發送跟進訊息"}
                </button>
                {file && <p>跟進訊息未能附加檔案，請先移除附件。</p>}
              </>
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
