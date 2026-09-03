import { createHmac, timingSafeEqual } from 'node:crypto';
import type { LegacyChatMessage } from '@/lib/legacy-chat-response';
import { normalizePhoneForSearch } from '@/lib/contact-utils';
import { buildManageBookingUrl, buildPublicUrl } from '@/lib/public-url';
import { createManageAccessToken } from '@/lib/widget-manage-token';
import {
  DEFAULT_WIDGET_CHATBOT_SETTINGS,
  getWidgetChatbotMenuLabelByTarget,
  type WidgetChatbotSettings,
} from '@/lib/widget-chatbot-settings';
import {
  getClinicAddressLines,
  getClinicHoursLines,
  getClinicRouteLinks,
} from '@/shared/clinic-data';

export const CHATWOOT_MAIN_MENU_PROMPT = '你好，我們是醫天圓中醫診所，請問有什麼可以幫到你？';
export const CHATWOOT_MAIN_MENU_ITEMS = [
  { title: '一般查詢', value: 'general' },
  { title: '預約服務', value: 'booking' },
  { title: '想直接與姑娘對話', value: 'human' },
] as const;
export const CHATWOOT_MAIN_MENU_MESSAGE = `${CHATWOOT_MAIN_MENU_PROMPT}
1. 一般查詢
2. 預約服務
3. 想直接與姑娘對話`;

const widgetSettings = DEFAULT_WIDGET_CHATBOT_SETTINGS;
export const CHATWOOT_GENERAL_INQUIRY_PROMPT =
  '可以呀，請直接講你想問嘅內容，我會盡快幫你。';

export const CHATWOOT_BOOKING_MENU_PROMPT =
  '你好，請選擇你想處理的預約項目：';
export const CHATWOOT_BOOKING_MENU_ITEMS = [
  { title: '預約', value: 'new_booking' },
  { title: '更期', value: 'reschedule_booking' },
  { title: '取消', value: 'cancel_booking' },
  { title: '返回主選單', value: 'main' },
] as const;
export const CHATWOOT_BOOKING_MENU_MESSAGE = `${CHATWOOT_BOOKING_MENU_PROMPT}
1. 預約
2. 更期
3. 取消
4. 返回主選單`;

export const CHATWOOT_HUMAN_ACK =
  '好，我幫你轉交姑娘跟進，請稍等。';

export const CHATWOOT_FLOW_STATE_ATTRIBUTE = 'eden_flow_state';
export const CHATWOOT_LAST_INCOMING_MESSAGE_ID_ATTRIBUTE = 'eden_last_incoming_message_id';

export type ChatwootFlowState = 'menu' | 'general_menu' | 'clinic_menu' | 'booking_menu' | 'general_ai' | 'human';

export interface ChatwootIncomingEvent {
  accountId: number;
  conversationId: number;
  messageId: number;
  content: string;
  contactId: number | null;
  contactPhone: string | null;
}

interface ChatwootMessage {
  id?: number;
  content?: string | null;
  created_at?: number;
  message_type?: number | string | null;
  private?: boolean;
  sender_type?: string | null;
  status?: string | null;
}

interface ChatwootConversationDetails {
  id: number;
  status?: string | null;
  custom_attributes?: Record<string, unknown> | null;
  messages?: ChatwootMessage[];
}

interface ChatwootContactPayload {
  id?: number;
  phone_number?: string | null;
  identifier?: string | null;
}

interface ChatwootContactResponse {
  payload?: ChatwootContactPayload | null;
}

export interface ChatwootSelectItem {
  title: string;
  value: string;
}

interface ChatwootTemplateProcessedParams {
  body?: Record<string, string>;
  buttons?: Array<{
    type: 'url' | 'copy_code';
    parameter: string;
  }>;
}

interface ChatwootTemplateConfig {
  name: string;
  category: string;
  language: string;
}

export interface ChatwootOutgoingMessagePayload {
  content: string;
  contentType?: 'text' | 'input_select';
  items?: ChatwootSelectItem[];
  templateParams?: {
    name: string;
    category: string;
    language: string;
    processed_params: ChatwootTemplateProcessedParams;
  };
}

export interface ChatwootRuntimeCopy {
  generalMenuPrompt: string;
  generalMenuItems: ChatwootSelectItem[];
  generalMenuMessage: string;
  clinicMenuPrompt: string;
  clinicMenuItems: ChatwootSelectItem[];
  clinicMenuMessage: string;
  generalInquiryPrompt: string;
  feesMessage: string;
  timetableMessage: string;
  clinicHoursMessage: string;
  clinicAddressesMessage: string;
}

type MenuSelectionKind = 'main' | 'general' | 'booking' | 'reschedule' | 'cancel' | 'human';
type GeneralSelectionKind = 'fees' | 'clinic' | 'timetable' | 'other' | 'main';
type ClinicSelectionKind = 'hours' | 'addresses' | 'main';
type BookingSelectionKind = 'new_booking' | 'reschedule_booking' | 'cancel_booking' | 'main';
type ChatwootManageBookingAction = 'reschedule' | 'cancel';

const CHATWOOT_DELIVERY_TERMINAL_STATUSES = new Set(['failed', 'delivered', 'read']);
const DEFAULT_CHATWOOT_DELIVERY_POLL_ATTEMPTS = 4;
const DEFAULT_CHATWOOT_DELIVERY_POLL_INTERVAL_MS = 1000;

function buildMenuMessage(prompt: string, items: readonly ChatwootSelectItem[]): string {
  const numberedItems = items.map((item, index) => `${index + 1}. ${item.title}`).join('\n');
  return `${prompt}\n${numberedItems}`;
}

