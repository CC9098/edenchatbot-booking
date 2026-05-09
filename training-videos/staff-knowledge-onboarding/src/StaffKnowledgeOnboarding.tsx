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
  muted: "#60716b",
  green: "#047857",
  greenDark: "#065f46",
  greenSoft: "#dff7ed",
  mint: "#f0fbf6",
  amber: "#b7791f",
  amberSoft: "#fff7df",
  red: "#b91c1c",
  roseSoft: "#fff1f2",
  sky: "#0369a1",
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

type Tone = "white" | "green" | "amber" | "sky" | "rose";

const fade = (frame: number, fps: number) =>
  interpolate(frame, [0, 0.45 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const rise = (frame: number, fps: number) =>
  interpolate(frame, [0, 0.55 * fps], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

function Scene({ eyebrow, title, children }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.mint} 0%, #ffffff 58%, #f7fbf9 100%)`,
        color: COLORS.ink,
        fontFamily: FONT,
        padding: 48,
        opacity: fade(frame, fps),
      }}
    >
      <div
        style={{
          transform: `translateY(${rise(frame, fps)}px)`,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          height: "100%",
        }}
      >
        <div>
          <div style={{ color: COLORS.green, fontSize: 21, fontWeight: 800 }}>{eyebrow}</div>
          <h1
            style={{
              margin: "8px 0 0",
              fontSize: 48,
              lineHeight: 1.08,
              letterSpacing: 0,
              maxWidth: 1040,
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
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        width: `${Math.min(100, (frame / durationInFrames) * 100)}%`,
        height: 8,
        background: COLORS.green,
      }}
    />
  );
}

function Card({ children, tone = "white" }: { children: ReactNode; tone?: Tone }) {
  const background =
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
        background,
        border: `2px solid ${COLORS.line}`,
        borderRadius: 8,
        boxShadow: "0 18px 38px rgba(25, 56, 45, 0.08)",
        padding: 22,
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
        border: `2px solid ${color}33`,
        background: COLORS.white,
        color,
        fontSize: 20,
        fontWeight: 800,
        padding: "7px 14px",
      }}
    >
      {children}
    </span>
  );
}

