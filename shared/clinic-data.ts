import { buildBookingUrl } from '@/lib/public-url';
import {
  formatBookingTreatmentLabelFromIds,
  getBookingTreatmentOptionsByIds,
  type BookingTreatmentOption,
  type BookingTreatmentOptionId,
} from '@/shared/booking-treatment-options';

export const DOCTOR_IDS = ['chan', 'lee', 'hon', 'chau', 'cheung', 'leung', 'wong'] as const;
export type DoctorId = (typeof DOCTOR_IDS)[number];

export const CLINIC_IDS = ['central', 'jordan', 'tsuenwan', 'online'] as const;
export type ClinicId = (typeof CLINIC_IDS)[number];

export const PHYSICAL_CLINIC_IDS = ['central', 'jordan', 'tsuenwan'] as const;
export type PhysicalClinicId = (typeof PHYSICAL_CLINIC_IDS)[number];

const DOCTOR_ID_SET = new Set<string>(DOCTOR_IDS);
const CLINIC_ID_SET = new Set<string>(CLINIC_IDS);
const CLINIC_GOOGLE_MAP_URLS: Record<PhysicalClinicId, string> = {
  central: 'https://maps.app.goo.gl/G3S73hfG6qk5o3cs8?g_st=ic',
  jordan: 'https://maps.app.goo.gl/2pH44Tx6QQcWpn538?g_st=ic',
  tsuenwan: 'https://maps.app.goo.gl/i18v8oYQAoG65XM66?g_st=ic',
};

export type DoctorProfile = {
  id: DoctorId;
  nameZh: string;
  nameEn: string;
  avatarSrc?: string;
  avatarObjectPosition?: string;
  bookingUrl?: string;
  bookingNote?: string;
  scheduleNote?: string;
  bookingTreatmentOptions?: readonly BookingTreatmentOptionId[];
  bookingSlotMinutes?: number;
};

export type ClinicProfile = {
  id: ClinicId;
  nameZh: string;
  nameEn: string;
  address: string;
  phones: string[];
  contactPhone?: string;
  whatsappUrl?: string;
  whatsappLabel?: string;
  hoursText: string;
  googleMapUrl?: string;
  routeMapUrl?: string;
};

function formatMarkdownLink(label: string, href: string): string {
  return `[${label}](${href})`;
}

const DEFAULT_DOCTOR_BOOKING_TREATMENT_OPTION_IDS: readonly BookingTreatmentOptionId[] = [
  'acupuncture',
  'manual_therapy',
  'herbal_prescription',
  'other',
];
const DEFAULT_DOCTOR_BOOKING_SLOT_MINUTES = 15;

export const CLINICS: ClinicProfile[] = [
  {
    id: 'central',
    nameZh: '中環',
    nameEn: 'Central',
    address: '中環皇后大道中70號卡佛大廈23樓2310室',
    phones: ['3575 9733', '6733 3234'],
    contactPhone: '6733 3234',
    whatsappUrl: 'https://wa.me/85267333234',
    whatsappLabel: '按此聯絡姑娘',
    hoursText: '週一至五 11:00-14:00, 15:30-19:30；週六日及公眾假期休息',
    googleMapUrl: CLINIC_GOOGLE_MAP_URLS.central,
    routeMapUrl: 'https://www.edenclinic.hk/中環街景路線圖/',
  },
  {
    id: 'jordan',
    nameZh: '佐敦',
    nameEn: 'Jordan',
    address: '九龍佐敦寶靈街6號佐敦中心7樓全層',
    phones: ['3105 0733', '6733 3801'],
    contactPhone: '6733 3801',
    whatsappUrl: 'https://wa.me/85267333801',
    whatsappLabel: '按此聯絡姑娘',
    hoursText: '週一至五 11:00-14:00, 15:30-19:30；週六 11:00-14:00, 15:30-18:30；週日及公眾假期休息',
    googleMapUrl: CLINIC_GOOGLE_MAP_URLS.jordan,
    routeMapUrl: 'https://www.edenclinic.hk/佐敦街景路線圖/',
  },
  {
    id: 'tsuenwan',
    nameZh: '荃灣',
    nameEn: 'Tsuen Wan',
    address: '荃灣富麗花園商場A座地下20號舖',
    phones: ['2698 5422', '5189 9065'],
    contactPhone: '2698 5422 / 5189 9065',
    whatsappUrl: 'https://wa.me/85251899065',
    whatsappLabel: '按此聯絡姑娘',
    hoursText: '週一、二、四至日 10:30-14:00，15:30-19:00；週三及公眾假期休息',
    googleMapUrl: CLINIC_GOOGLE_MAP_URLS.tsuenwan,
    routeMapUrl: 'https://www.edenclinic.hk/荃灣街景路線圖/',
  },
  {
    id: 'online',
    nameZh: '網上',
    nameEn: 'Online',
    address: '網上 Zoom / WhatsApp Video',
    phones: [],
    hoursText: '視乎醫師安排',
  },
];

