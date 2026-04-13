import { createHmac, timingSafeEqual } from 'node:crypto';
import type { LegacyChatMessage } from '@/lib/legacy-chat-response';
import { normalizePhoneForSearch } from '@/lib/contact-utils';
import { buildManageBookingUrl, buildPublicUrl } from '@/lib/public-url';
import { createManageAccessToken } from '@/lib/widget-manage-token';
import { DEFAULT_WIDGET_CHATBOT_SETTINGS } from '@/lib/widget-chatbot-settings';
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
const clinicRouteLinkLines = getClinicRouteLinks()
  .map(({ label, href }) => `${label}: ${href}`)
  .join('\n');

export const CHATWOOT_GENERAL_MENU_PROMPT = widgetSettings.flows.clinic.prompt;
export const CHATWOOT_GENERAL_MENU_ITEMS = [
  { title: '收費', value: 'fees' },
  { title: '診所資訊', value: 'clinic' },
  { title: '醫師時間表', value: 'timetable' },
  { title: '其他問題', value: 'other' },
  { title: '返回主選單', value: 'main' },
] as const;
export const CHATWOOT_GENERAL_MENU_MESSAGE = `${CHATWOOT_GENERAL_MENU_PROMPT}
1. 收費
2. 診所資訊
3. 醫師時間表
4. 其他問題
5. 返回主選單`;

export const CHATWOOT_CLINIC_MENU_PROMPT = widgetSettings.flows.clinic.prompt;
export const CHATWOOT_CLINIC_MENU_ITEMS = [
  { title: widgetSettings.flows.clinic.hoursButtonLabel, value: 'hours' },
  { title: widgetSettings.flows.clinic.addressesButtonLabel, value: 'addresses' },
  { title: widgetSettings.flows.clinic.backButtonLabel, value: 'main' },
] as const;
export const CHATWOOT_CLINIC_MENU_MESSAGE = `${CHATWOOT_CLINIC_MENU_PROMPT}
1. ${widgetSettings.flows.clinic.hoursButtonLabel}
2. ${widgetSettings.flows.clinic.addressesButtonLabel}
3. ${widgetSettings.flows.clinic.backButtonLabel}`;

export const CHATWOOT_GENERAL_INQUIRY_PROMPT =
  '可以呀，請直接講你想問嘅內容，我會盡快幫你。';

export const CHATWOOT_FEES_MESSAGE = widgetSettings.flows.fees.reply;

export const CHATWOOT_BOOKING_MENU_PROMPT =
  '你好，請選擇你想處理的預約項目：';
export const CHATWOOT_BOOKING_MENU_ITEMS = [
  { title: '立即預約', value: 'new_booking' },
  { title: '管理預約', value: 'manage_booking' },
  { title: '返回主選單', value: 'main' },
] as const;
export const CHATWOOT_BOOKING_MENU_MESSAGE = `${CHATWOOT_BOOKING_MENU_PROMPT}
1. 立即預約
2. 管理預約
3. 返回主選單`;

export const CHATWOOT_HUMAN_ACK =
  '好，我幫你轉交姑娘跟進，請稍等。';

export const CHATWOOT_TIMETABLE_MESSAGE = widgetSettings.flows.timetable.reply;

export const CHATWOOT_CLINIC_HOURS_MESSAGE = `${getClinicHoursLines().join('\n')}\n\n${widgetSettings.flows.clinic.hoursClosingText}`;

export const CHATWOOT_CLINIC_ADDRESSES_MESSAGE = `${widgetSettings.flows.clinic.addressesPrompt}\n\n${getClinicAddressLines().join('\n\n')}${clinicRouteLinkLines ? `\n\n${clinicRouteLinkLines}` : ''}`;

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

type MenuSelectionKind = 'general' | 'booking' | 'manage' | 'human';
type GeneralSelectionKind = 'fees' | 'clinic' | 'timetable' | 'other' | 'main';
type ClinicSelectionKind = 'hours' | 'addresses' | 'main';
type BookingSelectionKind = 'new_booking' | 'manage_booking' | 'main';

