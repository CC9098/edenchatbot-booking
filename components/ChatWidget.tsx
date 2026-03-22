'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, RotateCcw, X } from 'lucide-react';
import {
  getClinicAddressLines,
  getClinicHoursLines,
  getClinicRouteLinks,
  getDoctorBookingLinkOrNote,
  getWhatsappContactLines,
} from '@/shared/clinic-data';
import {
  getScheduleForDayFromPublicSchedule,
  type BookableDoctorSchedule,
} from '@/shared/bookable-schedule-data';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatOptions } from '@/components/chat/ChatOptions';
import { ChatInput } from '@/components/chat/ChatInput';
import { DAY_NAMES, PRIMARY, TEXT_INPUT_STEPS } from '@/components/chat/constants';
import { useChatState } from '@/components/chat/hooks/useChatState';
import { type BookingState, type BookingStep, type ConsultationFormData, type Option, type OptionKey } from '@/components/chat/types';
import { buildBookingUrl } from '@/lib/public-url';
import {
  buildConsultationFormFlow,
  buildWidgetGreetingMessage,
  buildWidgetMainMenuOptions,
  DEFAULT_WIDGET_CHATBOT_SETTINGS,
  type WidgetChatbotSettings,
} from '@/lib/widget-chatbot-settings';

function formatClinicLabel(clinicNameZh?: string) {
  return clinicNameZh === '網上' ? '網上應診' : `${clinicNameZh || '診所'}診所`;
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [widgetSessionId, setWidgetSessionId] = useState('');
  const [iosKeyboardOffset, setIosKeyboardOffset] = useState(0);
  const [widgetSettings, setWidgetSettings] = useState<WidgetChatbotSettings>(DEFAULT_WIDGET_CHATBOT_SETTINGS);
  const [options, setOptions] = useState<Option[]>(() => buildWidgetMainMenuOptions(DEFAULT_WIDGET_CHATBOT_SETTINGS));
  const [aiMode, setAiMode] = useState(false);
  const [formMode, setFormMode] = useState(false);
  const [formStep, setFormStep] = useState(0);
  const [input, setInput] = useState('');
  const [formError, setFormError] = useState('');
  const [consultationFormData, setConsultationFormData] = useState<ConsultationFormData>({
    reason: '',
    name: '',
    email: '',
    phone: '',
  });
  const [bookingMode, setBookingMode] = useState(false);
  const [booking, setBooking] = useState<BookingState>({ step: 'entry' });
  const [, setIsLoading] = useState(false);
  const [bookableDoctors, setBookableDoctors] = useState<BookableDoctorSchedule[]>([]);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const {
    messages,
    addMessage,
    addBotMessage,
    replaceBotLoadingMessage,
    removeMessageByExactText,
    clearMessages,
  } = useChatState();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storageKey = 'eden_widget_session_id';
    const existing = localStorage.getItem(storageKey);
    if (existing) {
      setWidgetSessionId(existing);
      return;
    }

    const id = `widget_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(storageKey, id);
    setWidgetSessionId(id);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadBookableDoctors = async () => {
      try {
        const response = await fetch('/api/public/bookable-schedules');
        if (!response.ok) return;

        const data = await response.json();
        if (isCancelled || !Array.isArray(data?.doctors)) return;
        setBookableDoctors(data.doctors);
      } catch (error) {
        console.error('[ChatWidget] Failed to load bookable schedules:', error);
      }
    };

    void loadBookableDoctors();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadWidgetSettings = async () => {
      try {
        const response = await fetch('/api/public/widget-chatbot-settings', {
          cache: 'no-store',
        });
        if (!response.ok) return;

        const data = await response.json();
        if (isCancelled || !data?.settings) return;
        setWidgetSettings(data.settings);
      } catch (error) {
        console.error('[ChatWidget] Failed to load widget chatbot settings:', error);
      }
    };

    void loadWidgetSettings();

    return () => {
      isCancelled = true;
    };
  }, []);

  // 通知父窗口 chatbot 打开/关闭状态，让父窗口调整 iframe 大小
  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'chatbot-state', open }, '*');
    }
  }, [open]);

  useEffect(() => {
    if (open && messages.length === 0) {
      addBotMessage(buildWidgetGreetingMessage(widgetSettings, getWhatsappContactLines()));
    }
  }, [open, messages.length, addBotMessage, widgetSettings]);

  useEffect(() => {
    // 使用 setTimeout 确保 DOM 更新完成后再滚动
    const timer = setTimeout(() => {
      if (viewportRef.current) {
        viewportRef.current.scrollTo({
          top: viewportRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    if (!open) {
      setIosKeyboardOffset(0);
      return;
    }

    if (typeof window === 'undefined' || !window.visualViewport) return;
    const viewport = window.visualViewport;

    const updateViewportOffset = () => {
      const keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setIosKeyboardOffset(keyboardOffset);
    };

    updateViewportOffset();
    viewport.addEventListener('resize', updateViewportOffset);
    viewport.addEventListener('scroll', updateViewportOffset);
    window.addEventListener('orientationchange', updateViewportOffset);

    return () => {
      viewport.removeEventListener('resize', updateViewportOffset);
      viewport.removeEventListener('scroll', updateViewportOffset);
      window.removeEventListener('orientationchange', updateViewportOffset);
    };
  }, [open]);

  const showInput = aiMode || formMode || (bookingMode && [
    'manageBookingId', 'managePhone',
    'lastName', 'firstName', 'phone', 'email',
    'idCard', 'dob', 'allergies', 'medications', 'symptoms'
  ].includes(booking.step));
  const consultationFlow = useMemo(
    () => buildConsultationFormFlow(widgetSettings),
    [widgetSettings]
  );
  const returnMainOption = useMemo<Option>(
    () => ({
      label: widgetSettings.flows.common.returnMainButtonLabel,
      value: 'main',
    }),
    [widgetSettings]
  );
  const bookingBackCancelOptions = useMemo<Option[]>(
    () => ([
      { label: widgetSettings.flows.common.bookingBackButtonLabel, value: 'booking_back' },
      { label: widgetSettings.flows.common.bookingCancelButtonLabel, value: 'booking_cancel' },
    ]),
    [widgetSettings]
  );
  const bookableDoctorNames = useMemo(
    () => bookableDoctors.map((doctor) => doctor.doctorNameZh),
    [bookableDoctors]
  );
  const bookableDoctorByName = useMemo(
    () => new Map(bookableDoctors.map((doctor) => [doctor.doctorNameZh, doctor])),
    [bookableDoctors]
  );

  const buildDoctorOptions = () => (
    bookableDoctorNames.map((name) => ({
      label: name,
      value: `doctor-${name}` as OptionKey,
    }))
  );

  useEffect(() => {
    if (messages.length === 0 && !aiMode && !formMode && !bookingMode) {
      setOptions(buildWidgetMainMenuOptions(widgetSettings));
    }
  }, [messages.length, aiMode, formMode, bookingMode, widgetSettings]);

  const linkify = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const renderLink = (href: string, label: string, key: string) => (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-[--primary]/70 decoration-2 underline-offset-2 hover:text-[--primary]"
        style={{ ['--primary' as string]: PRIMARY }}
      >
        {label}
      </a>
    );
    const renderAutoLinkedText = (segment: string, keyPrefix: string) =>
      segment.split(urlRegex).map((part, index) => {
        if (!part.match(urlRegex)) {
          return <span key={`${keyPrefix}-text-${index}`}>{part}</span>;
        }
        return renderLink(part, part, `${keyPrefix}-url-${index}`);
      });

    const nodes: JSX.Element[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    markdownLinkRegex.lastIndex = 0;

    while ((match = markdownLinkRegex.exec(text)) !== null) {
      const [fullMatch, label, href] = match;
      const leadingText = text.slice(lastIndex, match.index);

      if (leadingText) {
        nodes.push(...renderAutoLinkedText(leadingText, `lead-${lastIndex}`));
      }

      nodes.push(renderLink(href, label, `md-${match.index}`));
      lastIndex = match.index + fullMatch.length;
    }

    const trailingText = text.slice(lastIndex);
    if (trailingText) {
      nodes.push(...renderAutoLinkedText(trailingText, `tail-${lastIndex}`));
    }

    return nodes.length > 0 ? nodes : [<span key="plain">{text}</span>];
  };

  const resetToMain = () => {
    setOptions(buildWidgetMainMenuOptions(widgetSettings));
    setAiMode(false);
    setFormMode(false);
    setBookingMode(false);
    setBooking({ step: 'entry' });
    setIsLoading(false);
    setFormStep(0);
    setInput('');
    setFormError('');
    setConsultationFormData({ reason: '', name: '', email: '', phone: '' });
  };

  const showBookingEntryOptions = (message = '你想新預約，定更改／取消現有預約？') => {
    setBookingMode(true);
    setBooking({ step: 'entry' });
    addBotMessage(message);
    setOptions([
      { label: '新預約', value: 'booking_new' },
      { label: '更改預約', value: 'booking_manage_reschedule' },
      { label: '取消預約', value: 'booking_manage_cancel' },
      returnMainOption,
    ]);
  };

  const showNewBookingDoctorOptions = () => {
    if (bookableDoctorNames.length === 0) {
      const whatsappLines = getWhatsappContactLines().join('\n');
      addBotMessage(
        `目前未能同步最新醫師時間表，請稍後再試，或直接聯絡姑娘協助安排：\n${whatsappLines}`
      );
      setOptions([returnMainOption]);
      return;
    }

    setBookingMode(true);
    setBooking({ step: 'doctor', mode: 'new' });
    addBotMessage(widgetSettings.flows.booking.prompt);
    setOptions([...buildDoctorOptions(), returnMainOption]);
  };

  const buildDateOptionsForClinic = (
    doctorNameZh: string | undefined,
    clinicId: string | undefined,
    startOffsetDays: number,
  ) => {
    const doctor = doctorNameZh ? bookableDoctorByName.get(doctorNameZh) : undefined;
    const clinic = doctor?.clinics.find((entry) => entry.clinicId === clinicId);
    if (!clinic) {
      return null;
    }

    const today = new Date();
    const dateOptions: Option[] = [];

    for (let i = startOffsetDays; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayOfWeek = d.getDay();
      const daySchedule = getScheduleForDayFromPublicSchedule(clinic.schedule, dayOfWeek);

      if (!daySchedule || daySchedule.length === 0) {
        continue;
      }

      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dayName = DAY_NAMES[dayOfWeek];
      const dateStr = `${d.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dateOptions.push({
        label: `${month}/${day} (${dayName})`,
        value: `booking_date-${dateStr}` as OptionKey,
      });
    }

    return dateOptions;
  };

  const showManageBlockedMessage = (message: string, clinicWhatsappUrl?: string | null) => {
    const whatsappLine = clinicWhatsappUrl
      ? `姑娘 WhatsApp： [按此聯絡姑娘](${clinicWhatsappUrl})`
      : getWhatsappContactLines().join('\n');

    addBotMessage(`${message}\n\n${whatsappLine}`);
    setOptions([returnMainOption]);
  };

  const handleAIResponse = async (text: string) => {
    addBotMessage(widgetSettings.flows.other.aiLoadingText);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const data = await response.json();

      // 移除 loading 訊息並添加 AI 回應
      replaceBotLoadingMessage(widgetSettings.flows.other.aiLoadingText, data.response);
    } catch (error) {
      console.error('AI Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const whatsappLines = getWhatsappContactLines().join('\n');
      replaceBotLoadingMessage(
        widgetSettings.flows.other.aiLoadingText,
        `${widgetSettings.flows.other.aiErrorLead}\n\n錯誤訊息：${errorMessage}\n\n請直接聯絡我們姑娘：\n${whatsappLines}`,
      );
    }
  };

  const handleOptionSelect = (option: Option) => {
    setFormError('');
    addMessage('user', option.label);
    setAiMode(false);
    setFormMode(false);
    setInput('');

    switch (option.value) {
      case 'fees': {
        addBotMessage(widgetSettings.flows.fees.reply);
        setOptions([
          { label: widgetSettings.flows.fees.endButtonLabel, value: 'end' },
          { label: widgetSettings.flows.fees.mainButtonLabel, value: 'main' },
        ]);
        break;
      }
      case 'clinic': {
        addBotMessage(widgetSettings.flows.clinic.prompt);
        setOptions([
          { label: widgetSettings.flows.clinic.hoursButtonLabel, value: 'hours' },
          { label: widgetSettings.flows.clinic.addressesButtonLabel, value: 'addresses' },
          { label: widgetSettings.flows.clinic.backButtonLabel, value: 'main' },
        ]);
        break;
      }
      case 'hours': {
        const hoursText = getClinicHoursLines().join('\n');
        addBotMessage(
          `${hoursText}\n\n${widgetSettings.flows.clinic.hoursClosingText}`
        );
        setOptions([returnMainOption]);
        break;
      }
      case 'addresses': {
        const addressText = getClinicAddressLines().join('\n\n');
        addBotMessage(
          `${widgetSettings.flows.clinic.addressesPrompt}\n\n${addressText}`,
          getClinicRouteLinks()
        );
        setOptions([returnMainOption]);
        break;
      }
      case 'booking': {
        showBookingEntryOptions();
        break;
      }
      case 'booking_new': {
        showNewBookingDoctorOptions();
        break;
      }
      case 'booking_manage_reschedule': {
        setBookingMode(true);
        setBooking({ step: 'manageBookingId', mode: 'reschedule' });
        addBotMessage('請輸入預約編號：');
        setOptions([returnMainOption]);
        break;
      }
      case 'booking_manage_cancel': {
        setBookingMode(true);
        setBooking({ step: 'manageBookingId', mode: 'cancel' });
        addBotMessage('請輸入預約編號：');
        setOptions([returnMainOption]);
        break;
      }

      case 'timetable': {
        addBotMessage(widgetSettings.flows.timetable.reply);
        setOptions([returnMainOption]);
        break;
      }
      case 'other': {
        const whatsappLines = getWhatsappContactLines().join('\n');
        setAiMode(true);
        addBotMessage(
          `${widgetSettings.flows.other.prompt}\n${whatsappLines}`
        );
        setOptions([]);
        break;
      }
      case 'consult': {
        startForm();
        break;
      }
      case 'main': {
        addBotMessage(widgetSettings.flows.common.returnToMainText);
        resetToMain();
        break;
      }
      case 'end': {
        addBotMessage(widgetSettings.flows.common.endText);
        resetToMain();
        break;
      }
      default: {
        // Handle booking flow option selections
        if (bookingMode && option.value.startsWith('doctor-')) {
          handleBookingDoctorSelect(option.value.replace('doctor-', ''));
        } else if (bookingMode && option.value.startsWith('booking_clinic-')) {
          handleBookingClinicSelect(option.value.replace('booking_clinic-', ''));
        } else if (bookingMode && option.value.startsWith('booking_date-')) {
          handleBookingDateSelect(option.value.replace('booking_date-', ''));
        } else if (bookingMode && option.value.startsWith('booking_time-')) {
          handleBookingTimeSelect(option.value.replace('booking_time-', ''));
        } else if (option.value === 'booking_visit_first') {
          handleBookingVisitTypeSelect(true);
        } else if (option.value === 'booking_visit_followup') {
          handleBookingVisitTypeSelect(false);
        } else if (bookingMode && option.value.startsWith('booking_receipt-')) {
          handleBookingReceiptSelect(option.value.replace('booking_receipt-', ''));
        } else if (bookingMode && option.value.startsWith('booking_pickup-')) {
          handleBookingPickupSelect(option.value.replace('booking_pickup-', ''));
        } else if (bookingMode && option.value.startsWith('booking_gender-')) {
          handleBookingGenderSelect(option.value.replace('booking_gender-', ''));
        } else if (bookingMode && option.value.startsWith('booking_referral-')) {
          handleBookingReferralSelect(option.value.replace('booking_referral-', ''));
        } else if (option.value === 'booking_back') {
          handleBookingBack();
        } else if (option.value === 'booking_confirm') {
          handleBookingConfirm();
        } else if (option.value === 'booking_cancel') {
          addBotMessage('已取消預約，返回主選單。');
          resetToMain();
        } else if (option.value.startsWith('doctor-')) {
          // Non-booking doctor info (timetable mode)
          const name = option.value.replace('doctor-', '');
          const link = getDoctorBookingLinkOrNote(name) || buildBookingUrl();
          const schedule = bookableDoctorByName.get(name)?.summary;
          if (link.startsWith('http')) {
            let message = `無問題😊 呢個係${name}的應診時間：\n\n`;
            if (schedule) {
              message += schedule + '\n\n';
            }
            message += `⚠️ **重要提示**：以上時間僅供參考，具體開放時間及休假安排（包括特殊假期）會經常更新，請以網上預約平台為準。\n\n`;
            message += `請用以下網址立即預約，方便快捷：${link}\n`;
            message += `🔗 查看最新時間表：https://www.edenclinic.hk/timetable/`;
            addBotMessage(message);
          } else {
            addBotMessage(link);
          }
          setOptions([returnMainOption]);
        }
      }
    }
  };

  // ==================== BOOKING FLOW HANDLERS ====================

  const handleBookingDoctorSelect = (doctorNameZh: string) => {
    const doctor = bookableDoctorByName.get(doctorNameZh);
    if (!doctor) {
      addBotMessage('抱歉，此醫師暫不支援線上預約。');
      setOptions([returnMainOption]);
      return;
    }

    setBooking(prev => ({
      ...prev,
      step: 'clinic',
      doctorId: doctor.doctorId,
      doctorNameZh: doctor.doctorNameZh,
      doctorName: doctor.doctorNameEn,
    }));

    if (doctor.clinics.length === 0) {
      addBotMessage(`抱歉，${doctorNameZh}目前暫無可預約的診所。`);
      setOptions([returnMainOption]);
      return;
    }

    addBotMessage(`好的！你要預約${doctorNameZh}，請選擇診所：`);
    const clinicOpts: Option[] = doctor.clinics.map((clinic) => ({
      label: clinic.clinicNameZh,
      value: `booking_clinic-${clinic.clinicId}` as OptionKey,
    }));
    setOptions([...clinicOpts, ...bookingBackCancelOptions]);
  };

  const handleBookingClinicSelect = (clinicId: string) => {
    const doctor = booking.doctorNameZh ? bookableDoctorByName.get(booking.doctorNameZh) : undefined;
    const clinic = doctor?.clinics.find((entry) => entry.clinicId === clinicId);
    if (!clinic) return;

    setBooking(prev => ({
      ...prev,
      step: 'visitType',
      clinicId: clinic.clinicId,
      clinicNameZh: clinic.clinicNameZh,
      clinicName: clinic.clinicNameEn,
    }));

    addBotMessage(`好的！${formatClinicLabel(clinic.clinicNameZh)}。請問你係首診定覆診呢？`);
    setOptions([
      { label: '首診（第一次來）', value: 'booking_visit_first' },
      { label: '覆診（有來過）', value: 'booking_visit_followup' },
      ...bookingBackCancelOptions,
    ]);
  };

  const handleBookingVisitTypeSelect = (isFirstVisit: boolean) => {
    setBooking(prev => ({ ...prev, step: 'date', isFirstVisit }));
    const dateOptions = buildDateOptionsForClinic(booking.doctorNameZh, booking.clinicId, 1);
    if (!dateOptions) {
      addBotMessage('抱歉，找不到此醫師在該診所的排班。');
      setOptions([returnMainOption]);
      return;
    }

    if (dateOptions.length === 0) {
      addBotMessage(`抱歉，${booking.doctorNameZh}在${formatClinicLabel(booking.clinicNameZh)}未來兩星期內暫無可預約日子。`);
      setOptions([returnMainOption]);
      return;
    }

    addBotMessage(`${isFirstVisit ? '首診' : '覆診'}，請選擇日期：`);
    setOptions([...dateOptions, ...bookingBackCancelOptions]);
  };

  const restartManageLookup = (message: string, mode: 'reschedule' | 'cancel') => {
    addBotMessage(`${message}\n\n請重新輸入預約編號：`);
    setBooking({ step: 'manageBookingId', mode });
    setOptions([returnMainOption]);
  };

  const handleManageLookup = async (bookingIdValue: string, phoneValue: string, mode: 'reschedule' | 'cancel') => {
    setOptions([]);
    setIsLoading(true);
    addBotMessage('正在查詢預約... ⏳');

    try {
      const response = await fetch('/api/widget-booking/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingIdValue,
          phone: phoneValue,
        }),
      });

      const data = await response.json();
      setIsLoading(false);
      removeMessageByExactText('正在查詢預約... ⏳');

      if (!response.ok || !data?.success) {
        restartManageLookup(data?.error || '找不到預約。', mode);
        return;
      }

      const nextBooking: BookingState = {
        step: mode === 'cancel' ? 'manageConfirmCancel' : 'manageConfirmReschedule',
        mode,
        bookingId: data.booking.bookingId,
        manageToken: data.manageToken,
        manageMessage: data.message,
        doctorId: data.booking.doctorId,
        doctorNameZh: data.booking.doctorNameZh,
        clinicId: data.booking.clinicId,
        clinicNameZh: data.booking.clinicNameZh,
        date: data.booking.appointmentDate,
        time: data.booking.appointmentTime,
        phone: phoneValue,
        clinicWhatsappUrl: data.booking.clinicWhatsappUrl,
      };

      if (!data.canSelfManage || !data.manageToken) {
        setBooking(nextBooking);
        showManageBlockedMessage(
          [
            '已找到你的預約：',
            '',
            `預約編號：${data.booking.bookingId}`,
            `醫師：${data.booking.doctorNameZh}`,
            `診所：${data.booking.clinicNameZh}`,
            `日期：${data.booking.appointmentDate}`,
            `時間：${data.booking.appointmentTime}`,
            '',
            data.message,
          ].join('\n'),
          data.booking.clinicWhatsappUrl,
        );
        return;
      }

      if (mode === 'cancel') {
        setBooking(nextBooking);
        addBotMessage(`${[
          '已找到你的預約：',
          '',
          `預約編號：${data.booking.bookingId}`,
          `醫師：${data.booking.doctorNameZh}`,
          `診所：${data.booking.clinicNameZh}`,
          `日期：${data.booking.appointmentDate}`,
          `時間：${data.booking.appointmentTime}`,
          '',
          '確認要取消這個預約嗎？',
        ].join('\n')}`);
        setOptions([
          { label: '確認取消預約', value: 'booking_confirm' },
          { label: widgetSettings.flows.common.bookingBackButtonLabel, value: 'booking_back' },
          returnMainOption,
        ]);
        return;
      }

      const dateOptions = buildDateOptionsForClinic(
        data.booking.doctorNameZh,
        data.booking.clinicId,
        0,
      );

      setBooking({ ...nextBooking, step: 'date' });

      if (!dateOptions || dateOptions.length === 0) {
        showManageBlockedMessage(
          '暫時未能提供可改期日期，請直接 WhatsApp 聯絡姑娘。',
          data.booking.clinicWhatsappUrl,
        );
        return;
      }

      addBotMessage(`${[
        '已找到你的預約：',
        '',
        `預約編號：${data.booking.bookingId}`,
        `目前時間：${data.booking.appointmentDate} ${data.booking.appointmentTime}`,
        '',
        '請選擇新的日期：',
      ].join('\n')}`);
      setOptions([...dateOptions, { label: widgetSettings.flows.common.bookingBackButtonLabel, value: 'booking_back' }, returnMainOption]);
    } catch (error) {
      setIsLoading(false);
      removeMessageByExactText('正在查詢預約... ⏳');
      restartManageLookup(
        error instanceof Error ? error.message : '查詢預約時發生錯誤。',
        mode,
      );
    }
  };

  const handleBookingDateSelect = async (dateStr: string) => {
    setBooking(prev => ({ ...prev, step: 'time', date: dateStr }));
    setOptions([]);
    setIsLoading(true);
    addBotMessage('正在查詢可預約時段... ⏳');

    try {
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: booking.doctorId,
          clinicId: booking.clinicId,
          date: dateStr,
          durationMinutes: 15,
        }),
      });

      const data = await response.json();
      setIsLoading(false);

      // Remove loading message
      removeMessageByExactText('正在查詢可預約時段... ⏳');

      if (data.isClosed) {
        addBotMessage(data.isHoliday ? '呢日係假期，醫師休息。請揀另一日。' : '呢日醫師唔應診。請揀另一日。');
        if (booking.mode === 'reschedule') {
          const dateOptions = buildDateOptionsForClinic(booking.doctorNameZh, booking.clinicId, 0);
          setOptions([...(dateOptions || []), { label: widgetSettings.flows.common.bookingBackButtonLabel, value: 'booking_back' }, returnMainOption]);
        } else {
          handleBookingVisitTypeSelect(booking.isFirstVisit!);
        }
        return;
      }

      if (!data.slots || data.slots.length === 0) {
        addBotMessage('呢日已經滿晒 😅 請揀另一日。');
        if (booking.mode === 'reschedule') {
          const dateOptions = buildDateOptionsForClinic(booking.doctorNameZh, booking.clinicId, 0);
          setOptions([...(dateOptions || []), { label: widgetSettings.flows.common.bookingBackButtonLabel, value: 'booking_back' }, returnMainOption]);
        } else {
          handleBookingVisitTypeSelect(booking.isFirstVisit!);
        }
        return;
      }

      // Show time slots
      const d = new Date(dateStr);
      const dayName = DAY_NAMES[d.getDay()];
      addBotMessage(`${d.getMonth() + 1}/${d.getDate()} (${dayName}) 有以下時段，請選擇：`);
      const timeOpts: Option[] = data.slots.map((slot: string) => ({
        label: slot,
        value: `booking_time-${slot}` as OptionKey,
      }));
      if (booking.mode === 'reschedule') {
        setOptions([
          ...timeOpts,
          { label: widgetSettings.flows.common.bookingBackButtonLabel, value: 'booking_back' },
          returnMainOption,
        ]);
      } else {
        setOptions([...timeOpts, ...bookingBackCancelOptions]);
      }
    } catch (error) {
      setIsLoading(false);
      removeMessageByExactText('正在查詢可預約時段... ⏳');
      addBotMessage('抱歉，查詢時段時發生錯誤，請稍後再試。');
      setOptions([returnMainOption]);
    }
  };

  const handleBookingTimeSelect = (time: string) => {
    if (booking.mode === 'reschedule') {
      setBooking(prev => ({ ...prev, step: 'manageConfirmReschedule', time }));
      addBotMessage(`${[
        '請確認以下更改：',
        '',
        `預約編號：${booking.bookingId || '--'}`,
        `醫師：${booking.doctorNameZh || '--'}`,
        `診所：${booking.clinicNameZh || '--'}`,
        `新日期：${booking.date || '--'}`,
        `新時間：${time}`,
        '',
        '確認更改預約嗎？',
      ].join('\n')}`);
      setOptions([
        { label: '確認更改預約', value: 'booking_confirm' },
        { label: widgetSettings.flows.common.bookingBackButtonLabel, value: 'booking_back' },
        returnMainOption,
      ]);
      return;
    }

    setBooking(prev => ({ ...prev, step: 'lastName', time }));
    addBotMessage(`好的，你選擇了 ${time}。\n\n請輸入你的姓氏（Last Name）：`);
    setOptions(bookingBackCancelOptions);
  };



  const handleBookingConfirm = async () => {
    setOptions([]);
    setIsLoading(true);
    addBotMessage('正在處理預約... ⏳');

    if (booking.mode === 'cancel') {
      try {
        const response = await fetch('/api/widget-booking/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manageToken: booking.manageToken,
          }),
        });

        const data = await response.json();
        setIsLoading(false);
        removeMessageByExactText('正在處理預約... ⏳');

        if (response.ok && data.success) {
          addBotMessage(`✅ ${data.message}`);
        } else {
          showManageBlockedMessage(
            data.error || '取消預約失敗，請稍後再試。',
            data.clinicWhatsappUrl || booking.clinicWhatsappUrl,
          );
        }
      } catch (error) {
        setIsLoading(false);
        removeMessageByExactText('正在處理預約... ⏳');
        showManageBlockedMessage(
          error instanceof Error ? error.message : '取消預約時發生錯誤。',
          booking.clinicWhatsappUrl,
        );
      }

      resetToMain();
      return;
    }

    if (booking.mode === 'reschedule') {
      try {
        const response = await fetch('/api/widget-booking/reschedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manageToken: booking.manageToken,
            date: booking.date,
            time: booking.time,
          }),
        });

        const data = await response.json();
        setIsLoading(false);
        removeMessageByExactText('正在處理預約... ⏳');

        if (response.ok && data.success) {
          addBotMessage(
            `✅ ${data.message}\n\n` +
            `預約編號：${data.booking.bookingId}\n` +
            `醫師：${data.booking.doctorNameZh}\n` +
            `診所：${data.booking.clinicNameZh}\n` +
            `新時間：${data.booking.appointmentDate} ${data.booking.appointmentTime}`
          );
        } else {
          showManageBlockedMessage(
            data.error || '更改預約失敗，請稍後再試。',
            data.clinicWhatsappUrl || booking.clinicWhatsappUrl,
          );
        }
      } catch (error) {
        setIsLoading(false);
        removeMessageByExactText('正在處理預約... ⏳');
        showManageBlockedMessage(
          error instanceof Error ? error.message : '更改預約時發生錯誤。',
          booking.clinicWhatsappUrl,
        );
      }

      resetToMain();
      return;
    }

    const pickupLabel = PICKUP_LABELS[booking.medicationPickup || ''] || booking.medicationPickup || '';
    const notes = booking.isFirstVisit
      ? `[首診] ID: ${booking.idCard || 'N/A'} | DOB: ${booking.dob || 'N/A'} | Gender: ${booking.gender || 'N/A'} | Allergies: ${booking.allergies || 'None'} | Medications: ${booking.medications || 'None'} | Symptoms: ${booking.symptoms || 'N/A'} | Referral: ${booking.referralSource || 'N/A'} | Receipt: ${booking.needReceipt} | 取藥方法: ${pickupLabel}`
      : `[覆診] Receipt: ${booking.needReceipt} | 取藥方法: ${pickupLabel}`;

    try {
      const response = await fetch('/api/booking-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: booking.doctorId,
          doctorName: booking.doctorName,
          doctorNameZh: booking.doctorNameZh,
          clinicId: booking.clinicId,
          clinicName: booking.clinicName,
          clinicNameZh: booking.clinicNameZh,
          date: booking.date,
          time: booking.time,
          durationMinutes: 15,
          patientName: `${booking.lastName} ${booking.firstName}`,
          phone: booking.phone,
          email: booking.email || '',
          visitType: booking.isFirstVisit ? 'first' : 'followup',
          needReceipt: booking.needReceipt || 'no',
          medicationPickup: booking.medicationPickup || 'none',
          idCard: booking.idCard,
          dateOfBirth: booking.dob,
          gender: booking.gender,
          allergies: booking.allergies,
          medications: booking.medications,
          symptoms: booking.symptoms,
          referralSource: booking.referralSource,
          notes,
        }),
      });

      const data = await response.json();
      setIsLoading(false);

      // Remove loading message
      removeMessageByExactText('正在處理預約... ⏳');

      if (data.success) {
        const d = new Date(booking.date!);
        const dayName = DAY_NAMES[d.getDay()];
        const whatsappStatusText = data.whatsappSent
          ? '姑娘會透過 WhatsApp 發送確認訊息到你提供的電話。'
          : '預約已建立，WhatsApp 確認訊息暫時未能自動發送，姑娘會再跟進。';
        addBotMessage(
          `✅ 預約成功！\n\n` +
          `📋 預約資料：\n` +
          `👨‍⚕️ 醫師：${booking.doctorNameZh}\n` +
          `🏥 診所：${booking.clinicNameZh}\n` +
          `📋 ${booking.isFirstVisit ? '首診' : '覆診'}\n` +
          `📅 日期：${d.getMonth() + 1}/${d.getDate()} (${dayName})\n` +
          `🕐 時間：${booking.time}\n` +
          `👤 姓名：${booking.lastName} ${booking.firstName}\n` +
          `📞 電話：${booking.phone}\n` +
          (booking.email ? `📧 電郵：${booking.email}\n` : '') +
          `\n預約編號：${data.bookingId}\n` +
          `\n📍 ${whatsappStatusText}\n如需更改或取消預約，可在本 widget 內使用管理預約。\n祝你身體健康！🌿`
        );
      } else {
        addBotMessage(`抱歉，預約未能完成：${data.error || '未知錯誤'}\n\n請稍後再試或直接聯絡我們。`);
      }
    } catch (error) {
      setIsLoading(false);
      removeMessageByExactText('正在處理預約... ⏳');
      addBotMessage('抱歉，預約時發生錯誤，請稍後再試或直接聯絡診所。');
    }

    resetToMain();
  };

  const RECEIPT_LABELS: Record<string, string> = {
    'no': '不用',
    'yes_insurance': '是，保險索償',
    'yes_not_insurance': '是，但非保險',
  };

  const PICKUP_LABELS: Record<string, string> = {
    'none': '不需要',
    'lalamove': 'Lalamove',
    'sfexpress': '順豐 SF Express',
    'clinic_pickup': '診所自取',
  };

  const GENDER_LABELS: Record<string, string> = {
    'male': '男 Male',
    'female': '女 Female',
    'other': '其他 Other',
  };

  const REFERRAL_LABELS: Record<string, string> = {
    'google': 'Google 搜尋',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'youtube': 'YouTube',
    'friend': '朋友介紹',
    'doctor': '醫師介紹',
    'walk_in': '路過',
    'other': '其他',
  };

  const showBookingSummary = () => {
    const d = new Date(booking.date!);
    const dayName = DAY_NAMES[d.getDay()];
    let summary =
      `請確認以下預約資料：\n\n` +
      `👨‍⚕️ 醫師：${booking.doctorNameZh}\n` +
      `🏥 診所：${booking.clinicNameZh}\n` +
      `📋 診症類型：${booking.isFirstVisit ? '首診' : '覆診'}\n` +
      `📅 日期：${d.getMonth() + 1}/${d.getDate()} (${dayName})\n` +
      `🕐 時間：${booking.time}\n` +
      `👤 姓名：${booking.lastName} ${booking.firstName}\n` +
      `📞 電話：${booking.phone}\n` +
      `📧 電郵：${booking.email}\n` +
      `🧾 收據：${RECEIPT_LABELS[booking.needReceipt || ''] || booking.needReceipt}\n` +
      `💊 取藥方法：${PICKUP_LABELS[booking.medicationPickup || ''] || booking.medicationPickup}\n`;

    if (booking.isFirstVisit) {
      summary +=
        `\n--- 首診資料 ---\n` +
        `🪪 身份證：${booking.idCard}\n` +
        `🎂 出生日期：${booking.dob}\n` +
        `⚧ 性別：${GENDER_LABELS[booking.gender || ''] || booking.gender}\n` +
        `⚠️ 過敏史：${booking.allergies}\n` +
        `💊 正服用藥物：${booking.medications}\n` +
        `🩺 主要症狀：${booking.symptoms}\n` +
        `📢 得知來源：${REFERRAL_LABELS[booking.referralSource || ''] || booking.referralSource}\n`;
    }

    summary += `\n確認預約嗎？`;
    addBotMessage(summary);
    setOptions([
      { label: '✅ 確認預約', value: 'booking_confirm' },
      { label: '⬅️ 修改資料', value: 'booking_back' },
      { label: '❌ 取消', value: 'booking_cancel' },
    ]);
  };

  const startForm = () => {
    setFormMode(true);
    setAiMode(false);
    setOptions([]);
    setFormStep(0);
    setInput('');
    addBotMessage(consultationFlow[0].prompt);
  };

  const validateInput = () => {
    const step = consultationFlow[formStep];
    if (step.key === 'email') {
      const emailOk = /^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/i.test(input.trim());
      if (!emailOk) return '請輸入有效的電郵地址';
    }
    if (step.key === 'phone') {
      const phoneOk = /^[0-9+\-\s]{6,}$/.test(input.trim());
      if (!phoneOk) return '電話格式唔正確，請再確認';
    }
    return '';
  };

  const submitConsultationForm = async (payload: ConsultationFormData) => {
    setIsLoading(true);
    setOptions([]);
    addBotMessage(widgetSettings.flows.consultation.submittingText);

    try {
      const response = await fetch('/api/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      removeMessageByExactText(widgetSettings.flows.consultation.submittingText);
      setIsLoading(false);

      if (!response.ok || !data.success) {
        throw new Error(data.error || '提交失敗');
      }

      addBotMessage(widgetSettings.flows.consultation.successText);
      resetToMain();
    } catch (error) {
      removeMessageByExactText(widgetSettings.flows.consultation.submittingText);
      setIsLoading(false);
      addBotMessage(widgetSettings.flows.consultation.errorText);
      setOptions([returnMainOption]);
      setFormMode(false);
    }
  };

  const handleFormSubmit = async () => {
    if (!input.trim()) return;
    const error = validateInput();
    if (error) {
      setFormError(error);
      return;
    }

    const step = consultationFlow[formStep];
    const value = input.trim();
    const nextFormData = {
      ...consultationFormData,
      [step.key]: value,
    };
    setConsultationFormData(nextFormData);
    setFormError('');
    addMessage('user', value);
    const nextStep = formStep + 1;
    setInput('');
    if (nextStep < consultationFlow.length) {
      setFormStep(nextStep);
      addBotMessage(consultationFlow[nextStep].prompt);
    } else {
      setFormMode(false);
      await submitConsultationForm(nextFormData);
    }
  };

  // Handle booking text input steps
  const handleBookingInput = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setFormError('');

    if (booking.step === 'manageBookingId') {
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'managePhone', bookingId: trimmed }));
      setInput('');
      addBotMessage('請輸入預約時填寫的電話號碼：');
      setOptions([
        { label: widgetSettings.flows.common.bookingBackButtonLabel, value: 'booking_back' },
        returnMainOption,
      ]);
    } else if (booking.step === 'managePhone') {
      if (!/^[0-9+\-\s]{8,}$/.test(trimmed)) {
        setFormError('電話格式唔正確，請輸入至少8位數字');
        return;
      }
      const activeMode = booking.mode === 'cancel' ? 'cancel' : 'reschedule';
      addMessage('user', trimmed);
      setInput('');
      setBooking(prev => ({ ...prev, phone: trimmed }));
      void handleManageLookup(booking.bookingId || '', trimmed, activeMode);
    } else if (booking.step === 'lastName') {
      if (trimmed.length < 1) { setFormError('請輸入姓氏'); return; }
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'firstName', lastName: trimmed }));
      setInput('');
      addBotMessage('請輸入你的名字（First Name）：');
      setOptions(bookingBackCancelOptions);
    } else if (booking.step === 'firstName') {
      if (trimmed.length < 1) { setFormError('請輸入名字'); return; }
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'phone', firstName: trimmed }));
      setInput('');
      addBotMessage('請輸入你的電話號碼（8位數字）：');
      setOptions(bookingBackCancelOptions);
    } else if (booking.step === 'phone') {
      if (!/^[0-9+\-\s]{8,}$/.test(trimmed)) { setFormError('電話格式唔正確，請輸入至少8位數字'); return; }
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'email', phone: trimmed }));
      setInput('');
      addBotMessage('請輸入電郵地址：');
      setOptions(bookingBackCancelOptions);
    } else if (booking.step === 'email') {
      if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/i.test(trimmed)) { setFormError('請輸入有效的電郵地址'); return; }
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'receipt', email: trimmed }));
      setInput('');
      addBotMessage('請問你是否需要收據作保險索償呢？');
      setOptions([
        { label: '不用', value: 'booking_receipt-no' },
        { label: '是，保險索償', value: 'booking_receipt-yes_insurance' },
        { label: '是，但非保險', value: 'booking_receipt-yes_not_insurance' },
        ...bookingBackCancelOptions,
      ]);
    } else if (booking.step === 'idCard') {
      if (trimmed.length < 5) { setFormError('身份證號碼至少5個字'); return; }
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'dob', idCard: trimmed }));
      setInput('');
      addBotMessage('請輸入出生日期（例如：1990/01/15）：');
      setOptions(bookingBackCancelOptions);
    } else if (booking.step === 'dob') {
      if (!trimmed) { setFormError('請輸入出生日期'); return; }
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'gender', dob: trimmed }));
      setInput('');
      addBotMessage('請選擇性別：');
      setOptions([
        { label: '男 Male', value: 'booking_gender-male' },
        { label: '女 Female', value: 'booking_gender-female' },
        { label: '其他 Other', value: 'booking_gender-other' },
        ...bookingBackCancelOptions,
      ]);
    } else if (booking.step === 'allergies') {
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'medications', allergies: trimmed }));
      setInput('');
      addBotMessage('請列出你正服用的藥物或保健品（如沒有請填「沒有」）：');
      setOptions(bookingBackCancelOptions);
    } else if (booking.step === 'medications') {
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'symptoms', medications: trimmed }));
      setInput('');
      addBotMessage('請簡述你主要希望處理的病症/體質狀況：');
      setOptions(bookingBackCancelOptions);
    } else if (booking.step === 'symptoms') {
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'referralSource', symptoms: trimmed }));
      setInput('');
      addBotMessage('請問你透過哪個渠道得悉/了解我們？');
      setOptions([
        { label: 'Google 搜尋', value: 'booking_referral-google' },
        { label: 'Facebook', value: 'booking_referral-facebook' },
        { label: 'Instagram', value: 'booking_referral-instagram' },
        { label: 'YouTube', value: 'booking_referral-youtube' },
        { label: '朋友介紹', value: 'booking_referral-friend' },
        { label: '醫師介紹', value: 'booking_referral-doctor' },
        { label: '路過', value: 'booking_referral-walk_in' },
        { label: '其他', value: 'booking_referral-other' },
        ...bookingBackCancelOptions,
      ]);
    }
  };

  // Handle receipt selection
  const handleBookingReceiptSelect = (value: string) => {
    setBooking(prev => ({ ...prev, step: 'medicationPickup', needReceipt: value }));
    addBotMessage('請選擇取藥方法：');
    setOptions([
      { label: '不需要', value: 'booking_pickup-none' },
      { label: 'Lalamove', value: 'booking_pickup-lalamove' },
      { label: '順豐 SF Express', value: 'booking_pickup-sfexpress' },
      { label: '診所自取', value: 'booking_pickup-clinic_pickup' },
      ...bookingBackCancelOptions,
    ]);
  };

  // Handle medication pickup selection
  const handleBookingPickupSelect = (value: string) => {
    setBooking(prev => ({ ...prev, medicationPickup: value }));
    if (booking.isFirstVisit) {
      setBooking(prev => ({ ...prev, step: 'idCard' }));
      addBotMessage('因為你係首診，需要填寫以下資料。\n\n請輸入身份證號碼（例如：A123456(7)）：');
      setOptions(bookingBackCancelOptions);
    } else {
      setBooking(prev => ({ ...prev, step: 'confirm' }));
      showBookingSummary();
    }
  };

  // Handle gender selection
  const handleBookingGenderSelect = (value: string) => {
    setBooking(prev => ({ ...prev, step: 'allergies', gender: value }));
    addBotMessage('請填寫你的藥物及食物敏感史（如沒有請填「沒有」）：');
    setOptions(bookingBackCancelOptions);
  };

  // Handle referral source selection
  const handleBookingReferralSelect = (value: string) => {
    setBooking(prev => ({ ...prev, step: 'confirm', referralSource: value }));
    showBookingSummary();
  };

  // Handle back navigation
  const handleBookingBack = () => {
    const s = booking.step;
    setFormError('');
    setInput('');

    if (s === 'entry') {
      resetToMain();
    } else if (s === 'doctor') {
      showBookingEntryOptions('你想新預約，定更改／取消現有預約？');
    } else if (s === 'manageBookingId') {
      showBookingEntryOptions('你想新預約，定更改／取消現有預約？');
    } else if (s === 'managePhone') {
      setBooking(prev => ({ ...prev, step: 'manageBookingId' }));
      addBotMessage('請輸入預約編號：');
      setOptions([returnMainOption]);
    } else if (s === 'manageConfirmCancel') {
      setBooking(prev => ({ ...prev, step: 'manageBookingId' }));
      addBotMessage('請重新輸入預約編號：');
      setOptions([returnMainOption]);
    } else if (s === 'manageConfirmReschedule') {
      const dateOptions = buildDateOptionsForClinic(booking.doctorNameZh, booking.clinicId, 0);
      setBooking(prev => ({ ...prev, step: 'date' }));
      addBotMessage('請重新選擇新的日期：');
      setOptions([...(dateOptions || []), { label: widgetSettings.flows.common.bookingBackButtonLabel, value: 'booking_back' }, returnMainOption]);
    } else if (s === 'clinic') {
      // Back to doctor selection
      addBotMessage(widgetSettings.flows.booking.prompt);
      setBooking(prev => ({ ...prev, step: 'doctor' }));
      setOptions([...buildDoctorOptions(), returnMainOption]);
    } else if (s === 'visitType') {
      handleBookingDoctorSelect(booking.doctorNameZh!);
    } else if (s === 'date') {
      if (booking.mode === 'reschedule') {
        setBooking(prev => ({ ...prev, step: 'manageBookingId' }));
        addBotMessage('請重新輸入預約編號：');
        setOptions([returnMainOption]);
      } else {
        handleBookingClinicSelect(booking.clinicId!);
      }
    } else if (s === 'time') {
      if (booking.mode === 'reschedule') {
        const dateOptions = buildDateOptionsForClinic(booking.doctorNameZh, booking.clinicId, 0);
        setBooking(prev => ({ ...prev, step: 'date' }));
        addBotMessage('請重新選擇新的日期：');
        setOptions([...(dateOptions || []), { label: widgetSettings.flows.common.bookingBackButtonLabel, value: 'booking_back' }, returnMainOption]);
      } else {
        handleBookingVisitTypeSelect(booking.isFirstVisit!);
      }
    } else if (s === 'lastName') {
      handleBookingDateSelect(booking.date!);
    } else if (s === 'firstName') {
      setBooking(prev => ({ ...prev, step: 'lastName' }));
      addBotMessage('請輸入你的姓氏（Last Name）：');
      setOptions(bookingBackCancelOptions);
    } else if (s === 'phone') {
      setBooking(prev => ({ ...prev, step: 'firstName' }));
      addBotMessage('請輸入你的名字（First Name）：');
      setOptions(bookingBackCancelOptions);
    } else if (s === 'email') {
      setBooking(prev => ({ ...prev, step: 'phone' }));
      addBotMessage('請輸入你的電話號碼（8位數字）：');
      setOptions(bookingBackCancelOptions);
    } else if (s === 'receipt') {
      setBooking(prev => ({ ...prev, step: 'email' }));
      addBotMessage('請輸入電郵地址：');
      setOptions(bookingBackCancelOptions);
    } else if (s === 'medicationPickup') {
      setBooking(prev => ({ ...prev, step: 'receipt' }));
      addBotMessage('請問你是否需要收據作保險索償呢？');
      setOptions([
        { label: '不用', value: 'booking_receipt-no' },
        { label: '是，保險索償', value: 'booking_receipt-yes_insurance' },
        { label: '是，但非保險', value: 'booking_receipt-yes_not_insurance' },
        ...bookingBackCancelOptions,
      ]);
    } else if (s === 'idCard') {
      setBooking(prev => ({ ...prev, step: 'medicationPickup' }));
      addBotMessage('請選擇取藥方法：');
      setOptions([
        { label: '不需要', value: 'booking_pickup-none' },
        { label: 'Lalamove', value: 'booking_pickup-lalamove' },
        { label: '順豐 SF Express', value: 'booking_pickup-sfexpress' },
        { label: '診所自取', value: 'booking_pickup-clinic_pickup' },
        ...bookingBackCancelOptions,
      ]);
    } else if (s === 'dob') {
      setBooking(prev => ({ ...prev, step: 'idCard' }));
      addBotMessage('請輸入身份證號碼（例如：A123456(7)）：');
      setOptions(bookingBackCancelOptions);
    } else if (s === 'gender') {
      setBooking(prev => ({ ...prev, step: 'dob' }));
      addBotMessage('請輸入出生日期（例如：1990/01/15）：');
      setOptions(bookingBackCancelOptions);
    } else if (s === 'allergies') {
      setBooking(prev => ({ ...prev, step: 'gender' }));
      addBotMessage('請選擇性別：');
      setOptions([
        { label: '男 Male', value: 'booking_gender-male' },
        { label: '女 Female', value: 'booking_gender-female' },
        { label: '其他 Other', value: 'booking_gender-other' },
        ...bookingBackCancelOptions,
      ]);
    } else if (s === 'medications') {
      setBooking(prev => ({ ...prev, step: 'allergies' }));
      addBotMessage('請填寫你的藥物及食物敏感史（如沒有請填「沒有」）：');
      setOptions(bookingBackCancelOptions);
    } else if (s === 'symptoms') {
      setBooking(prev => ({ ...prev, step: 'medications' }));
      addBotMessage('請列出你正服用的藥物或保健品（如沒有請填「沒有」）：');
      setOptions(bookingBackCancelOptions);
    } else if (s === 'referralSource') {
      setBooking(prev => ({ ...prev, step: 'symptoms' }));
      addBotMessage('請簡述你主要希望處理的病症/體質狀況：');
      setOptions(bookingBackCancelOptions);
    } else if (s === 'confirm') {
      if (booking.isFirstVisit) {
        setBooking(prev => ({ ...prev, step: 'referralSource' }));
        addBotMessage('請問你透過哪個渠道得悉/了解我們？');
        setOptions([
          { label: 'Google 搜尋', value: 'booking_referral-google' },
          { label: 'Facebook', value: 'booking_referral-facebook' },
          { label: 'Instagram', value: 'booking_referral-instagram' },
          { label: 'YouTube', value: 'booking_referral-youtube' },
          { label: '朋友介紹', value: 'booking_referral-friend' },
          { label: '醫師介紹', value: 'booking_referral-doctor' },
          { label: '路過', value: 'booking_referral-walk_in' },
          { label: '其他', value: 'booking_referral-other' },
          ...bookingBackCancelOptions,
        ]);
      } else {
        setBooking(prev => ({ ...prev, step: 'medicationPickup' }));
        addBotMessage('請選擇取藥方法：');
        setOptions([
          { label: '不需要', value: 'booking_pickup-none' },
          { label: 'Lalamove', value: 'booking_pickup-lalamove' },
          { label: '順豐 SF Express', value: 'booking_pickup-sfexpress' },
          { label: '診所自取', value: 'booking_pickup-clinic_pickup' },
          ...bookingBackCancelOptions,
        ]);
      }
    }
  };

  const handleAIInput = () => {
    if (!input.trim()) return;
    addMessage('user', input.trim());
    handleAIResponse(input.trim());
    setInput('');
  };

  const handleSend = () => {
    if (bookingMode && TEXT_INPUT_STEPS.includes(booking.step)) {
      handleBookingInput();
    } else if (formMode) {
      void handleFormSubmit();
    } else if (aiMode) {
      handleAIInput();
    }
  };

  const placeholder = useMemo(() => {
    const placeholders: Partial<Record<BookingStep, string>> = {
      manageBookingId: '輸入預約編號',
      managePhone: '輸入預約電話',
      lastName: '輸入姓氏（例如：陳）',
      firstName: '輸入名字（例如：大文）',
      phone: '輸入電話號碼',
      email: '輸入電郵',
      idCard: '例如：A123456(7)',
      dob: '例如：1990/01/15',
      allergies: '如沒有請填「沒有」',
      medications: '如沒有請填「沒有」',
      symptoms: '請簡述你的症狀',
    };
    if (bookingMode) return placeholders[booking.step] || '';
    if (formMode) return consultationFlow[formStep]?.placeholder ?? '請輸入';
    if (aiMode) return '輸入你的問題...（Enter 或 Send）';
    return '';
  }, [aiMode, formMode, formStep, bookingMode, booking.step, consultationFlow]);

  return (
    <div
      className="fixed right-0 z-50 flex flex-col items-end gap-4 p-4"
      style={{
        bottom: open
          ? `calc(env(safe-area-inset-bottom, 0px) + ${iosKeyboardOffset}px)`
          : 'calc(env(safe-area-inset-bottom, 0px) + 120px)',
        pointerEvents: open ? 'auto' : 'none', // iOS/Safari 對子元素 pointer-events:auto 支援不一致，開啟時直接允許事件命中容器
        touchAction: 'manipulation',
        transition: 'bottom 0.3s ease',
      }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="relative w-[calc(100vw-2.5rem)] sm:w-[380px]"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="flex h-[calc(100dvh-8rem)] max-h-[640px] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:h-[560px]">
              <div className="relative overflow-hidden">
                <div
                  className="flex items-center justify-between gap-3 px-5 py-3"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <div className="flex items-center gap-3 text-white">
                    <div className="flex flex-col leading-tight">
                      <span className="text-lg font-semibold">{widgetSettings.header.title}</span>
                      <span className="text-xs font-semibold text-white/90">{widgetSettings.header.subtitle}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-white">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        clearMessages();
                        resetToMain();
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.opacity = '';
                        clearMessages();
                        resetToMain();
                      }}
                      onTouchStart={(e) => {
                        e.currentTarget.style.opacity = '0.7';
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                      }}
                      onTouchCancel={(e) => {
                        e.currentTarget.style.opacity = '';
                        e.currentTarget.style.backgroundColor = '';
                      }}
                      className="flex items-center gap-1 rounded-full px-2 py-1.5 text-xs transition hover:bg-white/20 active:bg-white/30"
                      style={{
                        touchAction: 'manipulation',
                        minHeight: '44px',
                        minWidth: '44px',
                        WebkitTapHighlightColor: 'transparent',
                        WebkitUserSelect: 'none',
                        userSelect: 'none'
                      }}
                      aria-label={widgetSettings.header.restartButtonLabel}
                      type="button"
                    >
                      <RotateCcw size={14} />
                      <span>{widgetSettings.header.restartButtonLabel}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpen(false);
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.opacity = '';
                        setOpen(false);
                      }}
                      onTouchStart={(e) => {
                        e.currentTarget.style.opacity = '0.7';
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                      }}
                      onTouchCancel={(e) => {
                        e.currentTarget.style.opacity = '';
                        e.currentTarget.style.backgroundColor = '';
                      }}
                      className="rounded-full p-2 transition hover:bg-white/20 active:bg-white/30"
                      style={{
                        touchAction: 'manipulation',
                        minHeight: '44px',
                        minWidth: '44px',
                        WebkitTapHighlightColor: 'transparent',
                        WebkitUserSelect: 'none',
                        userSelect: 'none'
                      }}
                      aria-label="收起"
                      type="button"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-gray-50 to-white">
                <div
                  ref={viewportRef}
                  className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 scrollbar-thin scrollbar-thumb-gray-200/70 scrollbar-track-transparent"
                >
                  <ChatMessages
                    messages={messages}
                    linkify={linkify}
                    primaryColor={PRIMARY}
                    sessionId={widgetSessionId}
                  />
                </div>

                {options.length > 0 && (
                  <ChatOptions options={options} onSelect={handleOptionSelect} primaryColor={PRIMARY} />
                )}
              </div>

              {showInput && (
                <ChatInput
                  value={input}
                  onChange={setInput}
                  placeholder={placeholder}
                  onSend={handleSend}
                  primaryColor={PRIMARY}
                  aiMode={aiMode}
                  formError={formError}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onTouchStart={(e) => {
          e.currentTarget.style.transform = 'scale(0.95)';
          e.currentTarget.style.opacity = '0.9';
        }}
        onTouchCancel={(e) => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.opacity = '';
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.95)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = '';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.opacity = '';
        }}
        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl px-5 py-3.5 text-sm font-medium text-white shadow-xl transition-all duration-300 cursor-pointer active:scale-95 hover:scale-105"
        style={{
          background: `linear-gradient(135deg, ${PRIMARY} 0%, #1a3009 100%)`,
          boxShadow: `0 8px 32px ${PRIMARY}40, 0 4px 12px ${PRIMARY}30`,
          touchAction: 'manipulation',
          minHeight: '56px',
          minWidth: '160px',
          WebkitTapHighlightColor: 'transparent',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          pointerEvents: 'auto'  // 让按钮可以接收点击
        }}
        type="button"
      >
        {/* 背景光暈效果 */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at 30% 50%, rgba(255,255,255,0.15) 0%, transparent 50%)`
          }}
        />

        {/* 圖標 */}
        <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm pointer-events-none">
          {open ? <X size={22} /> : <MessageCircle size={22} />}
        </div>

        {/* 文字 */}
        <div className="relative text-left pointer-events-none">
          <div className="text-[11px] text-white/70 tracking-wide">醫天圓中醫</div>
          <div className="text-[15px] font-semibold tracking-tight">
            {open ? widgetSettings.header.launcherOpenLabel : widgetSettings.header.launcherClosedLabel}
          </div>
        </div>

        {/* 脈動光點 */}
        {!open && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 pointer-events-none">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ backgroundColor: '#7cb342' }}
            />
            <span
              className="relative inline-flex h-4 w-4 rounded-full"
              style={{ backgroundColor: '#8bc34a' }}
            />
          </span>
        )}
      </button>
    </div>
  );
}

export default ChatWidget;