export const DOCTORS: DoctorProfile[] = [
  {
    id: 'chan',
    nameZh: '陳家富醫師',
    nameEn: 'Dr. Chan',
    bookingUrl: buildBookingUrl({ doctorId: 'chan' }),
    bookingTreatmentOptions: DEFAULT_DOCTOR_BOOKING_TREATMENT_OPTION_IDS,
  },
  {
    id: 'lee',
    nameZh: '李芊霖醫師',
    nameEn: 'Dr. Lee',
    avatarSrc: '/doctor-avatars/lee.jpg',
    avatarObjectPosition: '84% center',
    bookingUrl: buildBookingUrl({ doctorId: 'lee' }),
    bookingTreatmentOptions: ['acupuncture'],
  },
  {
    id: 'hon',
    nameZh: '韓曉恩醫師',
    nameEn: 'Dr. Hon',
    avatarSrc: '/doctor-avatars/hon.jpg',
    avatarObjectPosition: '38% center',
    bookingUrl: buildBookingUrl({ doctorId: 'hon' }),
    bookingTreatmentOptions: DEFAULT_DOCTOR_BOOKING_TREATMENT_OPTION_IDS,
    bookingSlotMinutes: 30,
    scheduleNote:
      '2026年3月1日至2026年3月9日如欲預約，請致電或 WhatsApp 聯絡診所；2026年3月10日至2026年4月30日韓醫師進修休診，會由張天慧醫師及梁仲威醫師駐診。',
  },
  {
    id: 'chau',
    nameZh: '周德健醫師',
    nameEn: 'Dr. Chau',
    avatarSrc: '/doctor-avatars/chau.jpg',
    avatarObjectPosition: '82% center',
    bookingUrl: buildBookingUrl({ doctorId: 'chau' }),
    bookingTreatmentOptions: DEFAULT_DOCTOR_BOOKING_TREATMENT_OPTION_IDS,
    bookingSlotMinutes: 30,
  },
  {
    id: 'cheung',
    nameZh: '張天慧醫師',
    nameEn: 'Dr. Cheung',
    avatarSrc: '/doctor-avatars/cheung.jpg',
    avatarObjectPosition: '80% center',
    bookingUrl: buildBookingUrl({ doctorId: 'cheung' }),
    bookingTreatmentOptions: DEFAULT_DOCTOR_BOOKING_TREATMENT_OPTION_IDS,
  },
  {
    id: 'leung',
    nameZh: '梁仲威醫師',
    nameEn: 'Dr. Leung',
    avatarSrc: '/doctor-avatars/leung.jpg',
    avatarObjectPosition: '88% center',
    bookingUrl: buildBookingUrl({ doctorId: 'leung' }),
    bookingTreatmentOptions: DEFAULT_DOCTOR_BOOKING_TREATMENT_OPTION_IDS,
  },
  {
    id: 'wong',
    nameZh: '黃浩哲脊醫',
    nameEn: 'Dr. Samuel H.C. Wong',
    avatarSrc: '/images/dr-samuel-wong-chiropractor.png',
    avatarObjectPosition: '74% 16%',
    bookingUrl: buildBookingUrl({ doctorId: 'wong', clinicId: 'jordan' }),
    bookingTreatmentOptions: ['manual_therapy'],
    bookingSlotMinutes: 30,
    scheduleNote:
      '為咗方便醫生安排時間，呢個時段需要最少三位病人先會開診。未滿三人，系統會自動取消預約，唔好意思。',
  },
];

export const DOCTOR_BY_ID: Record<DoctorId, DoctorProfile> = Object.fromEntries(
  DOCTORS.map((doctor) => [doctor.id, doctor])
) as Record<DoctorId, DoctorProfile>;

export const DOCTOR_BY_NAME_ZH: Record<string, DoctorProfile> = Object.fromEntries(
  DOCTORS.map((doctor) => [doctor.nameZh, doctor])
);

export const CLINIC_BY_ID: Record<ClinicId, ClinicProfile> = Object.fromEntries(
  CLINICS.map((clinic) => [clinic.id, clinic])
) as Record<ClinicId, ClinicProfile>;

export const DOCTOR_ID_BY_NAME_ZH: Record<string, DoctorId> = Object.fromEntries(
  DOCTORS.map((doctor) => [doctor.nameZh, doctor.id])
);

export const CLINIC_ID_BY_NAME_ZH: Record<string, ClinicId> = Object.fromEntries(
  CLINICS.map((clinic) => [clinic.nameZh, clinic.id])
);

export function isDoctorId(value: string): value is DoctorId {
  return DOCTOR_ID_SET.has(value);
}

