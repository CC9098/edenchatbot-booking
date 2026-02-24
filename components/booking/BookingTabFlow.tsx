'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Loader2, UserRound } from 'lucide-react';
import { CALENDAR_MAPPINGS } from '@/shared/schedule-config';
import { CLINICS, DOCTORS, type ClinicId, type DoctorId } from '@/shared/clinic-data';

type BookingStep = 'setup' | 'timeslot' | 'details' | 'success';
type VisitType = 'first' | 'followup';
type ReceiptType = 'no' | 'yes_insurance' | 'yes_not_insurance';
type PickupType = 'none' | 'lalamove' | 'sfexpress' | 'clinic_pickup';
type GenderType = '' | 'male' | 'female' | 'other';

type BookingFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  needReceipt: ReceiptType;
  medicationPickup: PickupType;
  idCard: string;
  dateOfBirth: string;
  gender: GenderType;
  allergies: string;
  medications: string;
  symptoms: string;
  referralSource: string;
};

type BookingFormErrors = Partial<Record<keyof BookingFormValues, string>>;

const HONG_KONG_TIMEZONE = 'Asia/Hong_Kong';
const SLOT_INTERVAL_MINUTES = 15;
const MAX_BOOKING_WINDOW_DAYS = 90;

const PICKUP_LABELS: Record<PickupType, string> = {
  none: '不需要 None',
  lalamove: 'Lalamove',
  sfexpress: '順豐 SF Express',
  clinic_pickup: '診所自取 Clinic Pickup',
};

const INITIAL_FORM_VALUES: BookingFormValues = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  needReceipt: 'no',
  medicationPickup: 'none',
  idCard: '',
  dateOfBirth: '',
  gender: '',
  allergies: '',
  medications: '',
  symptoms: '',
  referralSource: '',
};

function hasBookableSchedule(mapping: (typeof CALENDAR_MAPPINGS)[number]): boolean {
  return Object.values(mapping.schedule).some(
    (ranges) => Array.isArray(ranges) && ranges.length > 0
  );
}

const ACTIVE_BOOKABLE_MAPPINGS = CALENDAR_MAPPINGS.filter(
  (mapping) => mapping.isActive && hasBookableSchedule(mapping)
);
const BOOKABLE_DOCTOR_IDS = new Set<DoctorId>(
  ACTIVE_BOOKABLE_MAPPINGS.map((mapping) => mapping.doctorId)
);

