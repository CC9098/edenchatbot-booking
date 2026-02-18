'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, RotateCcw, X } from 'lucide-react';
import { CALENDAR_MAPPINGS, getScheduleForDay } from '@/shared/schedule-config';
import {
  CLINIC_BY_ID,
  DOCTOR_BY_NAME_ZH,
  getClinicAddressLines,
  getClinicHoursLines,
  getClinicRouteLinks,
  getDoctorBookingLinkOrNote,
  getWhatsappContactLines,
  isClinicId,
} from '@/shared/clinic-data';
import { getBookableDoctorNameZhList, getDoctorScheduleSummaryByNameZh } from '@/shared/clinic-schedule-data';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatOptions } from '@/components/chat/ChatOptions';
import { ChatInput } from '@/components/chat/ChatInput';
import { DAY_NAMES, FORM_FLOW, MAIN_MENU, PRIMARY, TEXT_INPUT_STEPS } from '@/components/chat/constants';
import { useChatState } from '@/components/chat/hooks/useChatState';
import { type BookingState, type BookingStep, type ConsultationFormData, type Option, type OptionKey } from '@/components/chat/types';

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>(MAIN_MENU);
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
  const [booking, setBooking] = useState<BookingState>({ step: 'doctor' });
  const [, setIsLoading] = useState(false);
  const [iosKeyboardOffset, setIosKeyboardOffset] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const {
    messages,
    addMessage,
    addBotMessage,
    replaceBotLoadingMessage,
    removeMessageByExactText,
    clearMessages,
  } = useChatState();

  // 通知父窗口 chatbot 打开/关闭状态，让父窗口调整 iframe 大小
  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'chatbot-state', open }, '*');
    }
  }, [open]);

  useEffect(() => {
    if (open && messages.length === 0) {
      const whatsappLines = getWhatsappContactLines().join('\n');
      addBotMessage(`你好，我係醫天圓小助手，請問有咩幫到你😊\n會為你提供即時資訊和更多幫助。如有需要直接Whatsapp聯繫，請與我們姑娘真人聯絡。\n\n真人聯絡通道：\n${whatsappLines}`);
    }
  }, [open, messages.length, addBotMessage]);

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

  // iOS keyboard offset: when keyboard opens, move widget above keyboard
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // Only apply on mobile (< 640px, Tailwind sm breakpoint)
      if (window.innerWidth >= 640) {
        setIosKeyboardOffset(0);
        return;
      }
      // Keyboard height = layout viewport height - visual viewport height
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height);
      setIosKeyboardOffset(keyboardHeight);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  const showInput = aiMode || formMode || (bookingMode && [
    'lastName', 'firstName', 'phone', 'email',
    'idCard', 'dob', 'allergies', 'medications', 'symptoms'
  ].includes(booking.step));

  const linkify = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="break-all underline decoration-[--primary]/70 decoration-2 underline-offset-2 hover:text-[--primary]"
            style={{ ['--primary' as string]: PRIMARY }}
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const resetToMain = () => {
    setOptions(MAIN_MENU);
    setAiMode(false);
    setFormMode(false);
    setBookingMode(false);
    setBooking({ step: 'doctor' });
    setIsLoading(false);
    setFormStep(0);
    setInput('');
    setFormError('');
    setConsultationFormData({ reason: '', name: '', email: '', phone: '' });
  };

  const handleAIResponse = async (text: string) => {
    addBotMessage('Connecting to AI... 正在為你連接Gemini，稍後回覆。');

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
      replaceBotLoadingMessage('Connecting to AI... 正在為你連接Gemini，稍後回覆。', data.response);
    } catch (error) {
      console.error('AI Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const whatsappLines = getWhatsappContactLines().join('\n');
      replaceBotLoadingMessage(
        'Connecting to AI... 正在為你連接Gemini，稍後回覆。',
        `抱歉，AI 服務暫時無法使用。\n\n錯誤訊息：${errorMessage}\n\n請直接聯絡我們姑娘：\n${whatsappLines}`,
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
        addBotMessage(
          '**醫天圓基本收費詳情**\n診金：$100 / 次\n基本藥費：$80 起 / 劑 (按藥量調整收費，每次最少3天)\n針灸：$300 – 500 / 次\n正骨手法：$350 – 700 / 次\n拔罐：$350 / 次\n\n👴 合資格長者可使用醫療券。\n📄 可提供處方及收據以辦理保險索償。'
        );
        setOptions([
          { label: '無問題了', value: 'end' },
          { label: '還有問題 (返回主選單)', value: 'main' },
        ]);
        break;
      }
      case 'clinic': {
        addBotMessage('請問你想查詢邊方面？');
        setOptions([
          { label: '營業時間', value: 'hours' },
          { label: '地址', value: 'addresses' },
          { label: '返回主選單', value: 'main' },
        ]);
        break;
      }
      case 'hours': {
        const hoursText = getClinicHoursLines().join('\n');
        addBotMessage(
          `${hoursText}\n\n⚠️ **重要提示**：以上時間僅供參考，具體開放時間及休假安排（包括特殊假期）會經常更新，請以網上預約平台為準。\n\n🔗 詳情請參考： https://www.edenclinic.hk/timetable/\n🔗 立即預約及查看最新時間表： https://edentcm.as.me/schedule.php`
        );
        setOptions([{ label: '返回主選單', value: 'main' }]);
        break;
      }
      case 'addresses': {
        const addressText = getClinicAddressLines().join('\n\n');
        addBotMessage(
          `請問你想查詢邊間診所呢？\n\n${addressText}`,
          getClinicRouteLinks()
        );
        setOptions([{ label: '返回主選單', value: 'main' }]);
        break;
      }
      case 'booking': {
        addBotMessage('請問你想預約邊位醫師呢？😊');
        setBookingMode(true);
        setBooking({ step: 'doctor' });
        const bookableDoctors = getBookableDoctorNameZhList();
        const doctorOpts: Option[] = bookableDoctors.map((name) => ({
          label: name,
          value: `doctor-${name}`,
        }));
        setOptions([...doctorOpts, { label: '返回主選單', value: 'main' }]);
        break;
      }

      case 'timetable': {
        addBotMessage(
          '以下係幾位醫師的時間表參考。\n\n⚠️ **重要提示**：具體開放時間及休假安排（包括特殊假期）會經常更新，請以網上預約平台為準。\n\n🔗 立即預約及查看最新時間表：https://edentcm.as.me/schedule.php\n🔗 查看診所時間表網頁：https://www.edenclinic.hk/timetable/'
        );
        setOptions([{ label: '返回主選單', value: 'main' }]);
        break;
      }
      case 'other': {
        const whatsappLines = getWhatsappContactLines().join('\n');
        setAiMode(true);
        addBotMessage(
          `請問你有無咩問題，我會儘量以我所知為你解答。😊\n如有需要，請與我們姑娘真人聯絡：\n${whatsappLines}`
        );
        setOptions([]);
        break;
      }
      case 'consult': {
        startForm();
        break;
      }
      case 'main': {
        addBotMessage('返回主選單，仲有咩可以幫到你？');
        resetToMain();
        break;
      }
      case 'end': {
        addBotMessage('好的，希望能幫到你！祝你身體健康，生活愉快！🌿');
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
          const link = getDoctorBookingLinkOrNote(name) || 'https://edentcm.as.me/schedule.php';
          const schedule = getDoctorScheduleSummaryByNameZh(name);
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
          setOptions([{ label: '返回主選單', value: 'main' }]);
        }
      }
    }
  };

  // ==================== BOOKING FLOW HANDLERS ====================

  const handleBookingDoctorSelect = (doctorNameZh: string) => {
    const doctor = DOCTOR_BY_NAME_ZH[doctorNameZh];
    if (!doctor) {
      addBotMessage('抱歉，此醫師暫不支援線上預約。');
      setOptions([{ label: '返回主選單', value: 'main' }]);
      return;
    }

    setBooking(prev => ({ ...prev, step: 'clinic', doctorId: doctor.id, doctorNameZh: doctor.nameZh, doctorName: doctor.nameEn }));

    // Find clinics where this doctor is active
    const activeClinics = CALENDAR_MAPPINGS
      .filter(m => m.doctorId === doctor.id && m.isActive && m.clinicId !== 'online')
      .filter(m => {
        // Check at least one day has a schedule
        return Object.values(m.schedule).some(s => s !== null && s.length > 0);
      })
      .map(m => m.clinicId);

    const uniqueClinics = [...new Set(activeClinics)].filter(isClinicId);

    if (uniqueClinics.length === 0) {
      addBotMessage(`抱歉，${doctorNameZh}目前暫無可預約的診所。`);
      setOptions([{ label: '返回主選單', value: 'main' }]);
      return;
    }

    addBotMessage(`好的！你要預約${doctorNameZh}，請選擇診所：`);
    const clinicOpts: Option[] = uniqueClinics.map(cId => {
      const clinic = CLINIC_BY_ID[cId];
      return { label: clinic?.nameZh || cId, value: `booking_clinic-${cId}` as OptionKey };
    });
    setOptions([...clinicOpts, { label: '⬅️ 上一步', value: 'booking_back' }, { label: '取消預約', value: 'booking_cancel' }]);
  };

  const handleBookingClinicSelect = (clinicId: string) => {
    if (!isClinicId(clinicId)) return;
    const clinic = CLINIC_BY_ID[clinicId];
    if (!clinic) return;

    setBooking(prev => ({ ...prev, step: 'visitType', clinicId: clinic.id, clinicNameZh: clinic.nameZh, clinicName: clinic.nameEn }));

    addBotMessage(`好的！${clinic.nameZh}診所。請問你係首診定覆診呢？`);
    setOptions([
      { label: '首診（第一次來）', value: 'booking_visit_first' },
      { label: '覆診（有來過）', value: 'booking_visit_followup' },
      { label: '⬅️ 上一步', value: 'booking_back' },
      { label: '取消預約', value: 'booking_cancel' },
    ]);
  };

  const handleBookingVisitTypeSelect = (isFirstVisit: boolean) => {
    setBooking(prev => ({ ...prev, step: 'date', isFirstVisit }));

    // Get schedule for this doctor-clinic combo
    const mapping = CALENDAR_MAPPINGS.find(m => m.doctorId === booking.doctorId && m.clinicId === booking.clinicId && m.isActive);
    if (!mapping) {
      addBotMessage('抱歉，找不到此醫師在該診所的排班。');
      setOptions([{ label: '返回主選單', value: 'main' }]);
      return;
    }

    // Generate available dates for next 14 days
    const today = new Date();
    const dateOptions: Option[] = [];

    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayOfWeek = d.getDay();
      const daySchedule = getScheduleForDay(mapping.schedule, dayOfWeek);

      if (daySchedule && daySchedule.length > 0) {
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const dayName = DAY_NAMES[dayOfWeek];
        const dateStr = `${d.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dateOptions.push({
          label: `${month}/${day} (${dayName})`,
          value: `booking_date-${dateStr}` as OptionKey,
        });
      }
    }

    if (dateOptions.length === 0) {
      addBotMessage(`抱歉，${booking.doctorNameZh}在${booking.clinicNameZh}未來兩星期內暫無可預約日子。`);
      setOptions([{ label: '返回主選單', value: 'main' }]);
      return;
    }

    addBotMessage(`${isFirstVisit ? '首診' : '覆診'}，請選擇日期：`);
    setOptions([...dateOptions, { label: '⬅️ 上一步', value: 'booking_back' }, { label: '取消預約', value: 'booking_cancel' }]);
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
        handleBookingVisitTypeSelect(booking.isFirstVisit!);
        return;
      }

      if (!data.slots || data.slots.length === 0) {
        addBotMessage('呢日已經滿晒 😅 請揀另一日。');
        handleBookingVisitTypeSelect(booking.isFirstVisit!);
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
      setOptions([...timeOpts, { label: '⬅️ 上一步', value: 'booking_back' }, { label: '取消預約', value: 'booking_cancel' }]);
    } catch (error) {
      setIsLoading(false);
      removeMessageByExactText('正在查詢可預約時段... ⏳');
      addBotMessage('抱歉，查詢時段時發生錯誤，請稍後再試。');
      setOptions([{ label: '返回主選單', value: 'main' }]);
    }
  };

  const handleBookingTimeSelect = (time: string) => {
    setBooking(prev => ({ ...prev, step: 'lastName', time }));
    addBotMessage(`好的，你選擇了 ${time}。\n\n請輸入你的姓氏（Last Name）：`);
    setOptions([{ label: '⬅️ 上一步', value: 'booking_back' }, { label: '取消預約', value: 'booking_cancel' }]);
  };



  const handleBookingConfirm = async () => {
    setOptions([]);
    setIsLoading(true);
    addBotMessage('正在處理預約... ⏳');

    const pickupLabel = PICKUP_LABELS[booking.medicationPickup || ''] || booking.medicationPickup || '';
    const notes = booking.isFirstVisit
      ? `[首診] ID: ${booking.idCard || 'N/A'} | DOB: ${booking.dob || 'N/A'} | Gender: ${booking.gender || 'N/A'} | Allergies: ${booking.allergies || 'None'} | Medications: ${booking.medications || 'None'} | Symptoms: ${booking.symptoms || 'N/A'} | Referral: ${booking.referralSource || 'N/A'} | Receipt: ${booking.needReceipt} | 取藥方法: ${pickupLabel}`
      : `[覆診] Receipt: ${booking.needReceipt} | 取藥方法: ${pickupLabel}`;

    try {
      const response = await fetch('/api/booking', {
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
          `\n📍 成功預約後會收到確認電郵通知。如需更改或取消預約，可在電郵內更改。\n祝你身體健康！🌿`
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
    addBotMessage(FORM_FLOW[0].prompt);
  };

  const validateInput = () => {
    const step = FORM_FLOW[formStep];
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
    addBotMessage('正在提交諮詢資料... ⏳');

    try {
      const response = await fetch('/api/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      removeMessageByExactText('正在提交諮詢資料... ⏳');
      setIsLoading(false);

      if (!response.ok || !data.success) {
        throw new Error(data.error || '提交失敗');
      }

      addBotMessage('資料已提交，我們會盡快以電話或電郵聯絡你。');
      resetToMain();
    } catch (error) {
      removeMessageByExactText('正在提交諮詢資料... ⏳');
      setIsLoading(false);
      addBotMessage('抱歉，提交諮詢時發生錯誤。請稍後再試，或直接 WhatsApp 聯絡診所姑娘。');
      setOptions([{ label: '返回主選單', value: 'main' }]);
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

    const step = FORM_FLOW[formStep];
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
    if (nextStep < FORM_FLOW.length) {
      setFormStep(nextStep);
      addBotMessage(FORM_FLOW[nextStep].prompt);
    } else {
      setFormMode(false);
      await submitConsultationForm(nextFormData);
    }
  };

  const BACK_CANCEL_OPTS: Option[] = [
    { label: '⬅️ 上一步', value: 'booking_back' },
    { label: '取消預約', value: 'booking_cancel' },
  ];

  // Handle booking text input steps
  const handleBookingInput = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setFormError('');

    if (booking.step === 'lastName') {
      if (trimmed.length < 1) { setFormError('請輸入姓氏'); return; }
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'firstName', lastName: trimmed }));
      setInput('');
      addBotMessage('請輸入你的名字（First Name）：');
      setOptions(BACK_CANCEL_OPTS);
    } else if (booking.step === 'firstName') {
      if (trimmed.length < 1) { setFormError('請輸入名字'); return; }
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'phone', firstName: trimmed }));
      setInput('');
      addBotMessage('請輸入你的電話號碼（8位數字）：');
      setOptions(BACK_CANCEL_OPTS);
    } else if (booking.step === 'phone') {
      if (!/^[0-9+\-\s]{8,}$/.test(trimmed)) { setFormError('電話格式唔正確，請輸入至少8位數字'); return; }
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'email', phone: trimmed }));
      setInput('');
      addBotMessage('請輸入電郵地址：');
      setOptions(BACK_CANCEL_OPTS);
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
        { label: '⬅️ 上一步', value: 'booking_back' },
        { label: '取消預約', value: 'booking_cancel' },
      ]);
    } else if (booking.step === 'idCard') {
      if (trimmed.length < 5) { setFormError('身份證號碼至少5個字'); return; }
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'dob', idCard: trimmed }));
      setInput('');
      addBotMessage('請輸入出生日期（例如：1990/01/15）：');
      setOptions(BACK_CANCEL_OPTS);
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
        { label: '⬅️ 上一步', value: 'booking_back' },
        { label: '取消預約', value: 'booking_cancel' },
      ]);
    } else if (booking.step === 'allergies') {
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'medications', allergies: trimmed }));
      setInput('');
      addBotMessage('請列出你正服用的藥物或保健品（如沒有請填「沒有」）：');
      setOptions(BACK_CANCEL_OPTS);
    } else if (booking.step === 'medications') {
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'symptoms', medications: trimmed }));
      setInput('');
      addBotMessage('請簡述你主要希望處理的病症/體質狀況：');
      setOptions(BACK_CANCEL_OPTS);
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
        { label: '⬅️ 上一步', value: 'booking_back' },
        { label: '取消預約', value: 'booking_cancel' },
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
      { label: '⬅️ 上一步', value: 'booking_back' },
      { label: '取消預約', value: 'booking_cancel' },
    ]);
  };

  // Handle medication pickup selection
  const handleBookingPickupSelect = (value: string) => {
    setBooking(prev => ({ ...prev, medicationPickup: value }));
    if (booking.isFirstVisit) {
      setBooking(prev => ({ ...prev, step: 'idCard' }));
      addBotMessage('因為你係首診，需要填寫以下資料。\n\n請輸入身份證號碼（例如：A123456(7)）：');
      setOptions(BACK_CANCEL_OPTS);
    } else {
      setBooking(prev => ({ ...prev, step: 'confirm' }));
      showBookingSummary();
    }
  };

  // Handle gender selection
  const handleBookingGenderSelect = (value: string) => {
    setBooking(prev => ({ ...prev, step: 'allergies', gender: value }));
    addBotMessage('請填寫你的藥物及食物敏感史（如沒有請填「沒有」）：');
    setOptions(BACK_CANCEL_OPTS);
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

    if (s === 'clinic') {
      // Back to doctor selection
      addBotMessage('請問你想預約邊位醫師呢？😊');
      setBooking(prev => ({ ...prev, step: 'doctor' }));
      const bookableDoctors = getBookableDoctorNameZhList();
      const doctorOpts: Option[] = bookableDoctors.map((name) => ({
        label: name, value: `doctor-${name}` as OptionKey,
      }));
      setOptions([...doctorOpts, { label: '返回主選單', value: 'main' }]);
    } else if (s === 'visitType') {
      handleBookingDoctorSelect(booking.doctorNameZh!);
    } else if (s === 'date') {
      handleBookingClinicSelect(booking.clinicId!);
    } else if (s === 'time') {
      handleBookingVisitTypeSelect(booking.isFirstVisit!);
    } else if (s === 'lastName') {
      handleBookingDateSelect(booking.date!);
    } else if (s === 'firstName') {
      setBooking(prev => ({ ...prev, step: 'lastName' }));
      addBotMessage('請輸入你的姓氏（Last Name）：');
      setOptions(BACK_CANCEL_OPTS);
    } else if (s === 'phone') {
      setBooking(prev => ({ ...prev, step: 'firstName' }));
      addBotMessage('請輸入你的名字（First Name）：');
      setOptions(BACK_CANCEL_OPTS);
    } else if (s === 'email') {
      setBooking(prev => ({ ...prev, step: 'phone' }));
      addBotMessage('請輸入你的電話號碼（8位數字）：');
      setOptions(BACK_CANCEL_OPTS);
    } else if (s === 'receipt') {
      setBooking(prev => ({ ...prev, step: 'email' }));
      addBotMessage('請輸入電郵地址：');
      setOptions(BACK_CANCEL_OPTS);
    } else if (s === 'medicationPickup') {
      setBooking(prev => ({ ...prev, step: 'receipt' }));
      addBotMessage('請問你是否需要收據作保險索償呢？');
      setOptions([
        { label: '不用', value: 'booking_receipt-no' },
        { label: '是，保險索償', value: 'booking_receipt-yes_insurance' },
        { label: '是，但非保險', value: 'booking_receipt-yes_not_insurance' },
        { label: '⬅️ 上一步', value: 'booking_back' },
        { label: '取消預約', value: 'booking_cancel' },
      ]);
    } else if (s === 'idCard') {
      setBooking(prev => ({ ...prev, step: 'medicationPickup' }));
      addBotMessage('請選擇取藥方法：');
      setOptions([
        { label: '不需要', value: 'booking_pickup-none' },
        { label: 'Lalamove', value: 'booking_pickup-lalamove' },
        { label: '順豐 SF Express', value: 'booking_pickup-sfexpress' },
        { label: '診所自取', value: 'booking_pickup-clinic_pickup' },
        { label: '⬅️ 上一步', value: 'booking_back' },
        { label: '取消預約', value: 'booking_cancel' },
      ]);
    } else if (s === 'dob') {
      setBooking(prev => ({ ...prev, step: 'idCard' }));
      addBotMessage('請輸入身份證號碼（例如：A123456(7)）：');
      setOptions(BACK_CANCEL_OPTS);
    } else if (s === 'gender') {
      setBooking(prev => ({ ...prev, step: 'dob' }));
      addBotMessage('請輸入出生日期（例如：1990/01/15）：');
      setOptions(BACK_CANCEL_OPTS);
    } else if (s === 'allergies') {
      setBooking(prev => ({ ...prev, step: 'gender' }));
      addBotMessage('請選擇性別：');
      setOptions([
        { label: '男 Male', value: 'booking_gender-male' },
        { label: '女 Female', value: 'booking_gender-female' },
        { label: '其他 Other', value: 'booking_gender-other' },
        { label: '⬅️ 上一步', value: 'booking_back' },
        { label: '取消預約', value: 'booking_cancel' },
      ]);
    } else if (s === 'medications') {
      setBooking(prev => ({ ...prev, step: 'allergies' }));
      addBotMessage('請填寫你的藥物及食物敏感史（如沒有請填「沒有」）：');
      setOptions(BACK_CANCEL_OPTS);
    } else if (s === 'symptoms') {
      setBooking(prev => ({ ...prev, step: 'medications' }));
      addBotMessage('請列出你正服用的藥物或保健品（如沒有請填「沒有」）：');
      setOptions(BACK_CANCEL_OPTS);
    } else if (s === 'referralSource') {
      setBooking(prev => ({ ...prev, step: 'symptoms' }));
      addBotMessage('請簡述你主要希望處理的病症/體質狀況：');
      setOptions(BACK_CANCEL_OPTS);
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
          { label: '⬅️ 上一步', value: 'booking_back' },
          { label: '取消預約', value: 'booking_cancel' },
        ]);
      } else {
        setBooking(prev => ({ ...prev, step: 'medicationPickup' }));
        addBotMessage('請選擇取藥方法：');
        setOptions([
          { label: '不需要', value: 'booking_pickup-none' },
          { label: 'Lalamove', value: 'booking_pickup-lalamove' },
          { label: '順豐 SF Express', value: 'booking_pickup-sfexpress' },
          { label: '診所自取', value: 'booking_pickup-clinic_pickup' },
          { label: '⬅️ 上一步', value: 'booking_back' },
          { label: '取消預約', value: 'booking_cancel' },
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
    if (formMode) return FORM_FLOW[formStep]?.placeholder ?? '請輸入';
    if (aiMode) return '輸入你的問題...（Enter 或 Send）';
    return '';
  }, [aiMode, formMode, formStep, bookingMode, booking.step]);

  return (
    <div
      className="fixed right-0 z-50 flex flex-col items-end gap-4 p-4"
      style={{
        bottom: open ? `${iosKeyboardOffset}px` : '120px',  // 关闭时在网页按钮上方，打开时移到底部；iOS键盘弹出时上移
        pointerEvents: open ? 'auto' : 'none', // iOS/Safari 對子元素 pointer-events:auto 支援不一致，開啟時直接允許事件命中容器
        touchAction: 'manipulation',
        transition: 'bottom 0.3s ease'
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
            <div className="flex h-[calc(100dvh-8rem)] max-h-[640px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:h-[560px]">
              <div className="relative overflow-hidden">
                <div
                  className="flex items-center justify-between gap-3 px-5 py-3"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <div className="flex items-center gap-3 text-white">
                    <div className="flex flex-col leading-tight">
                      <span className="text-lg font-semibold">醫天圓小助手</span>
                      <span className="text-xs font-semibold text-white/90">EDEN TCM CLINIC</span>
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
                      aria-label="重新開始"
                      type="button"
                    >
                      <RotateCcw size={14} />
                      <span>重新開始</span>
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

              <div className="flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-gray-50 to-white">
                <div
                  ref={viewportRef}
                  className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-gray-200/70 scrollbar-track-transparent"
                >
                  <ChatMessages messages={messages} linkify={linkify} primaryColor={PRIMARY} />
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
            {open ? '收起對話' : '立即諮詢'}
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
