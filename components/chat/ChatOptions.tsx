import { type Option } from './types';

interface ChatOptionsProps {
  options: Option[];
  onSelect: (option: Option) => void;
  primaryColor: string;
}

export function ChatOptions({ options, onSelect, primaryColor }: ChatOptionsProps) {
  return (
    <div className="shrink-0 px-4 pb-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-inner">
        <div className="grid grid-cols-2 gap-2">
          {options.map((option) => (
            <button
              key={option.label}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(option);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.style.transform = '';
                e.currentTarget.style.backgroundColor = '';
                onSelect(option);
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)';
                e.currentTarget.style.backgroundColor = primaryColor;
                e.currentTarget.style.color = 'white';
              }}
              onTouchCancel={(e) => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.backgroundColor = '';
                e.currentTarget.style.color = '';
              }}
              className="relative z-10 rounded-xl border-2 border-primary bg-white px-3 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 active:bg-primary active:text-white"
              style={{
                color: primaryColor,
                touchAction: 'manipulation',
                minHeight: '48px',
                WebkitTapHighlightColor: 'transparent',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
