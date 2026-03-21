import { createHmac, timingSafeEqual } from 'node:crypto';
import type { LegacyChatMessage } from '@/lib/legacy-chat-response';
import { DEFAULT_WIDGET_CHATBOT_SETTINGS } from '@/lib/widget-chatbot-settings';
import {
  getClinicAddressLines,
  getClinicHoursLines,
  getClinicRouteLinks,
} from '@/shared/clinic-data';

export const CHATWOOT_MAIN_MENU_PROMPT = '你好，我們是醫天圓中醫診所，請問有什麼可以幫到你？';
export const CHATWOOT_MAIN_MENU_ITEMS = [
  { title: '一般查詢', value: 'general' },
  { title: '預約', value: 'booking' },
  { title: '想直接與姑娘對話', value: 'human' },
] as const;
export const CHATWOOT_MAIN_MENU_MESSAGE = `${CHATWOOT_MAIN_MENU_PROMPT}
1. 一般查詢
2. 預約
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

export const CHATWOOT_BOOKING_ACK =
  '收到，你想查預約。我先記低，你可以等姑娘跟進。';

export const CHATWOOT_HUMAN_ACK =
  '好，我幫你轉交姑娘跟進，請稍等。';

export const CHATWOOT_TIMETABLE_MESSAGE = widgetSettings.flows.timetable.reply;

export const CHATWOOT_CLINIC_HOURS_MESSAGE = `${getClinicHoursLines().join('\n')}\n\n${widgetSettings.flows.clinic.hoursClosingText}`;

export const CHATWOOT_CLINIC_ADDRESSES_MESSAGE = `${widgetSettings.flows.clinic.addressesPrompt}\n\n${getClinicAddressLines().join('\n\n')}${clinicRouteLinkLines ? `\n\n${clinicRouteLinkLines}` : ''}`;

export const CHATWOOT_FLOW_STATE_ATTRIBUTE = 'eden_flow_state';
export const CHATWOOT_LAST_INCOMING_MESSAGE_ID_ATTRIBUTE = 'eden_last_incoming_message_id';

export type ChatwootFlowState = 'menu' | 'general_menu' | 'clinic_menu' | 'general_ai' | 'booking' | 'human';

export interface ChatwootIncomingEvent {
  accountId: number;
  conversationId: number;
  messageId: number;
  content: string;
}

interface ChatwootMessage {
  id?: number;
  content?: string | null;
  created_at?: number;
  message_type?: number | string | null;
  private?: boolean;
  sender_type?: string | null;
}

interface ChatwootConversationDetails {
  id: number;
  custom_attributes?: Record<string, unknown> | null;
  messages?: ChatwootMessage[];
}

export interface ChatwootSelectItem {
  title: string;
  value: string;
}

export interface ChatwootOutgoingMessagePayload {
  content: string;
  contentType?: 'text' | 'input_select';
  items?: ChatwootSelectItem[];
}

type MenuSelectionKind = 'general' | 'booking' | 'human';
type GeneralSelectionKind = 'fees' | 'clinic' | 'timetable' | 'other' | 'main';
type ClinicSelectionKind = 'hours' | 'addresses' | 'main';

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
        };

    return this.request(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(messagePayload),
      },
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
  const conversation = row.conversation;
  const account = row.account;
  const messageId = typeof row.id === 'number' ? row.id : Number(row.id);
  const accountId = account && typeof account === 'object'
    ? Number((account as Record<string, unknown>).id)
    : NaN;
  const conversationId = conversation && typeof conversation === 'object'
    ? Number((conversation as Record<string, unknown>).id)
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
  };
}

export function getFlowState(customAttributes: Record<string, unknown> | null | undefined): ChatwootFlowState {
  const value = typeof customAttributes?.[CHATWOOT_FLOW_STATE_ATTRIBUTE] === 'string'
    ? customAttributes[CHATWOOT_FLOW_STATE_ATTRIBUTE]
    : '';

  if (
    value === 'general_menu' ||
    value === 'clinic_menu' ||
    value === 'general_ai' ||
    value === 'booking' ||
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
        ? /^(?:2(?:[.)、\s-]|$)|預約(?:[:：\s-]|$)|预约(?:[:：\s-]|$))/u
        : /^(?:預約(?:[:：\s-]|$)|预约(?:[:：\s-]|$))/u,
    },
    {
      kind: 'human',
      pattern: allowNumeric
        ? /^(?:3(?:[.)、\s-]|$)|想直接與姑娘對話(?:[:：\s-]|$)|想直接与姑娘对话(?:[:：\s-]|$)|想搵姑娘(?:[:：\s-]|$)|姑娘(?:[:：\s-]|$)|真人(?:[:：\s-]|$))/u
        : /^(?:想直接與姑娘對話(?:[:：\s-]|$)|想直接与姑娘对话(?:[:：\s-]|$)|想搵姑娘(?:[:：\s-]|$)|姑娘(?:[:：\s-]|$)|真人(?:[:：\s-]|$))/u,
    },
  ]);
}

export function resolveGeneralMenuSelection(content: string): { kind: GeneralSelectionKind; remainder: string } | null {
  return resolveSelection(content, [
    { kind: 'fees', pattern: /^(?:1(?:[.)、\s-]|$)|收費(?:[:：\s-]|$)|收费(?:[:：\s-]|$))/u },
    { kind: 'clinic', pattern: /^(?:2(?:[.)、\s-]|$)|診所資訊(?:[:：\s-]|$)|诊所资讯(?:[:：\s-]|$))/u },
    { kind: 'timetable', pattern: /^(?:3(?:[.)、\s-]|$)|醫師時間表(?:[:：\s-]|$)|医师时间表(?:[:：\s-]|$))/u },
    { kind: 'other', pattern: /^(?:4(?:[.)、\s-]|$)|其他問題(?:[:：\s-]|$)|其他问题(?:[:：\s-]|$))/u },
    { kind: 'main', pattern: /^(?:5(?:[.)、\s-]|$)|返回主選單(?:[:：\s-]|$)|返回主菜单(?:[:：\s-]|$))/u },
  ]);
}

export function resolveClinicMenuSelection(content: string): { kind: ClinicSelectionKind; remainder: string } | null {
  return resolveSelection(content, [
    { kind: 'hours', pattern: /^(?:1(?:[.)、\s-]|$)|營業時間(?:[:：\s-]|$)|营业时间(?:[:：\s-]|$))/u },
    { kind: 'addresses', pattern: /^(?:2(?:[.)、\s-]|$)|地址(?:[:：\s-]|$)|路線圖(?:[:：\s-]|$)|路线图(?:[:：\s-]|$))/u },
    { kind: 'main', pattern: /^(?:3(?:[.)、\s-]|$)|返回主選單(?:[:：\s-]|$)|返回主菜单(?:[:：\s-]|$))/u },
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
      if (content === CHATWOOT_BOOKING_ACK) return false;
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

  const clinicSelection = resolveClinicMenuSelection(content);
  return Boolean(clinicSelection && !clinicSelection.remainder);
}