const CHATWOOT_DELIVERY_TERMINAL_STATUSES = new Set(['failed', 'delivered', 'read']);
const CHATWOOT_DELIVERY_POLL_ATTEMPTS = 4;
const CHATWOOT_DELIVERY_POLL_INTERVAL_MS = 1000;

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

function buildDirectManageBookingReply(manageUrl: string): string {
  return [
    '收到，你可以直接打開以下專屬預約管理連結：',
    '',
    `管理預約：${manageUrl}`,
    '',
    '進入後可以查看、更改或取消預約。',
    '如果你想直接搵姑娘跟進，回覆「姑娘」就可以。',
  ].join('\n');
}

export function buildDirectBookingReply(): string {
  const genericBookingUrl = buildPublicUrl('/booking-whatsapp');

  return [
    '收到，如果你想立即預約，可以直接打開以下連結：',
    '',
    `立即預約：${genericBookingUrl}`,
    '',
    '如果你想查看、更改或取消現有預約，請選擇「管理預約」。',
    '如果你想直接搵姑娘跟進，回覆「姑娘」就可以。',
  ].join('\n');
}

function buildGenericManageBookingReply(): string {
  const manageBookingUrl = buildManageBookingUrl();

  return [
    '收到，你可以用以下連結管理現有預約：',
    '',
    `管理預約：${manageBookingUrl}`,
    '',
    '進入後可以查看、更改或取消預約。',
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

  for (let attempt = 0; attempt < CHATWOOT_DELIVERY_POLL_ATTEMPTS; attempt += 1) {
    const messagesResponse = await client.listMessages(accountId, conversationId).catch(() => null);
    const matchedMessage = (messagesResponse?.payload || []).find((message) => message.id === createdMessage.id);

    if (matchedMessage) {
      latestMessage = matchedMessage;
    }

    const status = normalizeMessageStatus(latestMessage?.status);
    if (status && CHATWOOT_DELIVERY_TERMINAL_STATUSES.has(status)) {
      return { status, message: latestMessage };
    }

    if (attempt < CHATWOOT_DELIVERY_POLL_ATTEMPTS - 1) {
      await sleep(CHATWOOT_DELIVERY_POLL_INTERVAL_MS);
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
}): Promise<string> {
  const resolvedPhone = await resolveChatwootContactPhone(options.client, options.accountId, {
    contactId: options.contactId,
    contactPhone: options.contactPhone,
  });
  const phoneDigits = normalizePhoneForSearch(resolvedPhone);
  if (phoneDigits.length >= 8) {
    const manageUrl = buildManageBookingUrl({
      token: createManageAccessToken(phoneDigits),
    });

    return buildDirectManageBookingReply(manageUrl);
  }

  return buildGenericManageBookingReply();
}

export async function sendChatwootBookingDoctorReply(options: {
  client: ChatwootClient;
  accountId: number;
  conversationId: number;
  contactId: number | null;
  contactPhone: string | null;
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
      buildGenericManageBookingReply(),
    );
    return;
  }

  const manageUrl = buildManageBookingUrl({
    token: createManageAccessToken(phoneDigits),
  });
  const fallbackReply = buildDirectManageBookingReply(manageUrl);
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
      kind: 'general',
      pattern: allowNumeric
        ? /^(?:1(?:[.)、\s-]|$)|一般查詢(?:[:：\s-]|$)|一般查询(?:[:：\s-]|$))/u
        : /^(?:一般查詢(?:[:：\s-]|$)|一般查询(?:[:：\s-]|$))/u,
    },
    {
      kind: 'booking',
      pattern: allowNumeric
        ? /^(?:2(?:[.)、\s-]|$)|預約服務(?:[:：\s-]|$)|预约服务(?:[:：\s-]|$)|立即預約(?:[:：\s-]|$)|立即预约(?:[:：\s-]|$)|新預約(?:[:：\s-]|$)|新预约(?:[:：\s-]|$)|預約(?:[:：\s-]|$)|预约(?:[:：\s-]|$))/u
        : /^(?:預約服務(?:[:：\s-]|$)|预约服务(?:[:：\s-]|$)|立即預約(?:[:：\s-]|$)|立即预约(?:[:：\s-]|$)|新預約(?:[:：\s-]|$)|新预约(?:[:：\s-]|$)|預約(?:[:：\s-]|$)|预约(?:[:：\s-]|$))/u,
    },
    {
      kind: 'manage',
      pattern: /^(?:管理預約(?:[:：\s-]|$)|管理预约(?:[:：\s-]|$)|預約管理(?:[:：\s-]|$)|预约管理(?:[:：\s-]|$)|更改預約(?:[:：\s-]|$)|更改预约(?:[:：\s-]|$)|更改(?:[:：\s-]|$)|改期(?:[:：\s-]|$)|取消預約(?:[:：\s-]|$)|取消预约(?:[:：\s-]|$)|取消(?:[:：\s-]|$))/u,
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
  options?: { allowNumeric?: boolean },
): { kind: GeneralSelectionKind; remainder: string } | null {
  const allowNumeric = options?.allowNumeric ?? true;

  return resolveSelection(content, [
    {
      kind: 'fees',
      pattern: allowNumeric
        ? /^(?:1(?:[.)、\s-]|$)|收費(?:[:：\s-]|$)|收费(?:[:：\s-]|$))/u
        : /^(?:收費(?:[:：\s-]|$)|收费(?:[:：\s-]|$))/u,
    },
    {
      kind: 'clinic',
      pattern: allowNumeric
        ? /^(?:2(?:[.)、\s-]|$)|診所資訊(?:[:：\s-]|$)|诊所资讯(?:[:：\s-]|$))/u
        : /^(?:診所資訊(?:[:：\s-]|$)|诊所资讯(?:[:：\s-]|$))/u,
    },
    {
      kind: 'timetable',
      pattern: allowNumeric
        ? /^(?:3(?:[.)、\s-]|$)|醫師時間表(?:[:：\s-]|$)|医师时间表(?:[:：\s-]|$))/u
        : /^(?:醫師時間表(?:[:：\s-]|$)|医师时间表(?:[:：\s-]|$))/u,
    },
    {
      kind: 'other',
      pattern: allowNumeric
        ? /^(?:4(?:[.)、\s-]|$)|其他問題(?:[:：\s-]|$)|其他问题(?:[:：\s-]|$))/u
        : /^(?:其他問題(?:[:：\s-]|$)|其他问题(?:[:：\s-]|$))/u,
    },
    {
      kind: 'main',
      pattern: allowNumeric
        ? /^(?:5(?:[.)、\s-]|$)|返回主選單(?:[:：\s-]|$)|返回主菜单(?:[:：\s-]|$))/u
        : /^(?:返回主選單(?:[:：\s-]|$)|返回主菜单(?:[:：\s-]|$))/u,
    },
  ]);
}

