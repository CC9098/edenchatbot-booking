import type { Metadata } from "next";
import { EdenConversationsClient } from "@/components/staff/EdenConversationsClient";

export const metadata: Metadata = {
  title: "Eden 對話",
  robots: { index: false, follow: false },
  manifest: "/eden-conversations.webmanifest",
};
export default function ConversationsPage() {
  return <EdenConversationsClient />;
}
