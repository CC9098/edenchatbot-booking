import ChatWidget from '@/components/ChatWidget';

export default function Embed({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const intentParam = Array.isArray(searchParams?.intent)
    ? searchParams?.intent[0]
    : searchParams?.intent;
  const initialIntent = intentParam === 'manage-booking' ? 'manage-booking' : undefined;

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
      <ChatWidget autoOpen={Boolean(initialIntent)} initialIntent={initialIntent} />
    </main>
  );
}
