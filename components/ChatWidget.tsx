'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link as LinkIcon, MessageCircle, RotateCcw, Send, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
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

type Sender = 'bot' | 'user';

type Message = {
  id: string;
  sender: Sender;
  text: string;
  links?: { label: string; href: string }[];
};

type OptionKey =
  | 'fees'
  | 'clinic'
  | 'hours'
  | 'addresses'
  | 'booking'
  | 'timetable'
  | 'other'
  | 'consult'
  | 'end'
  | 'main'
  | `doctor-${string}`
  | `booking_clinic-${string}`
  | `booking_date-${string}`
  | `booking_time-${string}`
  | `booking_time-${string}`
  | 'booking_confirm'
  | 'booking_cancel';

type Option = { label: string; value: OptionKey };

type FormStepKey = 'reason' | 'name' | 'email' | 'phone';

// Booking flow types
type BookingStep = 'doctor' | 'clinic' | 'date' | 'time' | 'name' | 'phone' | 'email' | 'confirm';

type BookingState = {
  step: BookingStep;
  doctorId?: string;
  doctorNameZh?: string;
  doctorName?: string;
  clinicId?: string;
  clinicNameZh?: string;
  clinicName?: string;
  date?: string;
  time?: string;
  patientName?: string;
  phone?: string;
  email?: string;
};

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

const PRIMARY = '#2d5016';
const ACCENT = '#9b7b5a';

const mainMenu: Option[] = [
  { label: '收費', value: 'fees' },
  { label: '診所資訊', value: 'clinic' },
  { label: '預約', value: 'booking' },
  { label: '醫師時間表', value: 'timetable' },
  { label: '其他問題', value: 'other' },
  { label: '諮詢醫師', value: 'consult' },
];


const formFlow: { key: FormStepKey; prompt: string; placeholder: string }[] = [
  {
    key: 'reason',
    prompt: '我地好樂意為你介紹合適的醫師。請問你有邊方面問題想搵醫師幫手？',
    placeholder: '描述你的症狀或想諮詢的問題',
  },
  {
    key: 'name',
    prompt: '請問你的姓名係？',
    placeholder: '輸入姓名',
  },
  {
    key: 'email',
    prompt: '想請問你的電郵地址 😊 讓我地醫師可以回覆你',
    placeholder: 'your@email.com',
  },
  {
    key: 'phone',
    prompt: '然後係你的電話號碼? (請確保輸入正確，讓同事Whatsapp或電話回覆)',
    placeholder: '852XXXXXXX',
  },
];

