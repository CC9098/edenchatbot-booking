import React from "react";
import { Check, CheckCheck } from "lucide-react";
import type { EdenMessage } from "@/lib/eden-conversations";

export function EdenMessageDelivery({
  message,
  issueClassName,
}: {
  message: Pick<EdenMessage, "status" | "private" | "deliveryIssue" | "deleted">;
  issueClassName?: string;
}) {
  if (message.private) return null;
  if (message.deleted) return <span>已移除</span>;
  if (message.deliveryIssue)
    return <span className={issueClassName}>{message.deliveryIssue.label}</span>;
  if (message.status === "failed")
    return <span className={issueClassName}>未能送達</span>;
  if (message.status === "read")
    return <CheckCheck size={16} color="#168fc1" aria-label="病人已讀" />;
  if (message.status === "delivered")
    return <CheckCheck size={16} aria-label="已送達" />;
  if (message.status === "sent")
    return <Check size={16} aria-label="已提交，未確認送達" />;
  return <span>待確認</span>;
}