export function resolveClinicMenuSelection(content: string): { kind: ClinicSelectionKind; remainder: string } | null {
  return resolveSelection(content, [
    { kind: 'hours', pattern: /^(?:1(?:[.)、\s-]|$)|營業時間(?:[:：\s-]|$)|营业时间(?:[:：\s-]|$))/u },
    { kind: 'addresses', pattern: /^(?:2(?:[.)、\s-]|$)|地址(?:[:：\s-]|$)|路線圖(?:[:：\s-]|$)|路线图(?:[:：\s-]|$))/u },
    { kind: 'main', pattern: /^(?:3(?:[.)、\s-]|$)|返回主選單(?:[:：\s-]|$)|返回主菜单(?:[:：\s-]|$))/u },
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
        ? /^(?:1(?:[.)、\s-]|$)|立即預約(?:[:：\s-]|$)|立即预约(?:[:：\s-]|$)|新預約(?:[:：\s-]|$)|新预约(?:[:：\s-]|$)|預約服務(?:[:：\s-]|$)|预约服务(?:[:：\s-]|$)|預約(?:[:：\s-]|$)|预约(?:[:：\s-]|$))/u
        : /^(?:立即預約(?:[:：\s-]|$)|立即预约(?:[:：\s-]|$)|新預約(?:[:：\s-]|$)|新预约(?:[:：\s-]|$)|預約服務(?:[:：\s-]|$)|预约服务(?:[:：\s-]|$)|預約(?:[:：\s-]|$)|预约(?:[:：\s-]|$))/u,
    },
    {
      kind: 'manage_booking',
      pattern: allowNumeric
        ? /^(?:2(?:[.)、\s-]|$)|管理預約(?:[:：\s-]|$)|管理预约(?:[:：\s-]|$)|預約管理(?:[:：\s-]|$)|预约管理(?:[:：\s-]|$)|更改預約(?:[:：\s-]|$)|更改预约(?:[:：\s-]|$)|更改(?:[:：\s-]|$)|改期(?:[:：\s-]|$)|取消預約(?:[:：\s-]|$)|取消预约(?:[:：\s-]|$)|取消(?:[:：\s-]|$))/u
        : /^(?:管理預約(?:[:：\s-]|$)|管理预约(?:[:：\s-]|$)|預約管理(?:[:：\s-]|$)|预约管理(?:[:：\s-]|$)|更改預約(?:[:：\s-]|$)|更改预约(?:[:：\s-]|$)|更改(?:[:：\s-]|$)|改期(?:[:：\s-]|$)|取消預約(?:[:：\s-]|$)|取消预约(?:[:：\s-]|$)|取消(?:[:：\s-]|$))/u,
    },
    {
      kind: 'main',
      pattern: allowNumeric
        ? /^(?:3(?:[.)、\s-]|$)|返回主選單(?:[:：\s-]|$)|返回主菜单(?:[:：\s-]|$))/u
        : /^(?:返回主選單(?:[:：\s-]|$)|返回主菜单(?:[:：\s-]|$))/u,
    },
  ]);
}

