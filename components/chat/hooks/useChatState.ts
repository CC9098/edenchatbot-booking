import { useState } from 'react';
import { type Message, type Sender } from '../types';

const generateId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function useChatState() {
  const [messages, setMessages] = useState<Message[]>([]);

  const addMessage = (sender: Sender, text: string, links?: Message['links']) => {
    setMessages((prev) => [...prev, { id: generateId(), sender, text, links }]);
  };

  const addBotMessage = (text: string, links?: Message['links']) => addMessage('bot', text, links);

  const replaceBotLoadingMessage = (loadingText: string, newText: string, links?: Message['links']) => {
    setMessages((prev) => {
      const filtered = prev.filter((msg) => msg.text !== loadingText);
      return [...filtered, { id: generateId(), sender: 'bot', text: newText, links }];
    });
  };

  const removeMessageByExactText = (text: string) => {
    setMessages((prev) => prev.filter((msg) => msg.text !== text));
  };

  const clearMessages = () => setMessages([]);

  return {
    messages,
    setMessages,
    addMessage,
    addBotMessage,
    replaceBotLoadingMessage,
    removeMessageByExactText,
    clearMessages,
  };
}
