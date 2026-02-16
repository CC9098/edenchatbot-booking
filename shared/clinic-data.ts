export const DOCTOR_IDS = ['chan', 'lee', 'hon', 'chau', 'cheung', 'leung'] as const;
export type DoctorId = (typeof DOCTOR_IDS)[number];

export const CLINIC_IDS = ['central', 'jordan', 'tsuenwan', 'online'] as const;
export type ClinicId = (typeof CLINIC_IDS)[number];

export const PHYSICAL_CLINIC_IDS = ['central', 'jordan', 'tsuenwan'] as const;
export type PhysicalClinicId = (typeof PHYSICAL_CLINIC_IDS)[number];

const DOCTOR_ID_SET = new Set<string>(DOCTOR_IDS);
const CLINIC_ID_SET = new Set<string>(CLINIC_IDS);

export type DoctorProfile = {
  id: DoctorId;
  nameZh: string;
  nameEn: string;
  bookingUrl?: string;
  bookingNote?: string;
};

export type ClinicProfile = {
  id: ClinicId;
  nameZh: string;
  nameEn: string;
  address: string;
  phones: string[];
  whatsappUrl?: string;
  hoursText: string;
  googleMapUrl?: string;
  routeMapUrl?: string;
};

function buildGoogleMapSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export const CLINICS: ClinicProfile[] = [
  {
    id: 'central',
    nameZh: '中環',
    nameEn: 'Central',
    address: '中環皇后大道中70號卡佛大廈23樓2310室',
    phones: ['3575 9733', '6733 3234'],
    whatsappUrl: 'https://wa.me/+85267333234',
    hoursText: '週一至五 11:00-14:00, 15:30-19:30；週六日及公眾假期休息',
    googleMapUrl: buildGoogleMapSearchUrl('中環皇后大道中70號卡佛大廈23樓2310室'),
    routeMapUrl: 'https://www.edenclinic.hk/中環街景路線圖/',
  },
  {
    id: 'jordan',
    nameZh: '佐敦',
    nameEn: 'Jordan',
    address: '九龍佐敦寶靈街6號佐敦中心7樓全層',
    phones: ['3105 0733', '6733 3801'],
    whatsappUrl: 'https://wa.me/+85267333801',
    hoursText: '週一至五 11:00-14:00, 15:30-19:30；週六 11:00-14:00, 15:30-18:30；週日及公眾假期休息',
    googleMapUrl: buildGoogleMapSearchUrl('九龍佐敦寶靈街6號佐敦中心7樓全層'),
    routeMapUrl: 'https://www.edenclinic.hk/佐敦街景路線圖/',
  },
  {
    id: 'tsuenwan',
    nameZh: '荃灣',
    nameEn: 'Tsuen Wan',
    address: '荃灣富麗花園商場A座地下20號舖',
    phones: ['2698 5422', '6097 7363'],
    whatsappUrl: 'https://wa.me/+85260977363',
    hoursText: '週一、二、四至日 10:30-14:00，15:30-19:00；週三及公眾假期休息',
    googleMapUrl: buildGoogleMapSearchUrl('荃灣富麗花園商場A座地下20號舖'),
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
  { id: 'chan', nameZh: '陳家富醫師', nameEn: 'Dr. Chan', bookingUrl: 'https://edentcm.as.me/DrCHAN' },
  { id: 'lee', nameZh: '李芊霖醫師', nameEn: 'Dr. Lee', bookingUrl: 'https://edentcm.as.me/DrLEE' },
  { id: 'hon', nameZh: '韓曉恩醫師', nameEn: 'Dr. Hon', bookingUrl: 'https://edentcm.as.me/DrHon' },
  { id: 'chau', nameZh: '周德健醫師', nameEn: 'Dr. Chau', bookingUrl: 'https://edentcm.as.me/DrChau' },
  { id: 'cheung', nameZh: '張天慧醫師', nameEn: 'Dr. Cheung', bookingNote: '視像診症服務，暫停開放預約，請聯絡診所姑娘查詢。' },
  { id: 'leung', nameZh: '梁仲威醫師', nameEn: 'Dr. Leung' },
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
      return `${clinic.nameZh}診所 WhatsApp: ${clinic.whatsappUrl}`;
    })
    .filter((value): value is string => Boolean(value));
}

export function getPromptClinicInfoLines(): string[] {
  return PHYSICAL_CLINIC_IDS.map((clinicId) => {
    const clinic = CLINIC_BY_ID[clinicId];
    const phones = clinic.phones.join(', ');
    const mapInfo = clinic.googleMapUrl ? ` | Google地圖：${clinic.googleMapUrl}` : '';
    return `${clinic.nameZh}診所：地址：${clinic.address} | 電話：${phones} | ${clinic.hoursText}${mapInfo}`;
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
