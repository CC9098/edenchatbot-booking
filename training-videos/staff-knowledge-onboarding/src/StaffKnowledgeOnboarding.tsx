import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ReactNode } from "react";

const COLORS = {
  ink: "#10231d",
  muted: "#5d6f69",
  green: "#047857",
  greenDark: "#065f46",
  greenSoft: "#dff7ed",
  mint: "#f0fbf6",
  amber: "#f59e0b",
  amberSoft: "#fff7df",
  red: "#dc2626",
  roseSoft: "#fff1f2",
  sky: "#0ea5e9",
  skySoft: "#ecf8ff",
  line: "#d8e7df",
  white: "#ffffff",
};

const FONT =
  '"PingFang HK", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif';

type SceneProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

const fade = (frame: number, fps: number) =>
  interpolate(frame, [0, 0.45 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const rise = (frame: number, fps: number, delay = 0) =>
  interpolate(frame, [delay * fps, (delay + 0.55) * fps], [26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

function Scene({ eyebrow, title, children }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = fade(frame, fps);
  const y = rise(frame, fps);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.mint} 0%, #ffffff 56%, #f7fbf9 100%)`,
        fontFamily: FONT,
        color: COLORS.ink,
        padding: 54,
        opacity,
      }}
    >
      <div
        style={{
          transform: `translateY(${y}px)`,
          display: "flex",
          flexDirection: "column",
          gap: 24,
          height: "100%",
        }}
      >
        <div>
          <div
            style={{
              color: COLORS.green,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 0,
            }}
          >
            {eyebrow}
          </div>
          <h1
            style={{
              margin: "10px 0 0",
              fontSize: 54,
              lineHeight: 1.1,
              letterSpacing: 0,
              maxWidth: 960,
            }}
          >
            {title}
          </h1>
        </div>
        {children}
      </div>
      <ProgressBar />
    </AbsoluteFill>
  );
}

function ProgressBar() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const width = `${Math.min(100, (frame / durationInFrames) * 100)}%`;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        height: 8,
        width,
        background: COLORS.green,
      }}
    />
  );
}

function Card({
  children,
  tone = "white",
}: {
  children: ReactNode;
  tone?: "white" | "green" | "amber" | "sky" | "rose";
}) {
  const bg =
    tone === "green"
      ? COLORS.greenSoft
      : tone === "amber"
        ? COLORS.amberSoft
        : tone === "sky"
          ? COLORS.skySoft
          : tone === "rose"
            ? COLORS.roseSoft
            : COLORS.white;
  return (
    <div
      style={{
        border: `2px solid ${COLORS.line}`,
        background: bg,
        borderRadius: 8,
        padding: 24,
        boxShadow: "0 18px 38px rgba(25, 56, 45, 0.08)",
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children, color = COLORS.green }: { children: ReactNode; color?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "8px 16px",
        color,
        background: COLORS.white,
        border: `2px solid ${color}26`,
        fontSize: 22,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function StepList({ items }: { items: string[] }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {items.map((item, index) => (
        <div
          key={item}
          style={{
            display: "grid",
            gridTemplateColumns: "54px 1fr",
            alignItems: "center",
            gap: 16,
            fontSize: 30,
            lineHeight: 1.35,
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              background: COLORS.green,
              color: COLORS.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
            }}
          >
            {index + 1}
          </div>
          <div>{item}</div>
        </div>
      ))}
    </div>
  );
}

function BrowserMock({
  title,
  query,
  resultTitle,
  resultBody,
}: {
  title: string;
  query: string;
  resultTitle: string;
  resultBody: string;
}) {
  return (
    <Card>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          minHeight: 360,
          border: `2px solid ${COLORS.line}`,
          borderRadius: 8,
          overflow: "hidden",
          background: COLORS.white,
        }}
      >
        <div style={{ background: "#f6faf8", padding: 22, borderRight: `2px solid ${COLORS.line}` }}>
          <div style={{ fontSize: 22, color: COLORS.green, fontWeight: 800 }}>{title}</div>
          <div style={{ marginTop: 18, border: `2px solid ${COLORS.line}`, padding: 14, borderRadius: 8, fontSize: 24 }}>
            搜尋：{query}
          </div>
          <div style={{ marginTop: 20, display: "grid", gap: 12, fontSize: 20, color: COLORS.muted }}>
            <div>全部分類</div>
            <div style={{ color: COLORS.green, fontWeight: 800 }}>病人查詢回覆</div>
            <div>EDEN 姑娘系列</div>
          </div>
        </div>
        <div style={{ padding: 28 }}>
          <div style={{ color: COLORS.green, fontSize: 22, fontWeight: 800 }}>病人查詢回覆</div>
          <div style={{ marginTop: 8, fontSize: 38, fontWeight: 850 }}>{resultTitle}</div>
          <div style={{ marginTop: 18, fontSize: 26, lineHeight: 1.45, color: COLORS.ink }}>{resultBody}</div>
          <button
            style={{
              marginTop: 24,
              border: 0,
              background: COLORS.green,
              color: COLORS.white,
              borderRadius: 8,
              padding: "14px 22px",
              fontSize: 24,
              fontWeight: 800,
            }}
          >
            複製病人回覆
          </button>
        </div>
      </div>
    </Card>
  );
}

function ChatMock() {
  return (
    <Card>
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ justifySelf: "end", background: COLORS.green, color: COLORS.white, borderRadius: 8, padding: 18, fontSize: 28 }}>
          講座查詢要收集咩資料？
        </div>
        <div style={{ background: "#f8fbfa", border: `2px solid ${COLORS.line}`, borderRadius: 8, padding: 22 }}>
          <div style={{ fontSize: 28, lineHeight: 1.45 }}>
            根據手冊：先確認姓名、電話、參加人數、查詢主題，再按最新安排交主管確認。
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <Pill color={COLORS.sky}>信心：中</Pill>
            <Pill>來源：講座查詢流程</Pill>
          </div>
        </div>
      </div>
    </Card>
  );
}

