import { type BookingStep, type FormStepKey, type Option } from './types';

export const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export const PRIMARY = '#2d5016';
export const ACCENT = '#9b7b5a';

export const MAIN_MENU: Option[] = [
  { label: '收費', value: 'fees' },
  { label: '診所資訊', value: 'clinic' },
  { label: '預約', value: 'booking' },
  { label: '醫師時間表', value: 'timetable' },
  { label: '其他問題', value: 'other' },
  { label: '諮詢醫師', value: 'consult' },
];

export const FORM_FLOW: { key: FormStepKey; prompt: string; placeholder: string }[] = [
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

export const TEXT_INPUT_STEPS: BookingStep[] = [
  'lastName', 'firstName', 'phone', 'email',
  'idCard', 'dob', 'allergies', 'medications', 'symptoms',
];
