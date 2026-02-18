'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Link as LinkIcon, ThumbsUp, ThumbsDown, Copy, Share2, Check } from 'lucide-react';
import { type ReactNode, useState, useCallback } from 'react';
import { type Message } from './types';

interface ChatMessagesProps {
  messages: Message[];
  linkify: (text: string) => ReactNode;
  primaryColor: string;
}

type FeedbackState = Record<string, 'up' | 'down' | null>;

export function ChatMessages({ messages, linkify, primaryColor }: ChatMessagesProps) {
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleFeedback = useCallback((id: string, type: 'up' | 'down') => {
    setFeedback(prev => {
      const next = { ...prev, [id]: prev[id] === type ? null : type };

      // Only submit when actively selecting (not deselecting)
      if (next[id] !== null) {
        const idx = messages.findIndex(m => m.id === id);
        const rated = messages[idx];
        // Collect up to 10 previous messages as context
        const contextMessages = messages
          .slice(Math.max(0, idx - 10), idx)
          .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

        fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feedback_type: type,
            source: 'widget_v1',
            message_text: rated.text,
            message_index: idx,
            context_messages: contextMessages,
          }),
        }).catch(() => { /* silent fail — feedback is best-effort */ });
      }

      return next;
    });
  }, [messages]);

  const handleCopy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers / iframe restrictions
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleShare = useCallback(async (text: string) => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
      } catch {
        // User cancelled — no action needed
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(text).catch(() => {});
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-col gap-3 pr-1">
      {messages.map((msg) => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-start gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {msg.sender === 'bot' && (
            <div className="relative h-8 w-8 shrink-0">
              <Image src="/logo eden.png" alt="醫天圓" fill className="object-contain" />
            </div>
          )}

          <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} max-w-[82%]`}>
            {/* Message bubble */}
            <div
              className={`whitespace-pre-line rounded-2xl px-4 py-3 text-sm shadow-sm ${
                msg.sender === 'user'
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

            {/* Action buttons — shown only for non-loading bot messages */}
            {msg.sender === 'bot' && !msg.text.endsWith('⏳') && (
              <div className="mt-1 flex items-center gap-0.5">
                <button
                  onClick={() => handleFeedback(msg.id, 'up')}
                  title="有用"
                  type="button"
                  className={`rounded-lg p-1.5 transition-colors ${
                    feedback[msg.id] === 'up'
                      ? 'text-green-600'
                      : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                  }`}
                >
                  <ThumbsUp size={13} />
                </button>
                <button
                  onClick={() => handleFeedback(msg.id, 'down')}
                  title="唔係幾幫到我"
                  type="button"
                  className={`rounded-lg p-1.5 transition-colors ${
                    feedback[msg.id] === 'down'
                      ? 'text-red-500'
                      : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                  }`}
                >
                  <ThumbsDown size={13} />
                </button>
                <button
                  onClick={() => handleCopy(msg.id, msg.text)}
                  title="複製"
                  type="button"
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                >
                  {copiedId === msg.id
                    ? <Check size={13} className="text-green-600" />
                    : <Copy size={13} />
                  }
                </button>
                <button
                  onClick={() => handleShare(msg.text)}
                  title="分享"
                  type="button"
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                >
                  <Share2 size={13} />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