function buildClinicRouteLinkLines(): string {
  return getClinicRouteLinks()
    .map(({ label, href }) => `${label}: ${href}`)
    .join('\n');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMenuSelectionPattern(
  numericIndex: number,
  labels: Array<string | null | undefined>,
  allowNumeric = true,
): RegExp {
  const normalizedLabels = Array.from(
    new Set(
      labels
        .map((label) => label?.trim())
        .filter((label): label is string => Boolean(label))
        .map((label) => escapeRegExp(label)),
    ),
  );
  const numericSegment = allowNumeric ? `${numericIndex}(?:[.)、\\s-]|$)|` : '';
  return new RegExp(`^(?:${numericSegment}${normalizedLabels.join('|')})(?:[:：\\s-]|$)`, 'u');
}

export function buildChatwootRuntimeCopy(
  settings: WidgetChatbotSettings = DEFAULT_WIDGET_CHATBOT_SETTINGS,
): ChatwootRuntimeCopy {
  const generalMenuItems: ChatwootSelectItem[] = [
    { title: getWidgetChatbotMenuLabelByTarget(settings, 'fees'), value: 'fees' },
    { title: getWidgetChatbotMenuLabelByTarget(settings, 'clinic'), value: 'clinic' },
    { title: getWidgetChatbotMenuLabelByTarget(settings, 'timetable'), value: 'timetable' },
    { title: getWidgetChatbotMenuLabelByTarget(settings, 'other'), value: 'other' },
    { title: settings.flows.common.returnMainButtonLabel, value: 'main' },
  ];
  const clinicMenuItems: ChatwootSelectItem[] = [
    { title: settings.flows.clinic.hoursButtonLabel, value: 'hours' },
    { title: settings.flows.clinic.addressesButtonLabel, value: 'addresses' },
    { title: settings.flows.clinic.backButtonLabel, value: 'main' },
  ];
  const clinicRouteLinkLines = buildClinicRouteLinkLines();

  return {
    generalMenuPrompt: settings.flows.clinic.prompt,
    generalMenuItems,
    generalMenuMessage: buildMenuMessage(settings.flows.clinic.prompt, generalMenuItems),
    clinicMenuPrompt: settings.flows.clinic.prompt,
    clinicMenuItems,
    clinicMenuMessage: buildMenuMessage(settings.flows.clinic.prompt, clinicMenuItems),
    generalInquiryPrompt: CHATWOOT_GENERAL_INQUIRY_PROMPT,
    feesMessage: settings.flows.fees.reply,
    timetableMessage: settings.flows.timetable.reply,
    clinicHoursMessage: `${getClinicHoursLines().join('\n')}\n\n${settings.flows.clinic.hoursClosingText}`,
    clinicAddressesMessage: `${settings.flows.clinic.addressesPrompt}\n\n${getClinicAddressLines().join('\n\n')}${clinicRouteLinkLines ? `\n\n${clinicRouteLinkLines}` : ''}`,
  };
}

export function buildChatwootSystemMessageSet(
  copy: ChatwootRuntimeCopy = buildChatwootRuntimeCopy(),
): Set<string> {
  return new Set([
    copy.generalInquiryPrompt,
    copy.generalMenuPrompt,
    copy.generalMenuMessage,
    copy.clinicMenuPrompt,
    copy.clinicMenuMessage,
    copy.feesMessage,
    CHATWOOT_BOOKING_MENU_PROMPT,
    CHATWOOT_BOOKING_MENU_MESSAGE,
    CHATWOOT_HUMAN_ACK,
    copy.timetableMessage,
    copy.clinicHoursMessage,
    copy.clinicAddressesMessage,
    CHATWOOT_MAIN_MENU_PROMPT,
    CHATWOOT_MAIN_MENU_MESSAGE,
  ]);
}

const DEFAULT_CHATWOOT_RUNTIME_COPY = buildChatwootRuntimeCopy(widgetSettings);
const DEFAULT_CHATWOOT_SYSTEM_MESSAGES = buildChatwootSystemMessageSet(DEFAULT_CHATWOOT_RUNTIME_COPY);

export const CHATWOOT_GENERAL_MENU_PROMPT = DEFAULT_CHATWOOT_RUNTIME_COPY.generalMenuPrompt;
export const CHATWOOT_GENERAL_MENU_ITEMS = DEFAULT_CHATWOOT_RUNTIME_COPY.generalMenuItems;
export const CHATWOOT_GENERAL_MENU_MESSAGE = DEFAULT_CHATWOOT_RUNTIME_COPY.generalMenuMessage;
export const CHATWOOT_CLINIC_MENU_PROMPT = DEFAULT_CHATWOOT_RUNTIME_COPY.clinicMenuPrompt;
export const CHATWOOT_CLINIC_MENU_ITEMS = DEFAULT_CHATWOOT_RUNTIME_COPY.clinicMenuItems;
export const CHATWOOT_CLINIC_MENU_MESSAGE = DEFAULT_CHATWOOT_RUNTIME_COPY.clinicMenuMessage;
export const CHATWOOT_FEES_MESSAGE = DEFAULT_CHATWOOT_RUNTIME_COPY.feesMessage;
export const CHATWOOT_TIMETABLE_MESSAGE = DEFAULT_CHATWOOT_RUNTIME_COPY.timetableMessage;
export const CHATWOOT_CLINIC_HOURS_MESSAGE = DEFAULT_CHATWOOT_RUNTIME_COPY.clinicHoursMessage;
export const CHATWOOT_CLINIC_ADDRESSES_MESSAGE = DEFAULT_CHATWOOT_RUNTIME_COPY.clinicAddressesMessage;

export class ChatwootClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiAccessToken: string,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        api_access_token: this.apiAccessToken,
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`[Chatwoot] ${response.status} ${response.statusText}: ${text}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  getConversationDetails(accountId: number, conversationId: number) {
    return this.request<ChatwootConversationDetails>(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}`,
      { method: 'GET' },
    );
  }

  getContact(accountId: number, contactId: number) {
    return this.request<ChatwootContactResponse>(
      `/api/v1/accounts/${accountId}/contacts/${contactId}`,
      { method: 'GET' },
    );
  }

  createMessage(
    accountId: number,
    conversationId: number,
    payload: string | ChatwootOutgoingMessagePayload,
  ) {
    const messagePayload = typeof payload === 'string'
      ? {
          content: payload,
          message_type: 'outgoing',
          private: false,
        }
      : {
          content: payload.content,
          message_type: 'outgoing',
          private: false,
          ...(payload.contentType ? { content_type: payload.contentType } : {}),
          ...(payload.items?.length
            ? {
                content_attributes: {
                  items: payload.items,
                },
              }
            : {}),
          ...(payload.templateParams ? { template_params: payload.templateParams } : {}),
        };

    return this.request<ChatwootMessage>(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(messagePayload),
      },
    );
  }

  listMessages(accountId: number, conversationId: number) {
    return this.request<{ payload?: ChatwootMessage[] }>(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      { method: 'GET' },
    );
  }

  deleteMessage(accountId: number, conversationId: number, messageId: number) {
    return this.request<void>(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages/${messageId}`,
      { method: 'DELETE' },
    );
  }

  updateConversationCustomAttributes(
    accountId: number,
    conversationId: number,
    customAttributes: Record<string, unknown>,
  ) {
    return this.request(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/custom_attributes`,
      {
        method: 'POST',
        body: JSON.stringify({
          custom_attributes: customAttributes,
        }),
      },
    );
  }

  updateConversationStatus(
    accountId: number,
    conversationId: number,
    status: 'open' | 'resolved' | 'pending' | 'snoozed',
  ) {
    return this.request(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/toggle_status`,
      {
        method: 'POST',
        body: JSON.stringify({ status }),
      },
    );
  }
}

export function createChatwootClientFromEnv(): ChatwootClient {
  const baseUrl = (process.env.CHATWOOT_BASE_URL || '').trim().replace(/\/$/, '');
  const apiAccessToken = (process.env.CHATWOOT_API_ACCESS_TOKEN || '').trim();

  if (!baseUrl) {
    throw new Error('CHATWOOT_BASE_URL is not configured');
  }

  if (!apiAccessToken) {
    throw new Error('CHATWOOT_API_ACCESS_TOKEN is not configured');
  }

  return new ChatwootClient(baseUrl, apiAccessToken);
}

export function verifyChatwootSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signature.trim().replace(/^sha256=/i, '');

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function extractIncomingChatwootEvent(payload: unknown): ChatwootIncomingEvent | null {
  if (!payload || typeof payload !== 'object') return null;

  const row = payload as Record<string, unknown>;
  const event = typeof row.event === 'string' ? row.event : '';
  const messageType = row.message_type;
  const privateFlag = row.private;
  const content = typeof row.content === 'string' ? row.content.trim() : '';
  const sender = row.sender;
  const senderType = sender && typeof sender === 'object'
    ? ((sender as Record<string, unknown>).type ?? (sender as Record<string, unknown>).sender_type)
    : null;
  const contact = row.contact;
  const conversation = row.conversation;
  const account = row.account;
  const messageId = typeof row.id === 'number' ? row.id : Number(row.id);
  const accountId = account && typeof account === 'object'
    ? Number((account as Record<string, unknown>).id)
    : NaN;
  const conversationId = conversation && typeof conversation === 'object'
    ? Number((conversation as Record<string, unknown>).id)
    : NaN;
  const contactId = contact && typeof contact === 'object'
    ? Number((contact as Record<string, unknown>).id)
    : NaN;

  const isIncoming =
    messageType === 'incoming' ||
    messageType === 0 ||
    messageType === '0';

  const normalizedSenderType = typeof senderType === 'string' ? senderType.toLowerCase() : '';
  const senderIsSupportedContact = !normalizedSenderType || normalizedSenderType === 'contact';

  if (
    event !== 'message_created' ||
    !isIncoming ||
    privateFlag === true ||
    !content ||
    !senderIsSupportedContact ||
    !Number.isFinite(accountId) ||
    !Number.isFinite(conversationId) ||
    !Number.isFinite(messageId)
  ) {
    return null;
  }

  return {
    accountId,
    conversationId,
    messageId,
    content,
    contactId: Number.isFinite(contactId) ? contactId : null,
    contactPhone: extractChatwootPhoneCandidate(row),
  };
}

function extractString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function extractPhoneLikeRecord(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;

  const row = value as Record<string, unknown>;
  return (
    extractString(row.phone_number) ||
    extractString(row.phoneNumber)
  );
}

function extractChatwootPhoneCandidate(payload: Record<string, unknown>): string | null {
  const senderPhone = extractPhoneLikeRecord(payload.sender);
  if (senderPhone) return senderPhone;

  const contactPhone = extractPhoneLikeRecord(payload.contact);
  if (contactPhone) return contactPhone;

  const conversation = payload.conversation;
  if (!conversation || typeof conversation !== 'object') {
    return null;
  }

  const conversationRow = conversation as Record<string, unknown>;
  const contactInboxPhone = extractPhoneLikeRecord(conversationRow.contact_inbox);
  if (contactInboxPhone) return contactInboxPhone;

  const meta = conversationRow.meta;
  if (!meta || typeof meta !== 'object') {
    return null;
  }

  const senderMetaPhone = extractPhoneLikeRecord((meta as Record<string, unknown>).sender);
  return senderMetaPhone;
}

function hasUsablePhoneDigits(value: string | null | undefined): boolean {
  return normalizePhoneForSearch(value).length >= 8;
}

async function resolveChatwootContactPhone(
  client: ChatwootClient,
  accountId: number,
  options: { contactId: number | null; contactPhone: string | null },
): Promise<string | null> {
  if (hasUsablePhoneDigits(options.contactPhone)) {
    return options.contactPhone;
  }

  if (!options.contactId) {
    return null;
  }

  try {
    const response = await client.getContact(accountId, options.contactId);
    const payload = response.payload;
    const resolvedPhone = payload?.phone_number || null;
    return hasUsablePhoneDigits(resolvedPhone) ? resolvedPhone : null;
  } catch (error) {
    console.warn('[chatwoot-agent-bot] Failed to resolve contact phone:', error);
    return null;
  }
}

export function getFlowState(customAttributes: Record<string, unknown> | null | undefined): ChatwootFlowState {
  const value = typeof customAttributes?.[CHATWOOT_FLOW_STATE_ATTRIBUTE] === 'string'
    ? customAttributes[CHATWOOT_FLOW_STATE_ATTRIBUTE]
    : '';

  if (value === 'booking') {
    return 'booking_menu';
  }

  if (
    value === 'general_menu' ||
    value === 'clinic_menu' ||
    value === 'booking_menu' ||
    value === 'general_ai' ||
    value === 'human'
  ) {
    return value;
  }

  return 'menu';
}

export function isDuplicateIncomingMessage(
  customAttributes: Record<string, unknown> | null | undefined,
  messageId: number,
): boolean {
  return String(customAttributes?.[CHATWOOT_LAST_INCOMING_MESSAGE_ID_ATTRIBUTE] ?? '') === String(messageId);
}

export function shouldSilenceUnmatchedChatwootMessage(state: ChatwootFlowState): boolean {
  return (
    state === 'menu' ||
    state === 'general_menu' ||
    state === 'clinic_menu' ||
    state === 'booking_menu' ||
    state === 'human'
  );
}

export function mergeFlowAttributes(
  currentAttributes: Record<string, unknown> | null | undefined,
  nextState: ChatwootFlowState,
  messageId: number,
): Record<string, unknown> {
  return {
    ...(currentAttributes || {}),
    [CHATWOOT_FLOW_STATE_ATTRIBUTE]: nextState,
    [CHATWOOT_LAST_INCOMING_MESSAGE_ID_ATTRIBUTE]: String(messageId),
  };
}

export async function persistChatwootFlowState({
  client,
  accountId,
  conversationId,
  currentStatus,
  currentAttributes,
  nextState,
  incomingMessageId,
}: {
  client: ChatwootClient;
  accountId: number;
  conversationId: number;
  currentStatus: string | null | undefined;
  currentAttributes: Record<string, unknown> | null | undefined;
  nextState: ChatwootFlowState;
  incomingMessageId: number;
}) {
  if (nextState === 'human' && currentStatus?.toLowerCase() !== 'open') {
    await client.updateConversationStatus(accountId, conversationId, 'open');
  }

  await client.updateConversationCustomAttributes(
    accountId,
    conversationId,
    mergeFlowAttributes(currentAttributes, nextState, incomingMessageId),
  );
}

function getManageActionCopy(action?: ChatwootManageBookingAction): {
  intro: string;
  linkLabel: string;
  followup: string;
} {
  if (action === 'reschedule') {
    return {
      intro: '收到，如果你想更期預約，可以直接打開以下專屬連結：',
      linkLabel: '更期',
      followup: '進入後可以查看及更改現有預約。',
    };
  }

  if (action === 'cancel') {
    return {
      intro: '收到，如果你想取消預約，可以直接打開以下專屬連結：',
      linkLabel: '取消',
      followup: '進入後可以查看及取消現有預約。',
    };
  }

  return {
    intro: '收到，你可以直接打開以下專屬預約管理連結：',
    linkLabel: '管理預約',
    followup: '進入後可以查看、更改或取消預約。',
  };
}

function buildDirectManageBookingReply(
  manageUrl: string,
  action?: ChatwootManageBookingAction,
): string {
  const copy = getManageActionCopy(action);

  return [
    copy.intro,
    '',
    `${copy.linkLabel}：${manageUrl}`,
    '',
    copy.followup,
    '如果你想直接搵姑娘跟進，回覆「姑娘」就可以。',
  ].join('\n');
}

export function buildDirectBookingReply(): string {
  const genericBookingUrl = buildPublicUrl('/booking-whatsapp');

  return [
    '收到，如果你想預約，可以直接打開以下連結：',
    '',
    `預約：${genericBookingUrl}`,
    '',
    '如果你想更期或取消現有預約，請選擇相應項目。',
    '如果你想直接搵姑娘跟進，回覆「姑娘」就可以。',
  ].join('\n');
}

function buildGenericManageBookingReply(action?: ChatwootManageBookingAction): string {
  const manageBookingUrl = buildManageBookingUrl(action ? { action } : undefined);
  const copy = getManageActionCopy(action);

  return [
    copy.intro.replace('專屬', ''),
    '',
    `${copy.linkLabel}：${manageBookingUrl}`,
    '',
    copy.followup,
    '如果你想直接搵姑娘跟進，回覆「姑娘」就可以。',
  ].join('\n');
}

function getManageLinkTemplateConfigs(): ChatwootTemplateConfig[] {
  const configuredName = (
    process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_NAME
    || process.env.CHATWOOT_WHATSAPP_OTP_TEMPLATE_NAME
    || ''
  ).trim();
  const configuredLanguage = (
    process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_LANGUAGE
    || process.env.CHATWOOT_WHATSAPP_OTP_TEMPLATE_LANGUAGE
    || 'zh_HK'
  ).trim();
  const category = (
    process.env.CHATWOOT_WHATSAPP_MANAGE_LINK_TEMPLATE_CATEGORY
    || process.env.CHATWOOT_WHATSAPP_OTP_TEMPLATE_CATEGORY
    || 'UTILITY'
  ).trim();
  const templateNames = Array.from(new Set([configuredName, 'booking_manage_link'].filter(Boolean)));
  const languages = Array.from(new Set([configuredLanguage, 'zh_HK', 'en_US', 'en'].filter(Boolean)));

  return templateNames.flatMap((name) =>
    languages.map((language) => ({
      name,
      category,
      language,
    })),
  );
}

function extractManageButtonParameters(manageUrl: string): string[] {
  const normalizedUrl = manageUrl.trim();
  if (!normalizedUrl) return [];

  const candidates: string[] = [];
  const seen = new Set<string>();
  const pushCandidate = (value: string | null | undefined) => {
    const normalizedValue = value?.trim();
    if (!normalizedValue || seen.has(normalizedValue)) return;
    seen.add(normalizedValue);
    candidates.push(normalizedValue);
  };

  try {
    const parsedUrl = new URL(normalizedUrl);
    const token = parsedUrl.searchParams.get('token');
    const pathWithQuery = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;

    pushCandidate(pathWithQuery === '/' ? '' : pathWithQuery);
    pushCandidate(token);
  } catch {
    // Preserve the original value below when the URL is not parseable.
  }

  pushCandidate(normalizedUrl);
  return candidates;
}

function buildManageLinkTemplateProcessedParamCandidates(
  manageUrl: string,
): ChatwootTemplateProcessedParams[] {
  const candidates: ChatwootTemplateProcessedParams[] = [];
  const seen = new Set<string>();
  const pushCandidate = (candidate: ChatwootTemplateProcessedParams) => {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  for (const manageButtonParameter of extractManageButtonParameters(manageUrl)) {
    pushCandidate({
      buttons: [{ type: 'url', parameter: manageButtonParameter }],
    });
  }

  pushCandidate({});
  pushCandidate({
    body: { manage_url: manageUrl },
  });
  pushCandidate({
    body: { '1': manageUrl },
  });

  return candidates;
}

function normalizeMessageStatus(status: string | null | undefined): string | null {
  const normalized = status?.trim().toLowerCase();
  return normalized || null;
}

function parsePositiveIntegerEnv(name: string, fallback: number): number {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) return fallback;

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getDeliveryPollAttempts(): number {
  return parsePositiveIntegerEnv(
    'CHATWOOT_DELIVERY_POLL_ATTEMPTS',
    DEFAULT_CHATWOOT_DELIVERY_POLL_ATTEMPTS,
  );
}

function getDeliveryPollIntervalMs(): number {
  return parsePositiveIntegerEnv(
    'CHATWOOT_DELIVERY_POLL_INTERVAL_MS',
    DEFAULT_CHATWOOT_DELIVERY_POLL_INTERVAL_MS,
  );
}

function buildTemplateFailureDetail(
  templateConfig: ChatwootTemplateConfig,
  processedParams: ChatwootTemplateProcessedParams,
  message: ChatwootMessage | undefined,
): string {
  const status = normalizeMessageStatus(message?.status) || 'unknown';
  return `[Chatwoot] WhatsApp template delivery failed for ${templateConfig.name} (${templateConfig.language}, status=${status}) with params ${JSON.stringify(processedParams)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMessageDeliveryStatus(
  client: ChatwootClient,
  accountId: number,
  conversationId: number,
  createdMessage: ChatwootMessage | undefined,
): Promise<{ status: string | null; message: ChatwootMessage | undefined }> {
  if (!createdMessage?.id) {
    return {
      status: normalizeMessageStatus(createdMessage?.status),
      message: createdMessage,
    };
  }

  let latestMessage: ChatwootMessage | undefined = createdMessage;

  const pollAttempts = getDeliveryPollAttempts();
  const pollIntervalMs = getDeliveryPollIntervalMs();

  for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
    const messagesResponse = await client.listMessages(accountId, conversationId).catch(() => null);
    const matchedMessage = (messagesResponse?.payload || []).find((message) => message.id === createdMessage.id);

    if (matchedMessage) {
      latestMessage = matchedMessage;
    }

    const status = normalizeMessageStatus(latestMessage?.status);
    if (status && CHATWOOT_DELIVERY_TERMINAL_STATUSES.has(status)) {
      return { status, message: latestMessage };
    }

    if (attempt < pollAttempts - 1) {
      await sleep(pollIntervalMs);
    }
  }

  return {
    status: normalizeMessageStatus(latestMessage?.status),
    message: latestMessage,
  };
}

async function sendMessageWithTemplateFallback(
  client: ChatwootClient,
  accountId: number,
  conversationId: number,
  content: string,
  templateConfigs: ChatwootTemplateConfig[],
  manageUrl: string,
) {
  let lastError: unknown = null;
  const processedParamCandidates = buildManageLinkTemplateProcessedParamCandidates(manageUrl);

  for (const templateConfig of templateConfigs) {
    for (const processedParams of processedParamCandidates) {
      try {
        const message = await client.createMessage(accountId, conversationId, {
          content,
          templateParams: {
            name: templateConfig.name,
            category: templateConfig.category,
            language: templateConfig.language,
            processed_params: processedParams,
          },
        });

        const deliveryStatus = await waitForMessageDeliveryStatus(
          client,
          accountId,
          conversationId,
          message,
        );

        if (deliveryStatus.status === 'failed') {
          if (message.id) {
            await client.deleteMessage(accountId, conversationId, message.id).catch(() => undefined);
          }

          lastError = new Error(buildTemplateFailureDetail(templateConfig, processedParams, deliveryStatus.message));
          continue;
        }

        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }
}

export async function buildChatwootBookingDoctorReply(options: {
  client: ChatwootClient;
  accountId: number;
  contactId: number | null;
  contactPhone: string | null;
  action?: ChatwootManageBookingAction;
}): Promise<string> {
  const resolvedPhone = await resolveChatwootContactPhone(options.client, options.accountId, {
    contactId: options.contactId,
    contactPhone: options.contactPhone,
  });
  const phoneDigits = normalizePhoneForSearch(resolvedPhone);
  if (phoneDigits.length >= 8) {
    const manageUrl = buildManageBookingUrl({
      ...(options.action ? { action: options.action } : {}),
      token: createManageAccessToken(phoneDigits),
    });

    return buildDirectManageBookingReply(manageUrl, options.action);
  }

  return buildGenericManageBookingReply(options.action);
}

export async function sendChatwootBookingDoctorReply(options: {
  client: ChatwootClient;
  accountId: number;
  conversationId: number;
  contactId: number | null;
  contactPhone: string | null;
  action?: ChatwootManageBookingAction;
}): Promise<void> {
  const resolvedPhone = await resolveChatwootContactPhone(options.client, options.accountId, {
    contactId: options.contactId,
    contactPhone: options.contactPhone,
  });
  const phoneDigits = normalizePhoneForSearch(resolvedPhone);

  if (phoneDigits.length < 8) {
    await options.client.createMessage(
      options.accountId,
      options.conversationId,
      buildGenericManageBookingReply(options.action),
    );
    return;
  }

  const manageUrl = buildManageBookingUrl({
    ...(options.action ? { action: options.action } : {}),
    token: createManageAccessToken(phoneDigits),
  });
  const fallbackReply = buildDirectManageBookingReply(manageUrl, options.action);
  const templateConfigs = getManageLinkTemplateConfigs();

  if (templateConfigs.length > 0) {
    try {
      await sendMessageWithTemplateFallback(
        options.client,
        options.accountId,
        options.conversationId,
        fallbackReply,
        templateConfigs,
        manageUrl,
      );
      return;
    } catch (error) {
      console.warn(
        `[chatwoot-agent-bot] Manage-link template send failed, falling back to text: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  await options.client.createMessage(
    options.accountId,
    options.conversationId,
    fallbackReply,
  );
}

function resolveSelection<K extends string>(
  content: string,
  patterns: Array<{ kind: K; pattern: RegExp }>
): { kind: K; remainder: string } | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  for (const { kind, pattern } of patterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;

    const remainder = trimmed.slice(match[0].length).trim();
    return { kind, remainder };
  }

  return null;
}

export function resolveMenuSelection(
  content: string,
  options?: { allowNumeric?: boolean }
): { kind: MenuSelectionKind; remainder: string } | null {
  const allowNumeric = options?.allowNumeric ?? true;

  return resolveSelection(content, [
    {
      kind: 'main',
      pattern: /^(?:menu(?:[:：\s-]|$)|主選單(?:[:：\s-]|$)|主菜单(?:[:：\s-]|$)|返回主選單(?:[:：\s-]|$)|返回主菜单(?:[:：\s-]|$))/iu,
    },
    {
      kind: 'general',
      pattern: allowNumeric
        ? /^(?:1(?:[.)、\s-]|$)|一般查詢(?:[:：\s-]|$)|一般查询(?:[:：\s-]|$))/u
        : /^(?:一般查詢(?:[:：\s-]|$)|一般查询(?:[:：\s-]|$))/u,
    },
    {
      kind: 'booking',
      pattern: allowNumeric
        ? /^(?:2(?:[.)、\s-]|$)|預約服務(?:[:：\s-]|$)|预约服务(?:[:：\s-]|$)|預約管理(?:[:：\s-]|$)|预约管理(?:[:：\s-]|$)|管理預約(?:[:：\s-]|$)|管理预约(?:[:：\s-]|$)|立即預約(?:[:：\s-]|$)|立即预约(?:[:：\s-]|$)|新預約(?:[:：\s-]|$)|新预约(?:[:：\s-]|$)|預約(?:[:：\s-]|$)|预约(?:[:：\s-]|$))/u
        : /^(?:預約服務(?:[:：\s-]|$)|预约服务(?:[:：\s-]|$)|預約管理(?:[:：\s-]|$)|预约管理(?:[:：\s-]|$)|管理預約(?:[:：\s-]|$)|管理预约(?:[:：\s-]|$)|立即預約(?:[:：\s-]|$)|立即预约(?:[:：\s-]|$)|新預約(?:[:：\s-]|$)|新预约(?:[:：\s-]|$)|預約(?:[:：\s-]|$)|预约(?:[:：\s-]|$))/u,
    },
    {
      kind: 'reschedule',
      pattern: /^(?:更期(?:[:：\s-]|$)|更改預約(?:[:：\s-]|$)|更改预约(?:[:：\s-]|$)|更改(?:[:：\s-]|$)|改期(?:[:：\s-]|$))/u,
    },
    {
      kind: 'cancel',
      pattern: /^(?:取消預約(?:[:：\s-]|$)|取消预约(?:[:：\s-]|$)|取消(?:[:：\s-]|$))/u,
    },
    {
      kind: 'human',
      pattern: allowNumeric
        ? /^(?:3(?:[.)、\s-]|$)|想直接與姑娘對話(?:[:：\s-]|$)|想直接与姑娘对话(?:[:：\s-]|$)|想搵姑娘(?:[:：\s-]|$)|姑娘(?:[:：\s-]|$)|真人(?:[:：\s-]|$))/u
        : /^(?:想直接與姑娘對話(?:[:：\s-]|$)|想直接与姑娘对话(?:[:：\s-]|$)|想搵姑娘(?:[:：\s-]|$)|姑娘(?:[:：\s-]|$)|真人(?:[:：\s-]|$))/u,
    },
  ]);
}

export function resolveGeneralMenuSelection(
  content: string,
  options?: {
    allowNumeric?: boolean;
    labels?: Partial<Record<Exclude<GeneralSelectionKind, 'main'> | 'main', string>>;
  },
): { kind: GeneralSelectionKind; remainder: string } | null {
  const allowNumeric = options?.allowNumeric ?? true;

  return resolveSelection(content, [
    {
      kind: 'fees',
      pattern: buildMenuSelectionPattern(1, [options?.labels?.fees, '收費', '收费'], allowNumeric),
    },
    {
      kind: 'clinic',
      pattern: buildMenuSelectionPattern(2, [options?.labels?.clinic, '診所資訊', '诊所资讯'], allowNumeric),
    },
    {
      kind: 'timetable',
      pattern: buildMenuSelectionPattern(3, [options?.labels?.timetable, '醫師時間表', '医师时间表'], allowNumeric),
    },
    {
      kind: 'other',
      pattern: buildMenuSelectionPattern(4, [options?.labels?.other, '其他問題', '其他问题'], allowNumeric),
    },
    {
      kind: 'main',
      pattern: buildMenuSelectionPattern(5, [options?.labels?.main, '返回主選單', '返回主菜单'], allowNumeric),
    },
  ]);
}

export function resolveClinicMenuSelection(
  content: string,
  options?: {
    allowNumeric?: boolean;
    labels?: Partial<Record<ClinicSelectionKind, string>>;
  },
): { kind: ClinicSelectionKind; remainder: string } | null {
  const allowNumeric = options?.allowNumeric ?? true;

  return resolveSelection(content, [
    {
      kind: 'hours',
      pattern: buildMenuSelectionPattern(1, [options?.labels?.hours, '營業時間', '营业时间'], allowNumeric),
    },
    {
      kind: 'addresses',
      pattern: buildMenuSelectionPattern(2, [options?.labels?.addresses, '地址', '路線圖', '路线图'], allowNumeric),
    },
    {
      kind: 'main',
      pattern: buildMenuSelectionPattern(3, [options?.labels?.main, '返回主選單', '返回主菜单'], allowNumeric),
    },
  ]);
}

export function resolveBookingMenuSelection(
  content: string,
  options?: { allowNumeric?: boolean },
): { kind: BookingSelectionKind; remainder: string } | null {
  const allowNumeric = options?.allowNumeric ?? true;

  return resolveSelection(content, [
    {
      kind: 'new_booking',
      pattern: allowNumeric
        ? /^(?:1(?:[.)、\s-]|$)|預約(?:[:：\s-]|$)|预约(?:[:：\s-]|$)|立即預約(?:[:：\s-]|$)|立即预约(?:[:：\s-]|$)|新預約(?:[:：\s-]|$)|新预约(?:[:：\s-]|$))/u
        : /^(?:預約(?:[:：\s-]|$)|预约(?:[:：\s-]|$)|立即預約(?:[:：\s-]|$)|立即预约(?:[:：\s-]|$)|新預約(?:[:：\s-]|$)|新预约(?:[:：\s-]|$))/u,
    },
    {
      kind: 'reschedule_booking',
      pattern: allowNumeric
        ? /^(?:2(?:[.)、\s-]|$)|更期(?:[:：\s-]|$)|更改預約(?:[:：\s-]|$)|更改预约(?:[:：\s-]|$)|更改(?:[:：\s-]|$)|改期(?:[:：\s-]|$))/u
        : /^(?:更期(?:[:：\s-]|$)|更改預約(?:[:：\s-]|$)|更改预约(?:[:：\s-]|$)|更改(?:[:：\s-]|$)|改期(?:[:：\s-]|$))/u,
    },
    {
      kind: 'cancel_booking',
      pattern: allowNumeric
        ? /^(?:3(?:[.)、\s-]|$)|取消預約(?:[:：\s-]|$)|取消预约(?:[:：\s-]|$)|取消(?:[:：\s-]|$))/u
        : /^(?:取消預約(?:[:：\s-]|$)|取消预约(?:[:：\s-]|$)|取消(?:[:：\s-]|$))/u,
    },
    {
      kind: 'main',
      pattern: allowNumeric
        ? /^(?:4(?:[.)、\s-]|$)|返回主選單(?:[:：\s-]|$)|返回主菜单(?:[:：\s-]|$))/u
        : /^(?:返回主選單(?:[:：\s-]|$)|返回主菜单(?:[:：\s-]|$))/u,
    },
  ]);
}

function isActivityMessage(message: ChatwootMessage | null | undefined): boolean {
  const messageType = message?.message_type;
  return (
    messageType === 2 ||
    messageType === '2' ||
    messageType === 'activity'
  );
}

function isVisibleConversationMessage(message: ChatwootMessage | null | undefined): message is ChatwootMessage {
  const content = message?.content?.trim();
  if (!content || message?.private) return false;
  return !isActivityMessage(message);
}

function sortConversationMessages(messages: ChatwootMessage[] | undefined): ChatwootMessage[] {
  return [...(messages || [])].sort((left, right) => {
    const createdAtDiff = (left.created_at || 0) - (right.created_at || 0);
    if (createdAtDiff !== 0) return createdAtDiff;
    return Number(left.id || 0) - Number(right.id || 0);
  });
}

export function getPreviousVisibleConversationMessage(
  messages: ChatwootMessage[] | undefined,
  incomingMessageId: number,
): ChatwootMessage | undefined {
  const visibleMessages = sortConversationMessages(messages).filter(isVisibleConversationMessage);

  if (visibleMessages.length === 0) {
    return undefined;
  }

  const incomingIndex = visibleMessages.findIndex(
    (message) => String(message.id ?? '') === String(incomingMessageId),
  );

  if (incomingIndex > 0) {
    return visibleMessages[incomingIndex - 1];
  }

  if (incomingIndex === 0) {
    return undefined;
  }

  return visibleMessages.at(-1);
}

export function mergeIncomingEventIntoConversationMessages(
  messages: ChatwootMessage[] | undefined,
  event: ChatwootIncomingEvent,
): ChatwootMessage[] {
  const currentMessages = [...(messages || [])];
  const alreadyPresent = currentMessages.some(
    (message) => String(message.id ?? '') === String(event.messageId),
  );

  if (alreadyPresent) {
    return currentMessages;
  }

  const latestCreatedAt = currentMessages.reduce((latest, message) => {
    return Math.max(latest, Number(message.created_at || 0));
  }, 0);

  return [
    ...currentMessages,
    {
      id: event.messageId,
      content: event.content,
      created_at: latestCreatedAt + 1,
      message_type: 0,
      private: false,
      sender_type: 'contact',
      status: 'sent',
    },
  ];
}

export function shouldAllowGeneralAiReply(
  messages: ChatwootMessage[] | undefined,
  incomingMessageId: number,
  expectedPrompt = CHATWOOT_GENERAL_INQUIRY_PROMPT,
): boolean {
  const previousVisibleMessage = getPreviousVisibleConversationMessage(messages, incomingMessageId);
  return previousVisibleMessage?.content?.trim() === expectedPrompt;
}

function isOutgoingMessage(message: ChatwootMessage | null | undefined): boolean {
  const messageType = message?.message_type;
  return (
    messageType === 1 ||
    messageType === '1' ||
    messageType === 'outgoing'
  );
}

export function shouldDeferToHumanAfterAgentReply(
  messages: ChatwootMessage[] | undefined,
  incomingMessageId: number,
  systemMessages: Iterable<string> = DEFAULT_CHATWOOT_SYSTEM_MESSAGES,
): boolean {
  const previousVisibleMessage = getPreviousVisibleConversationMessage(messages, incomingMessageId);
  const content = previousVisibleMessage?.content?.trim();
  if (!content || !isOutgoingMessage(previousVisibleMessage)) return false;

  const hiddenSystemMessages = systemMessages instanceof Set
    ? systemMessages
    : new Set(systemMessages);

  if (hiddenSystemMessages.has(content)) return false;
  if (isPureSelection(content)) return false;

  return true;
}

export function mapConversationMessagesToLegacyChat(
  messages: ChatwootMessage[] | undefined,
  systemMessages: Iterable<string> = DEFAULT_CHATWOOT_SYSTEM_MESSAGES,
): LegacyChatMessage[] {
  const hiddenSystemMessages = systemMessages instanceof Set
    ? systemMessages
    : new Set(systemMessages);

  return (messages || [])
    .filter((message) => {
      const content = message.content?.trim();
      if (!content) return false;
      if (!isVisibleConversationMessage(message)) return false;
      if (hiddenSystemMessages.has(content)) return false;
      if (isPureSelection(content)) return false;
      return true;
    })
    .sort((left, right) => (left.created_at || 0) - (right.created_at || 0))
    .slice(-12)
    .map((message) => {
      const normalizedSenderType = typeof message.sender_type === 'string'
        ? message.sender_type.toLowerCase()
        : '';

      return {
        role: normalizedSenderType === 'contact' ? 'user' : 'assistant',
        content: message.content!.trim(),
      };
    });
}

export function replaceLatestUserMessage(
  messages: LegacyChatMessage[],
  userMessage: string,
): LegacyChatMessage[] {
  const normalized = userMessage.trim();
  if (!normalized) return messages;

  const nextMessages = [...messages];

  for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
    if (nextMessages[index]?.role !== 'user') continue;

    nextMessages[index] = {
      ...nextMessages[index],
      content: normalized,
    };
    return nextMessages;
  }

  nextMessages.push({ role: 'user', content: normalized });
  return nextMessages;
}

function isPureSelection(content: string): boolean {
  const rootSelection = resolveMenuSelection(content);
  if (rootSelection && !rootSelection.remainder) return true;

  const generalSelection = resolveGeneralMenuSelection(content);
  if (generalSelection && !generalSelection.remainder) return true;

  const bookingSelection = resolveBookingMenuSelection(content);
  if (bookingSelection && !bookingSelection.remainder) return true;

  const clinicSelection = resolveClinicMenuSelection(content);
  return Boolean(clinicSelection && !clinicSelection.remainder);
}
