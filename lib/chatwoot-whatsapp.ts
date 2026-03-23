import { normalizePhoneForSearch } from '@/lib/contact-utils';
import {
  buildWhatsappManageVerificationTemplateBodyParams,
  buildWhatsappManageVerificationText,
} from '@/lib/whatsapp-manage';
import {
  buildWhatsappConfirmationText,
  buildWhatsappReminderTemplateBodyParams,
  buildWhatsappReminderText,
  buildWhatsappTemplateBodyParams,
  normalizeWhatsappPhoneNumber,
  normalizeWhatsappSourceId,
  type BookingWhatsappConfirmationInput,
  type BookingWhatsappReminderInput,
} from '@/lib/whatsapp-booking';

interface ChatwootProfile {
  account_id?: number;
  accounts?: Array<{
    id?: number;
  }>;
}

interface ChatwootInbox {
  id?: number;
  channel_type?: string | null;
  provider?: string | null;
  medium?: string | null;
  phone_number?: string | null;
  message_templates?: ChatwootMessageTemplate[] | null;
}

interface ChatwootMessageTemplate {
  name?: string | null;
  language?: string | null;
  status?: string | null;
  category?: string | null;
}

interface ChatwootContactInbox {
  source_id?: string | null;
  inbox?: {
    id?: number;
  } | null;
}

interface ChatwootContact {
  id?: number;
  name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  contact_inboxes?: ChatwootContactInbox[] | null;
}

interface ChatwootContactSearchResponse {
  payload?: ChatwootContact[];
}

interface ChatwootContactableInboxesResponse {
  payload?: ChatwootContactInbox[];
}

interface ChatwootConversation {
  id?: number;
  inbox_id?: number;
  status?: string | null;
}

interface ChatwootConversationListResponse {
  payload?: ChatwootConversation[];
}

interface ChatwootCreateConversationResponse {
  id?: number;
}

interface ChatwootMessagePayload {
  content: string;
  template_params?: {
    name: string;
    category: string;
    language: string;
    processed_params: {
      body: Record<string, string>;
    };
  };
}

interface BookingWhatsappNotificationInput extends BookingWhatsappConfirmationInput {
  phone: string;
  email: string;
  clinicWhatsappPhone?: string | null;
}

interface BookingWhatsappReminderNotificationInput extends BookingWhatsappReminderInput {
  phone: string;
  email: string;
  clinicWhatsappPhone?: string | null;
}

interface BookingManageWhatsappOtpInput {
  patientName: string;
  phone: string;
  email: string;
  code: string;
  expiryMinutes?: number;
  clinicWhatsappPhone?: string | null;
}

interface SendWhatsappBookingConfirmationResult {
  success: boolean;
  conversationId?: number;
  whatsappSent: boolean;
  error?: string;
}

type ResolvedContact = {
  contactId: number;
  sourceId: string;
};

type TemplateConfig = {
  name: string;
  category: string;
  language: string;
};

class ChatwootWhatsappClient {
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

  getProfile() {
    return this.request<ChatwootProfile>('/api/v1/profile', { method: 'GET' });
  }

  listInboxes(accountId: number) {
    return this.request<{ payload?: ChatwootInbox[] }>(
      `/api/v1/accounts/${accountId}/inboxes`,
      { method: 'GET' },
    );
  }

  syncInboxTemplates(accountId: number, inboxId: number) {
    return this.request<{ message?: string; error?: string }>(
      `/api/v1/accounts/${accountId}/inboxes/${inboxId}/sync_templates`,
      { method: 'POST' },
    );
  }

  searchContacts(accountId: number, query: string) {
    const searchParams = new URLSearchParams({ q: query });

    return this.request<ChatwootContactSearchResponse>(
      `/api/v1/accounts/${accountId}/contacts/search?${searchParams.toString()}`,
      { method: 'GET' },
    );
  }

