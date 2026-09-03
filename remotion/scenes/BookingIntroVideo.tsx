import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const brand = {
  primary: '#1f8f5f',
  primaryDark: '#146845',
  pale: '#e8f7ef',
  text: '#123026',
};

const Section: React.FC<{
  start: number;
  end: number;
  title: string;
  subtitle: string;
  bullets: string[];
}> = ({ start, end, title, subtitle, bullets }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - start;
  const visible = frame >= start && frame < end;

  const opacity = interpolate(frame, [start, start + 15, end - 15, end], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const translateY = spring({ frame: Math.max(0, local), fps, config: { damping: 18, stiffness: 120 } });

  if (!visible) return null;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity }}>
      <div
        style={{
          width: 1400,
          background: 'rgba(255,255,255,0.94)',
          borderRadius: 28,
          padding: '56px 72px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          transform: `translateY(${(1 - translateY) * 40}px)`,
        }}
      >
        <h2 style={{ fontSize: 68, margin: 0, color: brand.primaryDark, fontWeight: 800 }}>{title}</h2>
        <p style={{ fontSize: 34, color: brand.text, margin: '18px 0 26px 0' }}>{subtitle}</p>
        <ul style={{ margin: 0, paddingLeft: 36, color: brand.text, fontSize: 40, lineHeight: 1.5 }}>
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </AbsoluteFill>
  );
};

export const BookingIntroVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const bgShift = interpolate(frame, [0, 900], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        fontFamily: 'Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif',
        background: `linear-gradient(135deg, ${brand.pale} 0%, #ffffff ${40 + bgShift * 20}%, #d9f1e4 100%)`,
      }}
    >
      <AbsoluteFill style={{ justifyContent: 'space-between', padding: '50px 70px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 48, color: brand.primaryDark }}>Eden Booking System</h1>
          <span style={{ fontSize: 28, color: brand.primary }}>30秒快速簡介</span>
        </div>
        <div style={{ height: 6, width: '100%', background: 'rgba(31,143,95,0.15)', borderRadius: 999 }}>
          <div
            style={{
              height: '100%',
              width: `${(frame / 900) * 100}%`,
              background: brand.primary,
              borderRadius: 999,
            }}
          />
        </div>
      </AbsoluteFill>

      <Section
        start={0}
        end={180}
        title="一站式預約管理"
        subtitle="讓病人、前台與醫師都更省時"
        bullets={['24/7 線上預約，不錯過任何需求', '自動整理時段與醫師可用名額', '手機、平板、電腦都能順暢操作']}
      />
      <Section
        start={180}
        end={360}
        title="智能分流 + 即時回覆"
        subtitle="將常見問題與預約流程自動化"
        bullets={['客服機器人先回答常見問題', '依需求導向合適服務與醫師', '降低人工重複溝通成本']}
      />
      <Section
        start={360}
        end={540}
        title="醫師排班清晰可視"
        subtitle="後台快速更新，前台即時同步"
        bullets={['月份排班一目了然', '臨時異動可快速調整時段', '減少重複預約與現場衝突']}
      />
      <Section
        start={540}
        end={720}
        title="資料追蹤與服務優化"
        subtitle="每次互動都能成為改善依據"
        bullets={['記錄預約來源與常見問題', '追蹤回覆品質與使用者回饋', '持續優化轉換率與滿意度']}
      />
      <Section
        start={720}
        end={900}
        title="現在就升級你的預約流程"
        subtitle="Eden Booking System 幫你把時間留給專業服務"
        bullets={['降低行政負擔', '提升病人體驗', '打造可擴充的智慧診所流程']}
      />
    </AbsoluteFill>
  );
};