function Bubble({
  label,
  children,
  tone,
}: {
  label: string;
  children: ReactNode;
  tone: "patient" | "staff";
}) {
  const isStaff = tone === "staff";
  return (
    <div
      style={{
        display: "grid",
        justifyItems: isStaff ? "start" : "end",
        gap: 7,
      }}
    >
      <div
        style={{
          color: isStaff ? COLORS.greenDark : COLORS.muted,
          fontSize: 19,
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <div
        style={{
          maxWidth: 760,
          borderRadius: 8,
          background: isStaff ? COLORS.green : "#f3f7f5",
          color: isStaff ? COLORS.white : COLORS.ink,
          border: isStaff ? "none" : `2px solid ${COLORS.line}`,
          fontSize: 26,
          fontWeight: 750,
          lineHeight: 1.34,
          padding: "14px 18px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function MiniChecklist({ title, items }: { title: string; items: string[] }) {
  return (
    <Card tone="sky">
      <div style={{ color: COLORS.sky, fontSize: 24, fontWeight: 900 }}>{title}</div>
      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        {items.map((item) => (
          <div
            key={item}
            style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr",
              gap: 10,
              alignItems: "start",
              fontSize: 23,
              lineHeight: 1.35,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                background: COLORS.green,
                color: COLORS.white,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 900,
                marginTop: 4,
              }}
            >
              ✓
            </div>
            <div>{item}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RuleCard({ title, body, tone = "white" }: { title: string; body: string; tone?: Tone }) {
  return (
    <Card tone={tone}>
      <div style={{ color: tone === "rose" ? COLORS.red : COLORS.greenDark, fontSize: 28, fontWeight: 900 }}>
        {title}
      </div>
      <div style={{ marginTop: 12, color: COLORS.ink, fontSize: 25, lineHeight: 1.38 }}>{body}</div>
    </Card>
  );
}

function SceneIntro() {
  return (
    <Scene eyebrow="Eden 前台對答訓練" title="兼職姑娘要學的是：病人問到時，應該點答">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card tone="green">
          <div style={{ fontSize: 35, fontWeight: 900, lineHeight: 1.25 }}>
            不是教大家按平台，是練真實前台對話。
          </div>
          <div style={{ marginTop: 16, color: COLORS.muted, fontSize: 26, lineHeight: 1.4 }}>
            病人問分單、點食藥、補收據、寄藥時，要識講人話、識收資料、識避開不能承諾的位。
          </div>
        </Card>
        <Card>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Pill>分單</Pill>
            <Pill>食藥方法</Pill>
            <Pill>收據 / 藥方</Pill>
            <Pill>寄藥</Pill>
            <Pill color={COLORS.red}>不能亂承諾</Pill>
          </div>
          <div style={{ marginTop: 26, fontSize: 31, lineHeight: 1.32, fontWeight: 850 }}>
            看片後，就做 role-play test。
          </div>
        </Card>
      </div>
    </Scene>
  );
}

function SceneFormula() {
  return (
    <Scene eyebrow="所有查詢先用同一條骨架" title="前台對答四步：安撫、收資料、覆核、交代時間">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <RuleCard title="1. 先穩住" body="明白，我幫您睇一睇先。" tone="green" />
        <RuleCard title="2. 收齊資料" body="姓名、電話、日期、項目、金額、地址。" />
        <RuleCard title="3. 不亂承諾" body="保險、收費、醫療建議，要按紀錄或問主管。" tone="amber" />
        <RuleCard title="4. 講清下一步" body="幾時回覆、用咩方式取、要等幾多工作天。" tone="sky" />
      </div>
      <Card tone="rose">
        <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.25, color: COLORS.red }}>
          不確定時，正確答案不是估，而是：「我先幫您確認，再回覆您。」
        </div>
      </Card>
    </Scene>
  );
}

function SceneSplitBill() {
  return (
    <Scene eyebrow="情境 1：病人問分單" title="不要大聲講「分單」，要講「特別處理收據」">
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20 }}>
        <Card>
          <div style={{ display: "grid", gap: 14 }}>
            <Bubble label="病人" tone="patient">可唔可以幫我分單 claim 保險？</Bubble>
            <Bubble label="姑娘" tone="staff">
              可以，我哋先收錢，稍後再幫您特別處理收據事項。
            </Bubble>
            <Bubble label="姑娘" tone="staff">
              請您確認診斷同治療項目名稱是否可以 claim；如果確認後再改單，會有行政費。
            </Bubble>
          </div>
        </Card>
        <MiniChecklist
          title="姑娘要做"
          items={[
            "先收錢，再處理收據，避免混亂。",
            "用廢紙試印，逐張確認日期、項目、金額。",
            "提醒取單約 5-7 個工作天。",
            "交單後 mark 回分單 Excel。",
          ]}
        />
      </div>
    </Scene>
  );
}

function SceneMedicine() {
  return (
    <Scene eyebrow="情境 2：病人問點食藥" title="講法要跟處方，不自行加醫療意見">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ display: "grid", gap: 14 }}>
            <Bubble label="病人" tone="patient">啲藥係點食？可唔可以早上食？</Bubble>
            <Bubble label="姑娘" tone="staff">
              今日醫師開咗 7 天藥，藥粉每日 1 次，請按處方寫明飯前、飯後或空腹服用。
            </Bubble>
            <Bubble label="姑娘" tone="staff">
              如果同時有中西藥或保健品，記得相隔至少 2 小時。
            </Bubble>
          </div>
        </Card>
        <MiniChecklist
          title="交藥前要核對"
          items={[
            "姓名、日期、藥粉日數、藥丸粒數。",
            "服用次數和服用時間是否一致。",
            "處方備註、醫囑、戒口要 highlight。",
            "新症或長者，用手指著處方慢慢講。",
          ]}
        />
      </div>
    </Scene>
  );
}

function SceneDocuments() {
  return (
    <Scene eyebrow="情境 3：補收據、藥方、病假紙" title="收費和可否補發，要講清楚，不要即口承諾">
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 20 }}>
        <Card>
          <div style={{ display: "grid", gap: 14 }}>
            <Bubble label="病人" tone="patient">我唔見咗收據同藥方，可唔可以補？</Bubble>
            <Bubble label="姑娘" tone="staff">
              我先幫您查返紀錄。補發收據或藥方，一般會按張收費；我確認後再回覆您。
            </Bubble>
          </div>
        </Card>
        <Card tone="amber">
          <div style={{ color: COLORS.amber, fontSize: 28, fontWeight: 900 }}>重點</div>
          <div style={{ marginTop: 14, fontSize: 26, lineHeight: 1.42 }}>
            不要未查紀錄就答「一定得」。補發、收費、病假紙、到診紙和醫師簽署，都要先查再覆。
          </div>
        </Card>
      </div>
    </Scene>
  );
}