  createContact(accountId: number, payload: {
    inbox_id: number;
    name: string;
    email: string;
    phone_number: string;
  }) {
    return this.request<ChatwootContact>(
      `/api/v1/accounts/${accountId}/contacts`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  getContactableInboxes(accountId: number, contactId: number) {
    return this.request<ChatwootContactableInboxesResponse>(
      `/api/v1/accounts/${accountId}/contacts/${contactId}/contactable_inboxes`,
      { method: 'GET' },
    );
  }

  createContactInbox(accountId: number, contactId: number, payload: {
    inbox_id: number;
    source_id: string;
  }) {
    return this.request<ChatwootContactInbox>(
      `/api/v1/accounts/${accountId}/contacts/${contactId}/contact_inboxes`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  getContactConversations(accountId: number, contactId: number) {
    return this.request<ChatwootConversationListResponse>(
      `/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`,
      { method: 'GET' },
    );
  }

  createConversation(accountId: number, payload: {
    inbox_id: number;
    contact_id: number;
    source_id: string;
    status: 'open';
  }) {
    return this.request<ChatwootCreateConversationResponse>(
      `/api/v1/accounts/${accountId}/conversations`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  }

  createMessage(accountId: number, conversationId: number, payload: ChatwootMessagePayload) {
    return this.request(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: payload.content,
          message_type: 'outgoing',
          private: false,
          ...(payload.template_params ? { template_params: payload.template_params } : {}),
        }),
      },
    );
  }
}

function getSafeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseOptionalInteger(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function findMatchingContact(
  contacts: ChatwootContact[],
  normalizedPhone: string,
  normalizedEmail: string,
): ChatwootContact | null {
  const phoneDigits = normalizePhoneForSearch(normalizedPhone);

  const phoneMatch = contacts.find((contact) => {
    const contactPhoneDigits = normalizePhoneForSearch(contact.phone_number);
    return Boolean(contact.id) && contactPhoneDigits === phoneDigits;
  });
  if (phoneMatch) return phoneMatch;

  const emailMatch = contacts.find((contact) => {
    return Boolean(contact.id) && normalizeEmail(contact.email || '') === normalizedEmail;
  });

  return emailMatch || null;
}

function findExistingConversation(
  conversations: ChatwootConversation[],
  inboxId: number,
): ChatwootConversation | null {
  const sameInboxConversations = conversations.filter(
    (conversation) => conversation.inbox_id === inboxId && conversation.id,
  );
  if (sameInboxConversations.length === 0) {
    return null;
  }

  const preferredConversation = sameInboxConversations.find(
    (conversation) => conversation.status && conversation.status !== 'resolved',
  );

  return preferredConversation || sameInboxConversations[0];
}

async function resolveAccountId(
  client: ChatwootWhatsappClient,
  configuredAccountId: number | null,
): Promise<number> {
  if (configuredAccountId) {
    return configuredAccountId;
  }

  const profile = await client.getProfile();
  if (typeof profile.account_id === 'number' && profile.account_id > 0) {
    return profile.account_id;
  }

  const accountId = profile.accounts?.find((account) => typeof account.id === 'number')?.id;
  if (typeof accountId === 'number' && accountId > 0) {
    return accountId;
  }

  throw new Error('Unable to resolve Chatwoot account id');
}

async function resolveWhatsappInboxId(
  client: ChatwootWhatsappClient,
  accountId: number,
  configuredInboxId: number | null,
  clinicWhatsappPhone?: string | null,
): Promise<ChatwootInbox> {
  const inboxResponse = await client.listInboxes(accountId);
  const whatsappInboxes = (inboxResponse.payload || []).filter((inbox) => {
    return inbox.channel_type === 'Channel::Whatsapp'
      || inbox.medium === 'whatsapp'
      || inbox.provider === 'whatsapp_cloud';
  });

  if (configuredInboxId) {
    const matchedConfiguredInbox = whatsappInboxes.find((inbox) => inbox.id === configuredInboxId);
    if (!matchedConfiguredInbox) {
      throw new Error(`Configured Chatwoot WhatsApp inbox ${configuredInboxId} not found`);
    }
    return matchedConfiguredInbox;
  }

  if (whatsappInboxes.length === 0) {
    throw new Error('No Chatwoot WhatsApp inbox found');
  }

  const targetClinicDigits = normalizePhoneForSearch(clinicWhatsappPhone);
  if (targetClinicDigits) {
    const matchedInbox = whatsappInboxes.find((inbox) => {
      return normalizePhoneForSearch(inbox.phone_number) === targetClinicDigits;
    });

    if (matchedInbox?.id) {
      return matchedInbox;
    }
  }

  if (whatsappInboxes.length === 1 && whatsappInboxes[0]?.id) {
    return whatsappInboxes[0];
  }

  throw new Error('Multiple Chatwoot WhatsApp inboxes found; set CHATWOOT_WHATSAPP_INBOX_ID');
}

async function refreshInboxTemplates(
  client: ChatwootWhatsappClient,
  accountId: number,
  inbox: ChatwootInbox,
): Promise<ChatwootInbox> {
  if (!inbox.id) {
    return inbox;
  }

  try {
    await client.syncInboxTemplates(accountId, inbox.id);
    const inboxResponse = await client.listInboxes(accountId);
    const refreshedInbox = (inboxResponse.payload || []).find((candidate) => candidate.id === inbox.id);
    return refreshedInbox || inbox;
  } catch {
    return inbox;
  }
}

async function ensureWhatsappContact(
  client: ChatwootWhatsappClient,
  accountId: number,
  inboxId: number,
  patientName: string,
  phone: string,
  email: string,
): Promise<ResolvedContact> {
  const normalizedPhone = normalizeWhatsappPhoneNumber(phone);
  const normalizedEmail = normalizeEmail(email);
  const sourceId = normalizeWhatsappSourceId(normalizedPhone);
  if (!normalizedPhone || !sourceId) {
    throw new Error('Invalid patient phone number for WhatsApp');
  }

  const searchQueries = Array.from(
    new Set([normalizedPhone, normalizedPhone.replace(/^\+/, ''), normalizedEmail].filter(Boolean)),
  );

  let contact: ChatwootContact | null = null;
  for (const query of searchQueries) {
    const response = await client.searchContacts(accountId, query);
    const match = findMatchingContact(response.payload || [], normalizedPhone, normalizedEmail);
    if (match) {
      contact = match;
      break;
    }
  }

  if (!contact?.id) {
    contact = await client.createContact(accountId, {
      inbox_id: inboxId,
      name: patientName,
      email: normalizedEmail,
      phone_number: normalizedPhone,
    });
  }

  if (!contact?.id) {
    throw new Error('Failed to resolve Chatwoot contact');
  }

  const contactableInboxes = await client.getContactableInboxes(accountId, contact.id);
  const existingContactInbox = (contactableInboxes.payload || []).find((contactInbox) => {
    return contactInbox.inbox?.id === inboxId && contactInbox.source_id;
  });

  if (existingContactInbox?.source_id) {
    return {
      contactId: contact.id,
      sourceId: existingContactInbox.source_id,
    };
  }

  await client.createContactInbox(accountId, contact.id, {
    inbox_id: inboxId,
    source_id: sourceId,
  });

  return {
    contactId: contact.id,
    sourceId,
  };
}

function getTemplateConfigs(inbox: ChatwootInbox): TemplateConfig[] {
  return getNamedTemplateConfigs(inbox, {
    configuredName: process.env.CHATWOOT_WHATSAPP_TEMPLATE_NAME,
    configuredLanguage: process.env.CHATWOOT_WHATSAPP_TEMPLATE_LANGUAGE,
    configuredCategory: process.env.CHATWOOT_WHATSAPP_TEMPLATE_CATEGORY,
    fallbackNames: ['booking_confirm'],
    defaultCategory: 'UTILITY',
  });
}

function getReminderTemplateConfigs(inbox: ChatwootInbox): TemplateConfig[] {
  return getNamedTemplateConfigs(inbox, {
    configuredName: process.env.CHATWOOT_WHATSAPP_REMINDER_TEMPLATE_NAME,
    configuredLanguage: process.env.CHATWOOT_WHATSAPP_REMINDER_TEMPLATE_LANGUAGE,
    configuredCategory: process.env.CHATWOOT_WHATSAPP_REMINDER_TEMPLATE_CATEGORY,
    fallbackNames: ['booking_reminder_24h'],
    defaultCategory: 'UTILITY',
  });
}

function getOtpTemplateConfigs(inbox: ChatwootInbox): TemplateConfig[] {
  const configuredName = (process.env.CHATWOOT_WHATSAPP_OTP_TEMPLATE_NAME || '').trim();
  const configuredLanguage = (process.env.CHATWOOT_WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'zh_HK').trim();
  const category = (process.env.CHATWOOT_WHATSAPP_OTP_TEMPLATE_CATEGORY || 'UTILITY').trim();

  if (!configuredName) {
    return [];
  }

  const syncedTemplates = (inbox.message_templates || []).filter((template) => {
    if (!template.name || !template.language) return false;
    if (template.name !== configuredName) return false;
    return String(template.status || '').toLowerCase() === 'approved';
  });

  if (syncedTemplates.length > 0) {
    return syncedTemplates
      .sort((left, right) => {
        if (left.language === configuredLanguage) return -1;
        if (right.language === configuredLanguage) return 1;
        return 0;
      })
      .map((template) => ({
        name: template.name || configuredName,
        category: (template.category || category).trim(),
        language: (template.language || configuredLanguage).trim(),
      }));
  }

  return [
    {
      name: configuredName,
      category,
      language: configuredLanguage,
    },
  ];
}

function getNamedTemplateConfigs(
  inbox: ChatwootInbox,
  options: {
    configuredName?: string;
    configuredLanguage?: string;
    configuredCategory?: string;
    fallbackNames: string[];
    defaultCategory: string;
  },
): TemplateConfig[] {
  const configuredName = (options.configuredName || '').trim();
  const configuredLanguage = (options.configuredLanguage || '').trim();
  const category = (options.configuredCategory || options.defaultCategory).trim();

  const templateNames = Array.from(
    new Set([configuredName, ...options.fallbackNames].filter(Boolean)),
  );

  const syncedTemplates = (inbox.message_templates || []).filter((template) => {
    if (!template.name || !template.language) return false;
    if (!templateNames.includes(template.name)) return false;
    return String(template.status || '').toLowerCase() === 'approved';
  });

  const preferredSyncedTemplates = syncedTemplates
    .filter((template) => {
      if (!configuredLanguage) return true;
      return template.language === configuredLanguage;
    })
    .sort((left, right) => {
      if (left.language === configuredLanguage) return -1;
      if (right.language === configuredLanguage) return 1;
      return 0;
    });

  if (preferredSyncedTemplates.length > 0) {
    return preferredSyncedTemplates.map((template) => ({
      name: template.name || configuredName || options.fallbackNames[0] || '',
      category: (template.category || category).trim(),
      language: (template.language || configuredLanguage || 'en').trim(),
    })).filter((template) => Boolean(template.name));
  }

  const languages = Array.from(
    new Set([configuredLanguage, 'en_US', 'en', 'zh_HK'].filter(Boolean)),
  );

  return templateNames.flatMap((name) =>
    languages.map((language) => ({
      name,
      category,
      language,
    })),
  );
}

async function sendMessageWithTemplateFallback(
  client: ChatwootWhatsappClient,
  accountId: number,
  conversationId: number,
  content: string,
  templateConfigs: TemplateConfig[],
  bodyParams: Record<string, string>,
) {
  let lastError: unknown = null;

  for (const templateConfig of templateConfigs) {
    try {
      await client.createMessage(accountId, conversationId, {
        content,
        template_params: {
          name: templateConfig.name,
          category: templateConfig.category,
          language: templateConfig.language,
          processed_params: {
            body: bodyParams,
          },
        },
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  await client.createMessage(accountId, conversationId, {
    content,
  });
}

async function sendBookingWhatsappNotification(
  input: {
    patientName: string;
    phone: string;
    email: string;
    clinicWhatsappPhone?: string | null;
  },
  options: {
    buildContent: () => string;
    buildBodyParams: () => Record<string, string>;
    getTemplateConfigs: (inbox: ChatwootInbox) => TemplateConfig[];
  },
): Promise<SendWhatsappBookingConfirmationResult> {
  const baseUrl = (process.env.CHATWOOT_BASE_URL || '').trim().replace(/\/$/, '');
  const apiAccessToken = (process.env.CHATWOOT_API_ACCESS_TOKEN || '').trim();

  if (!baseUrl) {
    throw new Error('CHATWOOT_BASE_URL is not configured');
  }

  if (!apiAccessToken) {
    throw new Error('CHATWOOT_API_ACCESS_TOKEN is not configured');
  }

  const client = new ChatwootWhatsappClient(baseUrl, apiAccessToken);
  const accountId = await resolveAccountId(
    client,
    parseOptionalInteger(process.env.CHATWOOT_ACCOUNT_ID),
  );
  const initialInbox = await resolveWhatsappInboxId(
    client,
    accountId,
    parseOptionalInteger(process.env.CHATWOOT_WHATSAPP_INBOX_ID),
    input.clinicWhatsappPhone,
  );
  const inbox = await refreshInboxTemplates(client, accountId, initialInbox);
  const inboxId = inbox.id;
  if (!inboxId) {
    throw new Error('Resolved Chatwoot WhatsApp inbox is missing an id');
  }

  const contact = await ensureWhatsappContact(
    client,
    accountId,
    inboxId,
    input.patientName,
    input.phone,
    input.email,
  );

  const conversationsResponse = await client.getContactConversations(accountId, contact.contactId);
  const existingConversation = findExistingConversation(conversationsResponse.payload || [], inboxId);

  let conversationId = existingConversation?.id;
  if (!conversationId) {
    const conversation = await client.createConversation(accountId, {
      inbox_id: inboxId,
      contact_id: contact.contactId,
      source_id: contact.sourceId,
      status: 'open',
    });

    if (!conversation.id) {
      throw new Error('Failed to create Chatwoot conversation');
    }

    conversationId = conversation.id;
  }

  if (!conversationId) {
    throw new Error('Failed to resolve Chatwoot conversation');
  }

  const content = options.buildContent();
  const templateConfigs = options.getTemplateConfigs(inbox);
  const bodyParams = options.buildBodyParams();

  if (templateConfigs.length > 0) {
    await sendMessageWithTemplateFallback(
      client,
      accountId,
      conversationId,
      content,
      templateConfigs,
      bodyParams,
    );
  } else {
    await client.createMessage(accountId, conversationId, {
      content,
    });
  }

  return {
    success: true,
    whatsappSent: true,
    conversationId,
  };
}

export async function sendBookingConfirmationWhatsapp(
  input: BookingWhatsappNotificationInput,
): Promise<SendWhatsappBookingConfirmationResult> {
  try {
    return await sendBookingWhatsappNotification(input, {
      buildContent: () => buildWhatsappConfirmationText(input),
      buildBodyParams: () => buildWhatsappTemplateBodyParams(input),
      getTemplateConfigs,
    });
  } catch (error) {
    return {
      success: false,
      whatsappSent: false,
      error: getSafeErrorMessage(error),
    };
  }
}

export async function sendBookingReminderWhatsapp(
  input: BookingWhatsappReminderNotificationInput,
): Promise<SendWhatsappBookingConfirmationResult> {
  try {
    return await sendBookingWhatsappNotification(input, {
      buildContent: () => buildWhatsappReminderText(input),
      buildBodyParams: () => buildWhatsappReminderTemplateBodyParams(input),
      getTemplateConfigs: getReminderTemplateConfigs,
    });
  } catch (error) {
    return {
      success: false,
      whatsappSent: false,
      error: getSafeErrorMessage(error),
    };
  }
}

export async function sendBookingManageOtpWhatsapp(
  input: BookingManageWhatsappOtpInput,
): Promise<SendWhatsappBookingConfirmationResult> {
  try {
    const baseUrl = (process.env.CHATWOOT_BASE_URL || '').trim().replace(/\/$/, '');
    const apiAccessToken = (process.env.CHATWOOT_API_ACCESS_TOKEN || '').trim();

    if (!baseUrl) {
      throw new Error('CHATWOOT_BASE_URL is not configured');
    }

    if (!apiAccessToken) {
      throw new Error('CHATWOOT_API_ACCESS_TOKEN is not configured');
    }

    const client = new ChatwootWhatsappClient(baseUrl, apiAccessToken);
    const accountId = await resolveAccountId(
      client,
      parseOptionalInteger(process.env.CHATWOOT_ACCOUNT_ID),
    );
    const initialInbox = await resolveWhatsappInboxId(
      client,
      accountId,
      parseOptionalInteger(process.env.CHATWOOT_WHATSAPP_INBOX_ID),
      input.clinicWhatsappPhone,
    );
    const inbox = await refreshInboxTemplates(client, accountId, initialInbox);
    const inboxId = inbox.id;
    if (!inboxId) {
      throw new Error('Resolved Chatwoot WhatsApp inbox is missing an id');
    }

    const contact = await ensureWhatsappContact(
      client,
      accountId,
      inboxId,
      input.patientName,
      input.phone,
      input.email,
    );

    const conversationsResponse = await client.getContactConversations(accountId, contact.contactId);
    const existingConversation = findExistingConversation(conversationsResponse.payload || [], inboxId);

    let conversationId = existingConversation?.id;
    if (!conversationId) {
      const conversation = await client.createConversation(accountId, {
        inbox_id: inboxId,
        contact_id: contact.contactId,
        source_id: contact.sourceId,
        status: 'open',
      });

      if (!conversation.id) {
        throw new Error('Failed to create Chatwoot conversation');
      }

      conversationId = conversation.id;
    }

    if (!conversationId) {
      throw new Error('Failed to resolve Chatwoot conversation');
    }

    const content = buildWhatsappManageVerificationText({
      patientName: input.patientName,
      code: input.code,
      expiryMinutes: input.expiryMinutes,
    });
    const templateConfigs = getOtpTemplateConfigs(inbox);
    const bodyParams = buildWhatsappManageVerificationTemplateBodyParams({
      patientName: input.patientName,
      code: input.code,
      expiryMinutes: input.expiryMinutes,
    });

    if (templateConfigs.length > 0) {
      await sendMessageWithTemplateFallback(
        client,
        accountId,
        conversationId,
        content,
        templateConfigs,
        bodyParams,
      );
    } else {
      await client.createMessage(accountId, conversationId, {
        content,
      });
    }

    return {
      success: true,
      whatsappSent: true,
      conversationId,
    };
  } catch (error) {
    return {
      success: false,
      whatsappSent: false,
      error: getSafeErrorMessage(error),
    };
  }
}