export function isClinicId(value: string): value is ClinicId {
  return CLINIC_ID_SET.has(value);
}

export function getDoctorBookingTreatmentLabel(doctorId: string): string {
  return formatBookingTreatmentLabelFromIds(
    getDoctorBookingTreatmentOptionIds(doctorId)
  );
}

export function getDoctorBookingTreatmentOptionIds(
  doctorId: string
): readonly BookingTreatmentOptionId[] {
  if (!isDoctorId(doctorId)) {
    return DEFAULT_DOCTOR_BOOKING_TREATMENT_OPTION_IDS;
  }

  return (
    DOCTOR_BY_ID[doctorId].bookingTreatmentOptions ||
    DEFAULT_DOCTOR_BOOKING_TREATMENT_OPTION_IDS
  );
}

export function getDoctorBookingTreatmentOptions(
  doctorId: string
): BookingTreatmentOption[] {
  return getBookingTreatmentOptionsByIds(
    getDoctorBookingTreatmentOptionIds(doctorId)
  );
}

export function getDoctorBookingSlotMinutes(doctorId: string): number {
  if (!isDoctorId(doctorId)) {
    return DEFAULT_DOCTOR_BOOKING_SLOT_MINUTES;
  }

  return DOCTOR_BY_ID[doctorId].bookingSlotMinutes || DEFAULT_DOCTOR_BOOKING_SLOT_MINUTES;
}

export function getDoctorBookingLinkOrNote(nameZh: string): string | undefined {
  const doctor = DOCTOR_BY_NAME_ZH[nameZh];
  if (!doctor) return undefined;
  return doctor.bookingUrl || doctor.bookingNote;
}

export function getClinicAddress(clinicId: string): string {
  return CLINIC_BY_ID[clinicId as ClinicId]?.address || '';
}

export function getClinicHoursLines(): string[] {
  return PHYSICAL_CLINIC_IDS.map((clinicId) => {
    const clinic = CLINIC_BY_ID[clinicId];
    return `🏥 ${clinic.nameZh}診所：${clinic.hoursText}`;
  });
}

export function getClinicAddressLines(): string[] {
  return PHYSICAL_CLINIC_IDS.map((clinicId) => {
    const clinic = CLINIC_BY_ID[clinicId];
    const phones = clinic.phones.length > 0 ? `\n電話：${clinic.phones.join(', ')}` : '';
    return `${clinic.nameZh}：${clinic.address}${phones}`;
  });
}

export function getClinicRouteLinks(): { label: string; href: string }[] {
  return PHYSICAL_CLINIC_IDS
    .map((clinicId) => {
      const clinic = CLINIC_BY_ID[clinicId];
      const href = clinic.googleMapUrl || clinic.routeMapUrl;
      if (!href) return null;
      return { label: `${clinic.nameZh}Google地圖`, href };
    })
    .filter((value): value is { label: string; href: string } => Boolean(value));
}

export function getWhatsappContactLines(): string[] {
  return PHYSICAL_CLINIC_IDS
    .map((clinicId) => {
      const clinic = CLINIC_BY_ID[clinicId];
      if (!clinic.whatsappUrl) return null;
      return `${clinic.nameZh}診所 WhatsApp：${formatMarkdownLink(
        clinic.whatsappLabel || '按此聯絡姑娘',
        clinic.whatsappUrl,
      )}`;
    })
    .filter((value): value is string => Boolean(value));
}

export function getPromptClinicInfoLines(): string[] {
  return PHYSICAL_CLINIC_IDS.map((clinicId) => {
    const clinic = CLINIC_BY_ID[clinicId];
    const contactPhone = clinic.contactPhone || clinic.phones[0] || '';
    const phoneInfo = contactPhone ? ` | 聯絡電話：${contactPhone}` : '';
    const whatsappInfo = clinic.whatsappUrl
      ? ` | WhatsApp：${formatMarkdownLink(clinic.whatsappLabel || '按此聯絡姑娘', clinic.whatsappUrl)}`
      : '';
    const mapInfo = clinic.googleMapUrl
      ? ` | Google地圖：${formatMarkdownLink(`${clinic.nameZh}診所 Google 地圖`, clinic.googleMapUrl)}`
      : '';
    return `${clinic.nameZh}診所：地址：${clinic.address}${phoneInfo}${whatsappInfo} | ${clinic.hoursText}${mapInfo}`;
  });
}

export function getClinicInfoHtmlSections(): string {
  return PHYSICAL_CLINIC_IDS
    .map((clinicId) => {
      const clinic = CLINIC_BY_ID[clinicId];
      return `<p>📍<strong>${clinic.nameZh}店</strong><br>\n地址：${clinic.address}</p>`;
    })
    .join('\n\n');
}