export function mapConversationMessagesToLegacyChat(
  messages: ChatwootMessage[] | undefined,
): LegacyChatMessage[] {
  return (messages || [])
    .filter((message) => {
      const content = message.content?.trim();
      const messageType = message.message_type;
      const isActivity =
        messageType === 2 ||
        messageType === '2' ||
        messageType === 'activity';

      if (!content || message.private) return false;
      if (isActivity) return false;
      if (content === CHATWOOT_GENERAL_INQUIRY_PROMPT) return false;
      if (content === CHATWOOT_GENERAL_MENU_PROMPT) return false;
      if (content === CHATWOOT_GENERAL_MENU_MESSAGE) return false;
      if (content === CHATWOOT_CLINIC_MENU_PROMPT) return false;
      if (content === CHATWOOT_CLINIC_MENU_MESSAGE) return false;
      if (content === CHATWOOT_FEES_MESSAGE) return false;
      if (content === CHATWOOT_BOOKING_MENU_PROMPT) return false;
      if (content === CHATWOOT_BOOKING_MENU_MESSAGE) return false;
      if (content === CHATWOOT_HUMAN_ACK) return false;
      if (content === CHATWOOT_TIMETABLE_MESSAGE) return false;
      if (content === CHATWOOT_CLINIC_HOURS_MESSAGE) return false;
      if (content === CHATWOOT_CLINIC_ADDRESSES_MESSAGE) return false;
      if (content === CHATWOOT_MAIN_MENU_PROMPT) return false;
      if (content === CHATWOOT_MAIN_MENU_MESSAGE) return false;
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
