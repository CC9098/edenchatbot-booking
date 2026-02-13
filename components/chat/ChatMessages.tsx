import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Link as LinkIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { type Message } from './types';

interface ChatMessagesProps {
  messages: Message[];
  linkify: (text: string) => ReactNode;
  primaryColor: string;
}

export function ChatMessages({ messages, linkify, primaryColor }: ChatMessagesProps) {
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
          <div
            className={`max-w-[82%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.sender === 'user'
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
        </motion.div>
      ))}
    </div>
  );
}