const generateId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [options, setOptions] = useState<Option[]>(mainMenu);
  const [aiMode, setAiMode] = useState(false);
  const [formMode, setFormMode] = useState(false);
  const [formStep, setFormStep] = useState(0);
  const [input, setInput] = useState('');
  const [formError, setFormError] = useState('');
  const [bookingMode, setBookingMode] = useState(false);
  const [booking, setBooking] = useState<BookingState>({ step: 'doctor' });
  const [isLoading, setIsLoading] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // 通知父窗口 chatbot 打开/关闭状态，让父窗口调整 iframe 大小
  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'chatbot-state', open }, '*');
    }
  }, [open]);

  useEffect(() => {
    if (open && messages.length === 0) {
      const whatsappLines = getWhatsappContactLines().join('\n');
      setMessages([
        {
          id: generateId(),
          sender: 'bot',
          text: `你好，我係醫天圓小助手，請問有咩幫到你😊\n會為你提供即時資訊和更多幫助。如有需要直接Whatsapp聯繫，請與我們姑娘真人聯絡。\n\n真人聯絡通道：\n${whatsappLines}`,
        },
      ]);
    }
  }, [open, messages.length]);

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

  const showInput = aiMode || formMode || (bookingMode && ['name', 'phone', 'email'].includes(booking.step));

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

  const addMessage = (sender: Sender, text: string, links?: Message['links']) => {
    setMessages((prev) => [...prev, { id: generateId(), sender, text, links }]);
  };

  const addBotMessage = (text: string, links?: Message['links']) => addMessage('bot', text, links);

  const resetToMain = () => {
    setOptions(mainMenu);
    setAiMode(false);
    setFormMode(false);
    setBookingMode(false);
    setBooking({ step: 'doctor' });
    setIsLoading(false);
    setFormStep(0);
    setInput('');
    setFormError('');
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
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.text !== 'Connecting to AI... 正在為你連接Gemini，稍後回覆。');
        return [...filtered, { id: generateId(), sender: 'bot', text: data.response }];
      });
    } catch (error) {
      console.error('AI Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.text !== 'Connecting to AI... 正在為你連接Gemini，稍後回覆。');
        const whatsappLines = getWhatsappContactLines().join('\n');
        return [
          ...filtered,
          {
            id: generateId(),
            sender: 'bot',
            text: `抱歉，AI 服務暫時無法使用。\n\n錯誤訊息：${errorMessage}\n\n請直接聯絡我們姑娘：\n${whatsappLines}`,
          },
        ];
      });
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
    setOptions([...clinicOpts, { label: '取消預約', value: 'booking_cancel' }]);
  };

  const handleBookingClinicSelect = (clinicId: string) => {
    if (!isClinicId(clinicId)) return;
    const clinic = CLINIC_BY_ID[clinicId];
    if (!clinic) return;

    setBooking(prev => ({ ...prev, step: 'date', clinicId: clinic.id, clinicNameZh: clinic.nameZh, clinicName: clinic.nameEn }));

    // Get schedule for this doctor-clinic combo
    const mapping = CALENDAR_MAPPINGS.find(m => m.doctorId === booking.doctorId && m.clinicId === clinicId && m.isActive);
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
      addBotMessage(`抱歉，${booking.doctorNameZh}在${clinic.nameZh}未來兩星期內暫無可預約日子。`);
      setOptions([{ label: '返回主選單', value: 'main' }]);
      return;
    }

    addBotMessage(`${clinic.nameZh}診所，請選擇日期：`);
    setOptions([...dateOptions, { label: '取消預約', value: 'booking_cancel' }]);
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
      setMessages(prev => prev.filter(m => m.text !== '正在查詢可預約時段... ⏳'));

      if (data.isClosed) {
        addBotMessage(data.isHoliday ? '呢日係假期，醫師休息。請揀另一日。' : '呢日醫師唔應診。請揀另一日。');
        // Go back to date selection
        handleBookingClinicSelect(booking.clinicId!);
        return;
      }

      if (!data.slots || data.slots.length === 0) {
        addBotMessage('呢日已經滿晒 😅 請揀另一日。');
        handleBookingClinicSelect(booking.clinicId!);
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
      setOptions([...timeOpts, { label: '取消預約', value: 'booking_cancel' }]);
    } catch (error) {
      setIsLoading(false);
      setMessages(prev => prev.filter(m => m.text !== '正在查詢可預約時段... ⏳'));
      addBotMessage('抱歉，查詢時段時發生錯誤，請稍後再試。');
      setOptions([{ label: '返回主選單', value: 'main' }]);
    }
  };

  const handleBookingTimeSelect = (time: string) => {
    setBooking(prev => ({ ...prev, step: 'name', time }));
    setOptions([]);
    addBotMessage(`好的，你選擇了 ${time}。\n\n請輸入你的姓名：`);
  };



  const handleBookingConfirm = async () => {
    setOptions([]);
    setIsLoading(true);
    addBotMessage('正在處理預約... ⏳');

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
          patientName: booking.patientName,
          phone: booking.phone,
          email: booking.email || '',
          notes: '',
        }),
      });

      const data = await response.json();
      setIsLoading(false);

      // Remove loading message
      setMessages(prev => prev.filter(m => m.text !== '正在處理預約... ⏳'));

      if (data.success) {
        const d = new Date(booking.date!);
        const dayName = DAY_NAMES[d.getDay()];
        addBotMessage(
          `✅ 預約成功！\n\n` +
          `📋 預約資料：\n` +
          `👨‍⚕️ 醫師：${booking.doctorNameZh}\n` +
          `🏥 診所：${booking.clinicNameZh}\n` +
          `📅 日期：${d.getMonth() + 1}/${d.getDate()} (${dayName})\n` +
          `🕐 時間：${booking.time}\n` +
          `👤 姓名：${booking.patientName}\n` +
          `📞 電話：${booking.phone}\n` +
          (booking.email ? `📧 電郵：${booking.email}\n` : '') +
          `\n預約編號：${data.bookingId}\n` +
          `\n如需更改或取消預約，請聯絡診所姑娘。祝你身體健康！🌿`
        );
      } else {
        addBotMessage(`抱歉，預約未能完成：${data.error || '未知錯誤'}\n\n請稍後再試或直接聯絡我們。`);
      }
    } catch (error) {
      setIsLoading(false);
      setMessages(prev => prev.filter(m => m.text !== '正在處理預約... ⏳'));
      addBotMessage('抱歉，預約時發生錯誤，請稍後再試或直接聯絡診所。');
    }

    resetToMain();
  };

  const showBookingSummary = (email: string) => {
    const d = new Date(booking.date!);
    const dayName = DAY_NAMES[d.getDay()];
    addBotMessage(
      `請確認以下預約資料：\n\n` +
      `👨‍⚕️ 醫師：${booking.doctorNameZh}\n` +
      `🏥 診所：${booking.clinicNameZh}\n` +
      `📅 日期：${d.getMonth() + 1}/${d.getDate()} (${dayName})\n` +
      `🕐 時間：${booking.time}\n` +
      `👤 姓名：${booking.patientName}\n` +
      `📞 電話：${booking.phone}\n` +
      (email ? `📧 電郵：${email}\n` : '') +
      `\n確認預約嗎？`
    );
    setOptions([
      { label: '✅ 確認預約', value: 'booking_confirm' },
      { label: '❌ 取消', value: 'booking_cancel' },
    ]);
  };

  const startForm = () => {
    setFormMode(true);
    setAiMode(false);
    setOptions([]);
    setFormStep(0);
    setInput('');
    addBotMessage(formFlow[0].prompt);
  };

  const validateInput = () => {
    const step = formFlow[formStep];
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

  const handleFormSubmit = () => {
    if (!input.trim()) return;
    const error = validateInput();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError('');
    addMessage('user', input.trim());
    const nextStep = formStep + 1;
    setInput('');
    if (nextStep < formFlow.length) {
      setFormStep(nextStep);
      addBotMessage(formFlow[nextStep].prompt);
    } else {
      setFormMode(false);
      addBotMessage('資料已收到 (Simulated)。我們會盡快聯絡你。');
      resetToMain();
    }
  };

  // Handle booking text input (name, phone, email)
  const handleBookingInput = () => {
    if (!input.trim() && booking.step !== 'email') return;
    const trimmed = input.trim();
    setFormError('');

    if (booking.step === 'name') {
      if (trimmed.length < 2) {
        setFormError('請輸入至少2個字的姓名');
        return;
      }
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'phone', patientName: trimmed }));
      setInput('');
      addBotMessage('請輸入你的電話號碼（8位數字）：');
    } else if (booking.step === 'phone') {
      if (!/^[0-9+\-\s]{8,}$/.test(trimmed)) {
        setFormError('電話格式唔正確，請輸入至少8位數字');
        return;
      }
      addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'email', phone: trimmed }));
      setInput('');
      addBotMessage('請輸入電郵地址：');
      setOptions([]);
    } else if (booking.step === 'email') {
      if (!trimmed || !/^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/i.test(trimmed)) {
        setFormError('請輸入有效的電郵地址');
        return;
      }
      if (trimmed) addMessage('user', trimmed);
      setBooking(prev => ({ ...prev, step: 'confirm', email: trimmed }));
      setInput('');
      setOptions([]);
      showBookingSummary(trimmed);
    }
  };

  const handleAIInput = () => {
    if (!input.trim()) return;
    addMessage('user', input.trim());
    handleAIResponse(input.trim());
    setInput('');
  };

  const handleSend = () => {
    if (bookingMode && ['name', 'phone', 'email'].includes(booking.step)) {
      handleBookingInput();
    } else if (formMode) {
      handleFormSubmit();
    } else if (aiMode) {
      handleAIInput();
    }
  };

  const placeholder = useMemo(() => {
    if (bookingMode) {
      if (booking.step === 'name') return '輸入姓名';
      if (booking.step === 'phone') return '輸入電話號碼';
      if (booking.step === 'email') return '輸入電郵';
    }
    if (formMode) return formFlow[formStep]?.placeholder ?? '請輸入';
    if (aiMode) return '輸入你的問題...（Enter 或 Send）';
    return '';
  }, [aiMode, formMode, formStep, bookingMode, booking.step]);

  return (
    <div
      className="fixed right-0 z-50 flex flex-col items-end gap-4 p-4"
      style={{
        bottom: open ? '0px' : '120px',  // 关闭时在网页按钮上方，打开时移到底部
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
            <div className="flex h-[calc(100vh-8rem)] max-h-[640px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:h-[560px]">
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
                        setMessages([]);
                        resetToMain();
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.opacity = '';
                        setMessages([]);
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
                  <div className="flex min-h-0 flex-col gap-3 pr-1">
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-start gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.sender === 'bot' && (
                          <div className="relative h-8 w-8 shrink-0">
                            <Image src="/logo eden.png" alt="醫天圓" fill className="object-contain" />
                          </div>
                        )}
                        <div
                          className={`max-w-[82%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.sender === 'user'
                            ? 'border border-[--primary]/25 bg-[#e8f3eb] text-[#1f3a18]'
                            : 'bg-gray-100 text-gray-800'
                            }`}
                          style={msg.sender === 'user' ? { ['--primary' as string]: PRIMARY } : {}}
                        >
                          {linkify(msg.text)}
                          {msg.links && (
                            <div className="mt-2 space-y-1">
                              {msg.links.map((link) => (
                                <Link
                                  key={link.href}
                                  href={link.href}
                                  className="flex items-center gap-1 text-xs underline transition hover:text-gray-200 md:hover:text-gray-700"
                                  target="_blank"
                                >
                                  <LinkIcon size={14} />
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {options.length > 0 && (
                  <div className="shrink-0 px-4 pb-4">
                    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-inner">
                      <div className="grid grid-cols-2 gap-2">
                        {options.map((option) => (
                          <button
                            key={option.label}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleOptionSelect(option);
                            }}
                            onTouchEnd={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.currentTarget.style.transform = '';
                              e.currentTarget.style.backgroundColor = '';
                              handleOptionSelect(option);
                            }}
                            onTouchStart={(e) => {
                              e.currentTarget.style.transform = 'scale(0.95)';
                              e.currentTarget.style.backgroundColor = PRIMARY;
                              e.currentTarget.style.color = 'white';
                            }}
                            onTouchCancel={(e) => {
                              e.currentTarget.style.transform = '';
                              e.currentTarget.style.backgroundColor = '';
                              e.currentTarget.style.color = '';
                            }}
                            className="relative z-10 rounded-xl border-2 border-[#2d5016] bg-white px-3 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 hover:bg-[#2d5016] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d5016] active:scale-95 active:bg-[#2d5016] active:text-white"
                            style={{
                              color: PRIMARY,
                              touchAction: 'manipulation',
                              minHeight: '48px',
                              WebkitTapHighlightColor: 'transparent',
                              WebkitUserSelect: 'none',
                              userSelect: 'none'
                            }}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {showInput && (
                <div className="border-t border-gray-100 bg-white px-4 py-3">
                  <div
                    className="flex items-center gap-2 rounded-2xl border border-[--primary]/20 bg-[#f4fbf3] px-3 py-2 shadow-sm focus-within:border-[--primary] focus-within:bg-white focus-within:ring-2 focus-within:ring-[--primary]/20"
                    style={{ ['--primary' as string]: PRIMARY }}
                  >
                    <input
                      className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={placeholder}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSend();
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.transform = '';
                        handleSend();
                      }}
                      onTouchStart={(e) => {
                        e.currentTarget.style.transform = 'scale(0.95)';
                      }}
                      onTouchCancel={(e) => {
                        e.currentTarget.style.transform = '';
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-[--primary] text-white transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[--primary] active:scale-95"
                      aria-label="Send"
                      type="button"
                      style={{
                        ['--primary' as string]: PRIMARY,
                        touchAction: 'manipulation',
                        minHeight: '44px',
                        minWidth: '44px',
                        WebkitTapHighlightColor: 'transparent',
                        WebkitUserSelect: 'none',
                        userSelect: 'none'
                      }}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                  {aiMode && (
                    <p className="mt-2 text-xs text-[--primary]" style={{ ['--primary' as string]: PRIMARY }}>
                      已進入 AI 模式：直接輸入問題後按 Enter 或右側 Send。
                    </p>
                  )}
                  {formError && <p className="mt-2 text-xs text-red-500">{formError}</p>}
                </div>
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
