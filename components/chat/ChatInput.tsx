import { Send } from 'lucide-react';

interface ChatInputProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSend: () => void;
  primaryColor: string;
  aiMode: boolean;
  formError?: string;
}

export function ChatInput({ value, placeholder, onChange, onSend, primaryColor, aiMode, formError }: ChatInputProps) {
  return (
    <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3">
      <div
        className="flex items-center gap-2 rounded-2xl border border-[--primary]/20 bg-[#f4fbf3] px-3 py-2 shadow-sm focus-within:border-[--primary] focus-within:bg-white focus-within:ring-2 focus-within:ring-[--primary]/20"
        style={{ ['--primary' as string]: primaryColor }}
      >
        <input
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSend();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.style.transform = '';
            onSend();
          }}
          onTouchStart={(e) => {
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onTouchCancel={(e) => {
            e.currentTarget.style.transform = '';
          }}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[--primary] text-white transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[--primary] active:scale-95"
          aria-label="Send"
          type="button"
          style={{
            ['--primary' as string]: primaryColor,
            touchAction: 'manipulation',
            minHeight: '44px',
            minWidth: '44px',
            WebkitTapHighlightColor: 'transparent',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
        >
          <Send size={16} />
        </button>
      </div>
      {aiMode && (
        <p className="mt-2 text-xs text-[--primary]" style={{ ['--primary' as string]: primaryColor }}>
          已進入 AI 模式：直接輸入問題後按 Enter 或右側 Send。
        </p>
      )}
      {formError && <p className="mt-2 text-xs text-red-500">{formError}</p>}
    </div>
  );
}
