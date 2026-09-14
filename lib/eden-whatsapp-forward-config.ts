import type {
  WhatsappForwardRecipient,
  WhatsappForwardRecipientKind,
} from "@/lib/eden-whatsapp-forward";
import { getWhatsappForwardDoctors } from "@/lib/eden-whatsapp-forward";

type ForwardRecipientConfig = {
  id: string;
  name: string;
  kind: WhatsappForwardRecipientKind;
  defaultPhone: string;
  overrideKeys: string[];
};

const DEFAULT_RECIPIENTS: ForwardRecipientConfig[] = [
  {
    id: "cheungmy",
    name: "張敏言醫師",
    kind: "doctor",
    defaultPhone: "+85295850430",
    overrideKeys: [
      "DOCTOR_FORWARD_WHATSAPP_CHEUNGMY",
      "WHATSAPP_FORWARD_RECIPIENT_CHEUNGMY",
    ],
  },
  {
    id: "jordan",
    name: "佐敦",
    kind: "branch",
    defaultPhone: "+85259293042",
    overrideKeys: ["WHATSAPP_FORWARD_RECIPIENT_JORDAN"],
  },
  {
    id: "central",
    name: "中環",
    kind: "branch",
    defaultPhone: "+85259269537",
    overrideKeys: ["WHATSAPP_FORWARD_RECIPIENT_CENTRAL"],
  },
  {
    id: "yanzi",
    name: "燕子",
    kind: "staff",
    defaultPhone: "+85296563420",
    overrideKeys: ["WHATSAPP_FORWARD_RECIPIENT_YANZI"],
  },
  {
    id: "mingwai",
    name: "明惠",
    kind: "staff",
    defaultPhone: "+85296094966",
    overrideKeys: ["WHATSAPP_FORWARD_RECIPIENT_MINGWAI"],
  },
  {
    id: "ling",
    name: "ling",
    kind: "staff",
    defaultPhone: "+85261567366",
    overrideKeys: ["WHATSAPP_FORWARD_RECIPIENT_LING"],
  },
];

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

function configuredPhone(
  config: ForwardRecipientConfig,
  env: Record<string, string | undefined>,
): string | null {
  const override = config.overrideKeys
    .map((key) => env[key])
    .find((value) => typeof value !== "undefined" && value.trim() !== "");
  const phone = (override ?? config.defaultPhone).trim();
  return PHONE_PATTERN.test(phone) ? phone : null;
}

function configuredRecipient(
  config: ForwardRecipientConfig,
  env: Record<string, string | undefined>,
): WhatsappForwardRecipient | null {
  const phone = configuredPhone(config, env);
  return phone ? { id: config.id, name: config.name, kind: config.kind, phone } : null;
}

/**
 * The six operational recipients are an explicit server-side allowlist. Their
 * phone numbers must not be imported by client components. Existing doctor
 * env entries remain supported and are appended when they are not already in
 * the allowlist (for example CHAN, LEE, and HON).
 */
export function getWhatsappForwardRecipients(
  env: Record<string, string | undefined> = process.env,
): WhatsappForwardRecipient[] {
  const recipients = DEFAULT_RECIPIENTS.flatMap((config) => {
    const recipient = configuredRecipient(config, env);
    return recipient ? [recipient] : [];
  });
  const ids = new Set(recipients.map((recipient) => recipient.id));

  for (const doctor of getWhatsappForwardDoctors(env)) {
    if (ids.has(doctor.id)) continue;
    recipients.push({
      id: doctor.id,
      name: doctor.name,
      kind: "doctor",
      phone: doctor.phone,
    });
    ids.add(doctor.id);
  }

  return recipients;
}
