"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Forward, X } from "lucide-react";
import type { EdenMessage } from "@/lib/eden-conversations";
import {
  forwardDeliveryLabel,
  type WhatsappForwardDoctor,
  type WhatsappForwardPreview,
  type WhatsappForwardResult,
} from "@/lib/eden-whatsapp-forward";
import styles from "./EdenConversationsClient.module.css";

type Props = {
  conversationId: number;
  actorId: string;
  message: EdenMessage;
  onClose: () => void;
  request: <T>(url: string, init?: RequestInit) => Promise<T>;
};

export function WhatsappForwardDialog({
  conversationId,
  actorId,
  message,
  onClose,
  request,
}: Props) {
  const [doctors, setDoctors] = useState<WhatsappForwardDoctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [preview, setPreview] = useState<WhatsappForwardPreview | null>(null);
  const [result, setResult] = useState<WhatsappForwardResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const lock = useRef(false);
  const panel = useRef<HTMLElement>(null);
  const requestIds = useRef(new Map<string, string>());
  const base = `/api/staff/conversations/${conversationId}/forward`;

  useEffect(() => {
    let current = true;
    void request<{ doctors: WhatsappForwardDoctor[] }>(base)
      .then((data) => {
        if (current) setDoctors(data.doctors);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [base, request]);

  useEffect(() => {
    let current = true;
    setPreview(null);
    setResult(null);
    setError("");
    if (!doctorId) return;
    setLoading(true);
    void request<{ preview: WhatsappForwardPreview }>(
      `${base}?messageId=${message.id}&doctorId=${encodeURIComponent(doctorId)}`,
    )
      .then((data) => {
        if (current) setPreview(data.preview);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [base, doctorId, message.id, request]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lock.current) {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const items = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
          ) || [],
        );
        const first = items[0],
          last = items[items.length - 1];
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === panel.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [onClose]);

  async function send() {
    if (!preview || preview.mode === "blocked" || lock.current) return;
    lock.current = true;
    setSending(true);
    setError("");
    const key = `eden-whatsapp-forward:${actorId}:${preview.token}`;
    let requestId = requestIds.current.get(key);
    if (!requestId) {
      try {
        requestId = sessionStorage.getItem(key) || undefined;
      } catch {
        /* Browser storage may be unavailable. */
      }
      requestId ||= crypto.randomUUID();
      requestIds.current.set(key, requestId);
      try {
        sessionStorage.setItem(key, requestId);
      } catch {
        /* Keep the in-memory request identity. */
      }
    }
    try {
      const sent = await request<WhatsappForwardResult>(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: message.id,
          doctorId,
          token: preview.token,
          requestId,
        }),
      });
      setResult(sent);
    } catch (e) {
      setError(e instanceof Error ? e.message : "未能確認轉寄狀態。");
    } finally {
      lock.current = false;
      setSending(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={() => !lock.current && onClose()}>
      <section
        ref={panel}
        tabIndex={-1}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="轉寄 WhatsApp"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>轉寄 WhatsApp</h2>
          <button aria-label="關閉轉寄" disabled={sending} onClick={onClose}>
            <X />
          </button>
        </header>
        <label className={styles.forwardRecipient}>
          收件醫師
          <select
            value={doctorId}
            disabled={sending}
            onChange={(e) => setDoctorId(e.target.value)}
          >
            <option value="">揀醫師</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name} · {doctor.phone}
              </option>
            ))}
          </select>
        </label>
        {!loading && !doctors.length && !error && (
          <p>未設定醫師 WhatsApp 號碼。</p>
        )}
        {loading && <p role="status">載入中…</p>}
        <div className={styles.followupPreview}>
          {preview?.content || message.content || "附件訊息"}
        </div>
        {(preview?.attachments || message.attachments).map((attachment) => (
          <a
            key={attachment.id}
            className={styles.fileAttachment}
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileText size={18} />
            {attachment.label || "查看附件"}
          </a>
        ))}
        {preview?.reason && (
          <p className={styles.error} role="alert">
            {preview.reason}
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {result ? (
          <div role="status" className={styles.forwardResult}>
            <p>{forwardDeliveryLabel(result.status)}</p>
            <a href={`/conversations?id=${result.conversationId}`}>
              查看醫師 WhatsApp 對話
            </a>
          </div>
        ) : (
          <button
            className={styles.primary}
            disabled={
              sending || loading || !preview || preview.mode === "blocked"
            }
            onClick={() => void send()}
          >
            <Forward size={18} />
            {sending ? "發送中…" : "發送到醫師 WhatsApp"}
          </button>
        )}
      </section>
    </div>
  );
}
