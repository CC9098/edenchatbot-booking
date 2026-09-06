export type EdenDeliveryIssue = {
  label: "未能送達" | "送達異常・待確認";
  description: string;
  code: string | null;
};

type DeliverySource = {
  message_type?: number | string | null;
  private?: boolean | null;
  status?: string | null;
  content_attributes?: {
    external_error?: string | null;
    deleted?: boolean;
  } | null;
};

// Keep upstream status intact. An error and a success-looking status are
// conflicting evidence until the provider's event history is reconciled.
export function getEdenDeliveryIssue(message: DeliverySource): EdenDeliveryIssue | null {
  if (
    message.private ||
    message.content_attributes?.deleted ||
    ![1, "outgoing"].includes(message.message_type ?? "")
  ) return null;

  const error = message.content_attributes?.external_error?.trim() || "";
  if (!error && message.status !== "failed") return null;
  const code = error.match(/(?:^|\D)(13\d{4})(?:\D|$)/)?.[1] || null;
  const label = message.status === "failed" ? "未能送達" : "送達異常・待確認";
  // Never expose raw provider errors: they may include patient/template data.
  const description =
    code === "131026"
      ? "WhatsApp 回報未能送達。請核對電話號碼，或改用電話聯絡。"
      : code === "131047"
        ? "WhatsApp 回覆時限已過，請使用跟進訊息。"
        : message.status === "failed"
          ? "訊息未能送達，請確認原因後再重試。"
          : "訊息服務回報異常，送達狀態待確認。";
  return { label, description, code };
}
