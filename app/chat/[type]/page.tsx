import { redirect } from "next/navigation";
import { ChatRoom } from "@/components/chat-v2/ChatRoom";
import type { Metadata } from "next";

const VALID_TYPES = ["depleting", "crossing", "hoarding"] as const;
type ConstitutionType = (typeof VALID_TYPES)[number];

const TYPE_LABELS: Record<ConstitutionType, string> = {
  depleting: "虛損型",
  crossing: "交叉型",
  hoarding: "積滯型",
};

export async function generateMetadata({
  params,
}: {
  params: { type: string };
}): Promise<Metadata> {
  const type = params.type as ConstitutionType;
  const label = TYPE_LABELS[type] ?? "AI 諮詢";
  return {
    title: `${label} - 醫天圓 AI 體質諮詢`,
    description: `醫天圓中醫 AI ${label}體質分析與健康建議`,
  };
}

export default function ChatTypePage({
  params,
}: {
  params: { type: string };
}) {
  const type = params.type;

  if (!VALID_TYPES.includes(type as ConstitutionType)) {
    redirect("/chat/depleting");
  }

  return <ChatRoom type={type as ConstitutionType} />;
}