function SceneDelivery() {
  return (
    <Scene eyebrow="情境 4：病人問寄藥" title="先問地區和接受運費，不承諾一定即日送到">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <div style={{ display: "grid", gap: 14 }}>
            <Bubble label="病人" tone="patient">可唔可以幫我寄藥？幾錢？</Bubble>
            <Bubble label="姑娘" tone="staff">
              可以，我先同您確認地址、電話、收件時間，再睇 Lalamove 或順豐是否合適。
            </Bubble>
            <Bubble label="姑娘" tone="staff">
              如果運費偏高，我哋會先同您確認是否接受，再安排速遞。
            </Bubble>
          </div>
        </Card>
        <MiniChecklist
          title="寄藥要問"
          items={[
            "收件人姓名、手機、完整地址。",
            "運費是否接受，超過指定金額先 WhatsApp 確認。",
            "海外寄藥通常要用郵局，不要承諾速遞公司一定收。",
            "把運費記錄回系統，方便同事跟進。",
          ]}
        />
      </div>
    </Scene>
  );
}

function SceneDoNotSay() {
  return (
    <Scene eyebrow="不能講錯的位" title="兼職姑娘最重要：識得停，不要亂答">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <RuleCard title="不要保證 claim 到" body="只可提醒病人向保險公司確認診斷和項目名稱。" tone="rose" />
        <RuleCard title="不要自行教醫療判斷" body="服藥只按處方和醫師備註說明，不加個人意見。" tone="rose" />
        <RuleCard title="不要外洩內部資料" body="密碼、後台、同事內部資料，不在病人對話透露。" tone="rose" />
      </div>
      <Card tone="green">
        <div style={{ fontSize: 33, fontWeight: 900, lineHeight: 1.25 }}>
          標準收口句：「我先幫您確認清楚，再 WhatsApp 回覆您。」
        </div>
      </Card>
    </Scene>
  );
}

function SceneTest() {
  return (
    <Scene eyebrow="看片後即做測試" title="Trainer 用真實對話考：姑娘要即場答一次">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card tone="green">
          <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.35 }}>
            Role-play 題目：
            <br />
            1. 客人問能否分單
            <br />
            2. 客人問藥點食
            <br />
            3. 客人問可否補收據
            <br />
            4. 客人問可否寄藥
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.35 }}>
            過關標準：
            <br />
            講得出病人可聽的句子；
            <br />
            知道要收咩資料；
            <br />
            知道邊啲要問主管。
          </div>
          <div style={{ marginTop: 20 }}>
            <Pill>做 Level Test</Pill>
          </div>
        </Card>
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
      {scene(0, 9, <SceneIntro />)}
      {scene(9, 12, <SceneFormula />)}
      {scene(21, 18, <SceneSplitBill />)}
      {scene(39, 16, <SceneMedicine />)}
      {scene(55, 13, <SceneDocuments />)}
      {scene(68, 12, <SceneDelivery />)}
      {scene(80, 6, <SceneDoNotSay />)}
      {scene(86, 4, <SceneTest />)}
    </AbsoluteFill>
  );
}
