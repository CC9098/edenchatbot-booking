'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, Copy, Link as LinkIcon, Share2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { type Message } from './types';

interface ChatMessagesProps {
  messages: Message[];
  linkify: (text: string) => ReactNode;
  primaryColor: string;
  sessionId?: string;
}

type FeedbackType = 'up' | 'down';

const FEEDBACK_LOADING_PREFIXES = [
  'Connecting to AI...',
  '正在查詢可預約時段... ⏳',
  '正在處理預約... ⏳',
  '正在提交諮詢資料... ⏳',
];

function isFeedbackHiddenMessage(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (trimmed.endsWith('⏳')) return true;
  return FEEDBACK_LOADING_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export function ChatMessages({ messages, linkify, primaryColor, sessionId }: ChatMessagesProps) {
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, FeedbackType>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const postFeedback = useCallback(async (
    message: Message,
    messageIndex: number,
    feedbackType: FeedbackType,
  ) => {
    const contextMessages = messages.slice(Math.max(0, messageIndex - 9), messageIndex + 1).map((item) => ({
      role: item.sender === 'user' ? 'user' : 'assistant',
      content: item.text,
    }));

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackType,
          source: 'widget_v1',
          messageText: message.text,
          messageIndex,
          contextMessages,
          sessionId,
        }),
      });
    } catch (error) {
      console.error('Feedback submit failed (widget_v1):', error);
    }
  }, [messages, sessionId]);

  const handleFeedback = useCallback((message: Message, messageIndex: number, feedbackType: FeedbackType) => {
    setFeedbackByMessage((prev) => {
      const current = prev[message.id];
      const next = current === feedbackType ? undefined : feedbackType;
      const updated = { ...prev };

      if (next) {
        updated[message.id] = next;
        void postFeedback(message, messageIndex, next);
      } else {
        delete updated[message.id];
      }

      return updated;
    });
  }, [postFeedback]);

  const handleCopy = useCallback(async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId((current) => (current === message.id ? null : current)), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, []);

  const handleShare = useCallback(async (message: Message) => {
    try {
      if (navigator.share) {
        await navigator.share({ text: message.text });
        return;
      }
      await handleCopy(message);
    } catch (error) {
      console.error('Share failed:', error);
    }
  }, [handleCopy]);

  return (
    <div className="flex min-h-0 flex-col gap-3 pr-1">
      {messages.map((msg, index) => {
        const isBot = msg.sender === 'bot';
        const selectedFeedback = feedbackByMessage[msg.id];
        const hideFeedback = isFeedbackHiddenMessage(msg.text);
        const isCopied = copiedMessageId === msg.id;

        return (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-start gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {isBot && (
              <div className="relative h-8 w-8 shrink-0">
                <Image src="/logo-eden.png" alt="醫天圓" fill className="object-contain" />
              </div>
            )}
            <div className="max-w-[82%]">
              <div
                className={`whitespace-pre-line rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.sender === 'user'
                  ? 'border border-[--primary]/25 bg-[#e8f3eb] text-[#1f3a18]'
                  : 'bg-gray-100 text-gray-800'
                  }`}
                style={msg.sender === 'user' ? { ['--primary' as string]: primaryColor } : {}}
              >
                {linkify(msg.text)}
                {msg.links && (
                  <div className="mt-2 space-y-1">
                    {msg.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center gap-1 text-xs underline transition hover:text-gray-200 md:hover:text-gray-700"
                        target="_blank"
                      >
                        <LinkIcon size={14} />
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {isBot && !hideFeedback && (
                <div className="mt-1.5 flex items-center gap-1 pl-1 text-[11px] text-gray-500">
                  <button
                    type="button"
                    onClick={() => handleFeedback(msg, index, 'up')}
                    className={`rounded-md px-2 py-1 transition ${selectedFeedback === 'up'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'hover:bg-gray-100'
                      }`}
                    aria-label="讚好此回覆"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback(msg, index, 'down')}
                    className={`rounded-md px-2 py-1 transition ${selectedFeedback === 'down'
                      ? 'bg-red-100 text-red-700'
                      : 'hover:bg-gray-100'
                      }`}
                    aria-label="對此回覆提出負評"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopy(msg)}
                    className="rounded-md px-2 py-1 transition hover:bg-gray-100"
                    aria-label="複製訊息"
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShare(msg)}
                    className="rounded-md px-2 py-1 transition hover:bg-gray-100"
                    aria-label="分享訊息"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
