import ChatWidget from '@/components/ChatWidget';

export default function Embed() {
  return (
    <main 
      style={{ 
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '100vh',
        background: 'transparent',
        touchAction: 'manipulation',
        pointerEvents: 'auto',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      <ChatWidget />
    </main>
  );
}