function LevelGrid() {
  const levels = [
    ["Level 0", "入口與安全邊界", COLORS.greenSoft],
    ["Level 1", "搜尋和複製回覆", COLORS.skySoft],
    ["Level 2", "AI 問答查來源", COLORS.amberSoft],
    ["Level 3", "情境處理", "#f7f3ff"],
    ["Level 4", "補 Note", "#fff4f6"],
    ["Level 5", "半日實戰觀察", "#f4f7fb"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
      {levels.map(([level, label, bg]) => (
        <div
          key={level}
          style={{
            background: bg,
            border: `2px solid ${COLORS.line}`,
            borderRadius: 8,
            padding: 22,
            minHeight: 126,
          }}
        >
          <div style={{ color: COLORS.greenDark, fontWeight: 900, fontSize: 28 }}>{level}</div>
          <div style={{ marginTop: 8, fontSize: 25, lineHeight: 1.25 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function SceneIntro() {
  return (
    <Scene eyebrow="Eden 姑娘控制台" title="兼職姑娘先睇片，再做分 Level 測試">
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 24, alignItems: "stretch" }}>
        <Card tone="green">
          <div style={{ fontSize: 34, fontWeight: 850, lineHeight: 1.25 }}>
            目標不是背答案，而是遇到病人查詢時，識得安全地查、覆、問、補。
          </div>
        </Card>
        <Card>
          <StepList items={["遇到問題", "查知識庫或問 AI", "確認來源和安全邊界", "完成測試"]} />
        </Card>
      </div>
    </Scene>
  );
}

function SceneWorkflow() {
  return (
    <Scene eyebrow="返工遇到問題時" title="用同一個流程處理，不靠估">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 18 }}>
        {[
          ["1", "先搜尋", "上門、講座、醫療券、寄藥"],
          ["2", "複製可見回覆", "只貼病人可見文字"],
          ["3", "不確定就升級", "收費、醫療、密碼要問主管"],
          ["4", "確認後補 Note", "下次大家都查到"],
        ].map(([num, title, body]) => (
          <Card key={num} tone={num === "3" ? "amber" : "white"}>
            <div style={{ color: COLORS.green, fontSize: 40, fontWeight: 900 }}>{num}</div>
            <div style={{ marginTop: 12, fontSize: 31, fontWeight: 850 }}>{title}</div>
            <div style={{ marginTop: 12, fontSize: 24, lineHeight: 1.35, color: COLORS.muted }}>{body}</div>
          </Card>
        ))}
      </div>
    </Scene>
  );
}

function SceneSearchDemo() {
  return (
    <Scene eyebrow="示範 1" title="病人問上門出診，先搜尋再複製">
      <BrowserMock
        title="姑娘內部手冊"
        query="上門"
        resultTitle="查詢上門看診做法"
        resultBody="先用病人可見回覆講收費起點，再收集姓名、年齡、症狀、地址、電話等資料。"
      />
    </Scene>
  );
}

function SceneAiDemo() {
  return (
    <Scene eyebrow="示範 2" title="AI 可以幫手搵，但要睇來源">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
        <ChatMock />
        <Card tone="sky">
          <div style={{ fontSize: 31, fontWeight: 850, lineHeight: 1.3 }}>答完要做三件事</div>
          <div style={{ marginTop: 20 }}>
            <StepList items={["睇信心", "點入來源", "必要時問主管"]} />
          </div>
        </Card>
      </div>
    </Scene>
  );
}

function SceneSafety() {
  return (
    <Scene eyebrow="安全規則" title="以下問題不要直接答，先升級">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <Card tone="rose">
          <div style={{ fontSize: 36, fontWeight: 900, color: COLORS.red }}>不可直接覆</div>
          <div style={{ marginTop: 18, fontSize: 29, lineHeight: 1.55 }}>
            密碼、OTP、後台登入、未覆核收費、醫療診斷、病人私隱資料。
          </div>
        </Card>
        <Card tone="green">
          <div style={{ fontSize: 36, fontWeight: 900, color: COLORS.greenDark }}>正確做法</div>
          <div style={{ marginTop: 18, fontSize: 29, lineHeight: 1.55 }}>
            停一停，問主管或指定同事；確認後只把可重用流程補入 Note。
          </div>
        </Card>
      </div>
    </Scene>
  );
}

function SceneLevels() {
  return (
    <Scene eyebrow="學完即做測試" title="分 Level 測，逐步放手">
      <LevelGrid />
      <Card tone="amber">
        <div style={{ fontSize: 30, lineHeight: 1.35 }}>
          Level 0-2 要 Green；Level 3 看情境判斷；Level 4 要識補 Note；Level 5 才是半日實戰觀察。
        </div>
      </Card>
    </Scene>
  );
}

function SceneNote() {
  return (
    <Scene eyebrow="最後一步" title="問完主管，不要只停在自己知道">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <Card>
          <div style={{ fontSize: 30, lineHeight: 1.5 }}>
            新增 Note 時，至少要有：
            <br />
            適用情況、病人可見回覆、姑娘內部動作、主管確認位。
          </div>
        </Card>
        <Card tone="green">
          <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1.2 }}>
            一個人問完，下一更就不用再問同一題。
          </div>
        </Card>
      </div>
    </Scene>
  );
}

function SceneOutro() {
  return (
    <Scene eyebrow="開始測試" title="現在打開 Level Test，按題目做一次">
      <Card tone="green">
        <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.25 }}>
          原則：查得到才覆；不肯定就問；確認後補回知識庫。
        </div>
      </Card>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <Pill>docs/training/staff-knowledge-onboarding-level-tests-2026-05-09.md</Pill>
      </div>
    </Scene>
  );
}

export function StaffKnowledgeOnboarding() {
  const { fps } = useVideoConfig();
  const scene = (from: number, seconds: number, component: ReactNode) => (
    <Sequence from={from * fps} durationInFrames={seconds * fps} premountFor={fps}>
      {component}
    </Sequence>
  );

  return (
    <AbsoluteFill>
      {scene(0, 10, <SceneIntro />)}
      {scene(10, 12, <SceneWorkflow />)}
      {scene(22, 14, <SceneSearchDemo />)}
      {scene(36, 14, <SceneAiDemo />)}
      {scene(50, 12, <SceneSafety />)}
      {scene(62, 13, <SceneLevels />)}
      {scene(75, 10, <SceneNote />)}
      {scene(85, 5, <SceneOutro />)}
    </AbsoluteFill>
  );
}
