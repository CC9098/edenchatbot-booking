"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { Smile } from "lucide-react";

import {
  insertEmojiAtCaret,
  STAFF_EMOJI_GROUPS,
} from "@/lib/staff-emoji";
import styles from "./StaffEmojiPicker.module.css";

export type StaffEmojiPickerProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

function restoreCaret(textarea: HTMLTextAreaElement, caret: number) {
  const position = Math.min(Math.max(0, caret), textarea.value.length);
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(position, position);
}

export function StaffEmojiPicker({
  textareaRef,
  value,
  onChange,
  disabled = false,
  className,
}: StaffEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const pendingCaret = useRef<number | null>(null);
  const selectionBeforePickerInteraction = useRef<{
    value: string;
    start: number;
    end: number;
  } | null>(null);
  const pickerId = `staff-emoji-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (pendingCaret.current === null) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    restoreCaret(textarea, pendingCaret.current);
    pendingCaret.current = null;
  }, [textareaRef, value]);

  function chooseEmoji(emoji: string) {
    if (disabled) return;

    const textarea = textareaRef.current;
    const savedSelection = selectionBeforePickerInteraction.current;
    const selectionStart =
      savedSelection?.value === value
        ? savedSelection.start
        : textarea?.selectionStart ?? value.length;
    const selectionEnd =
      savedSelection?.value === value
        ? savedSelection.end
        : textarea?.selectionEnd ?? selectionStart;
    selectionBeforePickerInteraction.current = null;
    const next = insertEmojiAtCaret(
      value,
      emoji,
      selectionStart,
      selectionEnd,
    );

    pendingCaret.current = next.caret;
    onChange(next.value);

    // If the parent keeps the same value (for example while enforcing a
    // length limit), still restore focus and the latest valid caret position.
    if (textarea && typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        if (pendingCaret.current !== null) {
          restoreCaret(textarea, pendingCaret.current);
          pendingCaret.current = null;
        }
      });
    }
  }

  const rootClassName = className
    ? `${styles.picker} ${className}`
    : styles.picker;

  function rememberTextareaSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    selectionBeforePickerInteraction.current = {
      value,
      start: textarea.selectionStart ?? value.length,
      end: textarea.selectionEnd ?? textarea.selectionStart ?? value.length,
    };
  }

  function handlePickerPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    rememberTextareaSelection();
    // Keep the desktop caret visible. Touch pointer events must keep their
    // default behaviour so mobile browsers still dispatch the click event.
    if (event.pointerType === "mouse") event.preventDefault();
  }

  return (
    <div ref={pickerRef} className={rootClassName}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="選擇 emoji"
        aria-expanded={open}
        aria-controls={pickerId}
        aria-haspopup="dialog"
        disabled={disabled}
        title="Emoji"
        onPointerDown={handlePickerPointerDown}
        onClick={() => setOpen((current) => !current)}
      >
        <Smile size={21} strokeWidth={1.8} aria-hidden="true" />
      </button>

      {open && !disabled ? (
        <div
          id={pickerId}
          className={styles.panel}
          role="dialog"
          aria-label="選擇 emoji"
        >
          <div className={styles.panelHeader}>
            <span>Emoji</span>
            <button
              type="button"
              className={styles.close}
              aria-label="關閉 emoji 選單"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <div className={styles.groups}>
            {STAFF_EMOJI_GROUPS.map((group) => (
              <section key={group.label} className={styles.group}>
                <h3>{group.label}</h3>
                <div className={styles.grid}>
                  {group.emojis.map(({ emoji, label }) => (
                    <button
                      key={emoji}
                      type="button"
                      className={styles.emoji}
                      aria-label={`加入${label}`}
                      title={label}
                      onPointerDown={handlePickerPointerDown}
                      onClick={() => chooseEmoji(emoji)}
                    >
                      <span aria-hidden="true">{emoji}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