function toIsoDateInHongKong(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HONG_KONG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getTodayIsoInHongKong(): string {
  return toIsoDateInHongKong(new Date());
}

function getMaxDateIsoInHongKong(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return toIsoDateInHongKong(date);
}

function formatDateForDisplay(dateIso: string): string {
  if (!dateIso) return '';

  const date = new Date(`${dateIso}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return dateIso;

  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: HONG_KONG_TIMEZONE,
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

export function BookingTabFlow() {
  const [step, setStep] = useState<BookingStep>('setup');
  const [visitType, setVisitType] = useState<VisitType>('first');
  const [doctorId, setDoctorId] = useState<DoctorId | ''>('');
  const [clinicId, setClinicId] = useState<ClinicId | ''>('');

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState('');

  const [formValues, setFormValues] = useState<BookingFormValues>(INITIAL_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<BookingFormErrors>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [bookingId, setBookingId] = useState('');

  const minDate = getTodayIsoInHongKong();
  const maxDate = getMaxDateIsoInHongKong(MAX_BOOKING_WINDOW_DAYS);

  const doctorOptions = useMemo(
    () => DOCTORS.filter((doctor) => BOOKABLE_DOCTOR_IDS.has(doctor.id)),
    []
  );

  const clinicOptions = useMemo(() => {
    if (!doctorId) return [];

    const clinicIds = new Set<ClinicId>();
    for (const mapping of ACTIVE_BOOKABLE_MAPPINGS) {
      if (mapping.doctorId === doctorId) {
        clinicIds.add(mapping.clinicId);
      }
    }

    return CLINICS.filter((clinic) => clinicIds.has(clinic.id));
  }, [doctorId]);

  const selectedDoctor = useMemo(
    () => DOCTORS.find((doctor) => doctor.id === doctorId),
    [doctorId]
  );

  const selectedClinic = useMemo(
    () => CLINICS.find((clinic) => clinic.id === clinicId),
    [clinicId]
  );

  const canContinueSetup = Boolean(doctorId && clinicId && visitType);
  const canContinueTimeslot = Boolean(selectedDate && selectedTime);

  function resetSlotState() {
    setSelectedDate('');
    setSelectedTime('');
    setAvailableSlots([]);
    setSlotsLoading(false);
    setSlotError('');
  }

  function resetSubmissionState() {
    setSubmitError('');
    setIsSubmitting(false);
    setBookingId('');
  }

  function handleDoctorChange(nextDoctorId: string) {
    setDoctorId(nextDoctorId as DoctorId);
    setClinicId('');
    setStep('setup');
    resetSlotState();
    resetSubmissionState();
  }

  function handleClinicChange(nextClinicId: string) {
    setClinicId(nextClinicId as ClinicId);
    setStep('setup');
    resetSlotState();
    resetSubmissionState();
  }

  function handleVisitTypeChange(nextVisitType: VisitType) {
    setVisitType(nextVisitType);
    setStep('setup');
    setFormErrors({});
    setSubmitError('');
  }

  async function fetchAvailability(dateIso: string) {
    if (!doctorId || !clinicId) return;

    setSlotsLoading(true);
    setSlotError('');
    setAvailableSlots([]);
    setSelectedTime('');

    try {
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doctorId,
          clinicId,
          date: dateIso,
          durationMinutes: SLOT_INTERVAL_MINUTES,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data?.errorCode === 'CALENDAR_UNAVAILABLE') {
          setSlotError('暫時未能連接預約日曆，請稍後再試或在聊天頁由姑娘協助安排。');
          return;
        }

        setSlotError(data?.error || '暫時未能讀取可預約時段，請稍後再試。');
        return;
      }

      const slots = Array.isArray(data?.slots) ? data.slots : [];
      const isClosedDay = Boolean(data?.isClosed || data?.isHoliday);

      setAvailableSlots(slots);

      if (isClosedDay) {
        setSlotError('當日休診或公眾假期，請選擇其他日期。');
        return;
      }

      if (slots.length === 0) {
        setSlotError('當日暫無可預約時段。');
      }
    } catch {
      setSlotError('載入時段失敗，請稍後再試。');
    } finally {
      setSlotsLoading(false);
    }
  }

  function handleDateChange(dateIso: string) {
    setSelectedDate(dateIso);
    void fetchAvailability(dateIso);
  }

  function updateFormField<Key extends keyof BookingFormValues>(
    key: Key,
    value: BookingFormValues[Key]
  ) {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }));

    if (formErrors[key]) {
      setFormErrors((prev) => ({
        ...prev,
        [key]: undefined,
      }));
    }
  }

  function validateForm(values: BookingFormValues): BookingFormErrors {
    const nextErrors: BookingFormErrors = {};

    if (!values.firstName.trim()) {
      nextErrors.firstName = '請輸入名字';
    }

    if (!values.lastName.trim()) {
      nextErrors.lastName = '請輸入姓氏';
    }

    const normalizedPhone = values.phone.replace(/\s+/g, '');
    if (!/^[0-9]{8,}$/.test(normalizedPhone)) {
      nextErrors.phone = '請輸入有效電話（至少 8 位數字）';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      nextErrors.email = '請輸入有效電郵地址';
    }

    if (visitType === 'first') {
      if (values.idCard.trim().length < 5) {
        nextErrors.idCard = '首診需要身份證資料';
      }

      if (!values.dateOfBirth.trim()) {
        nextErrors.dateOfBirth = '首診需要出生日期';
      }

      if (!values.gender) {
        nextErrors.gender = '首診需要性別資料';
      }

      if (!values.allergies.trim()) {
        nextErrors.allergies = '首診需要過敏史資料';
      }

      if (!values.medications.trim()) {
        nextErrors.medications = '首診需要現正服用藥物資料';
      }

      if (!values.symptoms.trim()) {
        nextErrors.symptoms = '首診需要主要症狀資料';
      }

      if (!values.referralSource.trim()) {
        nextErrors.referralSource = '首診需要得知來源資料';
      }
    }

    return nextErrors;
  }

  function buildBookingNotes(values: BookingFormValues): string {
    if (visitType === 'first') {
      return [
        '[首診]',
        `ID: ${values.idCard.trim() || 'N/A'}`,
        `DOB: ${values.dateOfBirth.trim() || 'N/A'}`,
        `Gender: ${values.gender || 'N/A'}`,
        `Allergies: ${values.allergies.trim() || 'None'}`,
        `Medications: ${values.medications.trim() || 'None'}`,
        `Symptoms: ${values.symptoms.trim() || 'N/A'}`,
        `Referral: ${values.referralSource.trim() || 'N/A'}`,
        `Receipt: ${values.needReceipt}`,
        `取藥方法: ${PICKUP_LABELS[values.medicationPickup]}`,
      ].join(' | ');
    }

    return [
      '[覆診]',
      `Receipt: ${values.needReceipt}`,
      `取藥方法: ${PICKUP_LABELS[values.medicationPickup]}`,
    ].join(' | ');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDoctor || !selectedClinic || !doctorId || !clinicId) {
      setSubmitError('請先選擇醫師與診所。');
      setStep('setup');
      return;
    }

    if (!selectedDate || !selectedTime) {
      setSubmitError('請先選擇日期與時間。');
      setStep('timeslot');
      return;
    }

    const validationErrors = validateForm(formValues);
    setFormErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setSubmitError('資料未填完整，請檢查必填欄位。');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    const payload = {
      doctorId,
      clinicId,
      doctorName: selectedDoctor.nameEn,
      doctorNameZh: selectedDoctor.nameZh,
      clinicName: selectedClinic.nameEn,
      clinicNameZh: selectedClinic.nameZh,
      date: selectedDate,
      time: selectedTime,
      durationMinutes: SLOT_INTERVAL_MINUTES,
      patientName: `${formValues.lastName.trim()} ${formValues.firstName.trim()}`,
      phone: formValues.phone.trim(),
      email: formValues.email.trim(),
      notes: buildBookingNotes(formValues),
    };

    try {
      const response = await fetch('/api/booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        setSubmitError(data?.error || '預約失敗，請稍後再試。');
        return;
      }

      setBookingId(data.bookingId || '');
      setStep('success');
    } catch {
      setSubmitError('預約時發生錯誤，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startAnotherBooking() {
    setStep('timeslot');
    resetSlotState();
    setSubmitError('');
    setFormErrors({});
  }

  if (doctorOptions.length === 0) {
    return (
      <div className="patient-card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-primary">預約服務</h1>
        <p className="mt-3 text-sm text-slate-600">
          目前未有可用的醫師時段，請稍後再試或於聊天頁聯絡我們。
        </p>
        <Link
          href="/chat"
          className="mt-6 inline-flex items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          返回聊天頁
        </Link>
      </div>
    );
  }

  return (
    <div className="patient-card mx-auto max-w-2xl p-6 sm:p-8">
      <div className="mb-6 space-y-3">
        <p className="patient-pill inline-flex px-3 py-1 text-xs font-semibold text-primary">
          App 內預約
        </p>
        <h1 className="text-2xl font-semibold text-primary sm:text-3xl">預約服務</h1>
        <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
          預約流程已整合在手機 App 內，不需要跳到外部瀏覽器。
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-primary/15 bg-primary-light/40 p-3 text-xs font-medium text-primary sm:text-sm">
        步驟：{step === 'setup' && '1. 醫師與診所'}{step === 'timeslot' && '2. 日期與時間'}
        {step === 'details' && '3. 填寫資料'}{step === 'success' && '完成'}
      </div>

      {step === 'setup' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">選擇醫師</span>
              <select
                value={doctorId}
                onChange={(event) => handleDoctorChange(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
              >
                <option value="">請選擇醫師</option>
                {doctorOptions.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.nameZh} ({doctor.nameEn})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">選擇診所</span>
              <select
                value={clinicId}
                onChange={(event) => handleClinicChange(event.target.value)}
                disabled={!doctorId}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">{doctorId ? '請選擇診所' : '請先選擇醫師'}</option>
                {clinicOptions.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.nameZh} ({clinic.nameEn})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">診症類型</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleVisitTypeChange('first')}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  visitType === 'first'
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-primary/40'
                }`}
              >
                <p className="font-semibold">首診 First Visit</p>
                <p className="mt-1 text-xs text-slate-500">第一次到診所就診</p>
              </button>

              <button
                type="button"
                onClick={() => handleVisitTypeChange('followup')}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  visitType === 'followup'
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-primary/40'
                }`}
              >
                <p className="font-semibold">覆診 Follow-up</p>
                <p className="mt-1 text-xs text-slate-500">曾經到診所就診</p>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('timeslot')}
            disabled={!canContinueSetup}
            className="inline-flex w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一步：選擇日期與時間
          </button>
        </div>
      )}

      {step === 'timeslot' && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setStep('setup')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> 返回上一頁
          </button>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              {selectedDoctor?.nameZh} @ {selectedClinic?.nameZh}
            </p>
            <p className="mt-1">{visitType === 'first' ? '首診 First Visit' : '覆診 Follow-up Visit'}</p>
          </div>

          <label className="space-y-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CalendarDays className="h-4 w-4" />
              選擇日期
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => handleDateChange(event.target.value)}
              min={minDate}
              max={maxDate}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">可預約時段</p>

            {slotsLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                正在查詢可預約時段...
              </div>
            ) : null}

            {!slotsLoading && slotError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {slotError}
              </div>
            ) : null}

            {!slotsLoading && availableSlots.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTime(slot)}
                    className={`rounded-lg border px-2 py-2 text-sm font-semibold transition ${
                      selectedTime === slot
                        ? 'border-primary bg-primary text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-primary/50'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setStep('details')}
            disabled={!canContinueTimeslot}
            className="inline-flex w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            下一步：填寫個人資料
          </button>
        </div>
      )}

      {step === 'details' && (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setStep('timeslot')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> 返回選擇時段
          </button>

          <div className="rounded-2xl border border-primary/15 bg-primary-light/40 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              {selectedDoctor?.nameZh} @ {selectedClinic?.nameZh}
            </p>
            <p className="mt-1">
              {formatDateForDisplay(selectedDate)} {selectedTime}
            </p>
            <p className="mt-1">{visitType === 'first' ? '首診 First Visit' : '覆診 Follow-up Visit'}</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">名字 *</span>
                <input
                  value={formValues.firstName}
                  onChange={(event) => updateFormField('firstName', event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  placeholder="Tai Man"
                />
                {formErrors.firstName ? <p className="text-xs text-red-600">{formErrors.firstName}</p> : null}
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">姓氏 *</span>
                <input
                  value={formValues.lastName}
                  onChange={(event) => updateFormField('lastName', event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  placeholder="Chan"
                />
                {formErrors.lastName ? <p className="text-xs text-red-600">{formErrors.lastName}</p> : null}
              </label>
            </div>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">電話 *</span>
              <input
                value={formValues.phone}
                onChange={(event) => updateFormField('phone', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                placeholder="98765432"
              />
              {formErrors.phone ? <p className="text-xs text-red-600">{formErrors.phone}</p> : null}
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">電郵 *</span>
              <input
                value={formValues.email}
                onChange={(event) => updateFormField('email', event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                placeholder="email@example.com"
              />
              {formErrors.email ? <p className="text-xs text-red-600">{formErrors.email}</p> : null}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">收據需求 *</span>
                <select
                  value={formValues.needReceipt}
                  onChange={(event) => updateFormField('needReceipt', event.target.value as ReceiptType)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                >
                  <option value="no">不用 No</option>
                  <option value="yes_insurance">是，保險索償 Yes for insurance</option>
                  <option value="yes_not_insurance">是，但非保險 Yes not for insurance</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-slate-700">取藥方法 *</span>
                <select
                  value={formValues.medicationPickup}
                  onChange={(event) =>
                    updateFormField('medicationPickup', event.target.value as PickupType)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                >
                  <option value="none">不需要 None</option>
                  <option value="lalamove">Lalamove</option>
                  <option value="sfexpress">順豐 SF Express</option>
                  <option value="clinic_pickup">診所自取 Clinic Pickup</option>
                </select>
              </label>
            </div>

            {visitType === 'first' ? (
              <div className="space-y-4 rounded-2xl border border-red-100 bg-red-50/70 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-700">
                  <UserRound className="h-4 w-4" />
                  首診資料（必填）
                </p>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">身份證號碼 *</span>
                  <input
                    value={formValues.idCard}
                    onChange={(event) => updateFormField('idCard', event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder="例如：A123456(7)"
                  />
                  {formErrors.idCard ? <p className="text-xs text-red-600">{formErrors.idCard}</p> : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">出生日期 *</span>
                  <input
                    value={formValues.dateOfBirth}
                    onChange={(event) => updateFormField('dateOfBirth', event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder="例如：1990/01/15"
                  />
                  {formErrors.dateOfBirth ? (
                    <p className="text-xs text-red-600">{formErrors.dateOfBirth}</p>
                  ) : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">性別 *</span>
                  <select
                    value={formValues.gender}
                    onChange={(event) => updateFormField('gender', event.target.value as GenderType)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  >
                    <option value="">請選擇</option>
                    <option value="male">男 Male</option>
                    <option value="female">女 Female</option>
                    <option value="other">其他 Other</option>
                  </select>
                  {formErrors.gender ? <p className="text-xs text-red-600">{formErrors.gender}</p> : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">過敏史 *</span>
                  <textarea
                    value={formValues.allergies}
                    onChange={(event) => updateFormField('allergies', event.target.value)}
                    className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder="如沒有請填「沒有」"
                  />
                  {formErrors.allergies ? <p className="text-xs text-red-600">{formErrors.allergies}</p> : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">正服用藥物／保健品 *</span>
                  <textarea
                    value={formValues.medications}
                    onChange={(event) => updateFormField('medications', event.target.value)}
                    className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder="如沒有請填「沒有」"
                  />
                  {formErrors.medications ? (
                    <p className="text-xs text-red-600">{formErrors.medications}</p>
                  ) : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">主要症狀 *</span>
                  <textarea
                    value={formValues.symptoms}
                    onChange={(event) => updateFormField('symptoms', event.target.value)}
                    className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                    placeholder="請簡述主要問題"
                  />
                  {formErrors.symptoms ? <p className="text-xs text-red-600">{formErrors.symptoms}</p> : null}
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">得知來源 *</span>
                  <select
                    value={formValues.referralSource}
                    onChange={(event) => updateFormField('referralSource', event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  >
                    <option value="">請選擇</option>
                    <option value="google">Google 搜尋</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="friend">朋友介紹</option>
                    <option value="doctor">醫師介紹</option>
                    <option value="walk_in">路過</option>
                    <option value="other">其他</option>
                  </select>
                  {formErrors.referralSource ? (
                    <p className="text-xs text-red-600">{formErrors.referralSource}</p>
                  ) : null}
                </label>
              </div>
            ) : null}

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 sm:text-sm">
              成功預約後會收到確認電郵通知；更改或取消可使用電郵內連結。
            </div>

            {submitError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  預約處理中...
                </>
              ) : (
                '確認預約'
              )}
            </button>
          </form>
        </div>
      )}

      {step === 'success' && (
        <div className="space-y-6 text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-slate-900">預約成功</h2>
            <p className="mt-2 text-sm text-slate-600">已完成預約，確認電郵將發送到你提供的信箱。</p>
            <p className="mt-3 text-xs text-slate-400">每一次回來，身體都記得。</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-700">
            <p>
              <strong>醫師：</strong> {selectedDoctor?.nameZh}
            </p>
            <p>
              <strong>診所：</strong> {selectedClinic?.nameZh}
            </p>
            <p>
              <strong>時間：</strong> {formatDateForDisplay(selectedDate)} {selectedTime}
            </p>
            {bookingId ? (
              <p>
                <strong>預約編號：</strong> {bookingId}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={startAnotherBooking}
              className="inline-flex items-center justify-center rounded-[18px] border border-primary/20 bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary-light"
            >
              再預約一個時段
            </button>

            <Link
              href="/chat"
              className="inline-flex items-center justify-center rounded-[18px] bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              返回聊天頁
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
