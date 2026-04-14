'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useState } from 'react';
import { Loader2, Search, UserRound } from 'lucide-react';

import { BookingTabFlow } from '@/components/booking/BookingTabFlow';
import type { BookableDoctorSchedule } from '@/shared/bookable-schedule-data';

interface PatientSearchItem {
  patientUserId: string;
  displayName: string | null;
  phone: string | null;
  entryType?: 'patient' | 'staff';
  isSelf?: boolean;
}

interface PatientIdentity {
  displayName: string | null;
  phone: string | null;
  email: string | null;
}

const MIN_SEARCH_QUERY_LENGTH = 2;

export function StaffAssistedBookingConsole({
  doctors,
}: {
  doctors: BookableDoctorSchedule[];
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery.trim());
  const [results, setResults] = useState<PatientSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedPatientIdentity, setSelectedPatientIdentity] = useState<PatientIdentity | null>(null);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState('');

  useEffect(() => {
    if (deferredQuery.length < MIN_SEARCH_QUERY_LENGTH) {
      setResults([]);
      setSearchLoading(false);
      setSearchError('');
      return;
    }

    let cancelled = false;

    async function searchPatients() {
      setSearchLoading(true);
      setSearchError('');

      try {
        const response = await fetch(
          `/api/doctor/patients?q=${encodeURIComponent(deferredQuery)}&limit=8`,
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || `HTTP ${response.status}`);
        }

        if (cancelled) return;
        const nextItems = Array.isArray(payload.items)
          ? (payload.items as PatientSearchItem[]).filter(
              (item) => item.entryType !== 'staff' && item.isSelf !== true,
            )
          : [];
        setResults(nextItems);
      } catch (error) {
        if (cancelled) return;
        setResults([]);
        setSearchError(error instanceof Error ? error.message : '病人搜尋失敗');
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }

    void searchPatients();

    return () => {
      cancelled = true;
    };
  }, [deferredQuery]);

  async function handleSelectPatient(item: PatientSearchItem) {
    setPatientLoading(true);
    setPatientError('');

    try {
      const response = await fetch(`/api/doctor/patients/${item.patientUserId}/profile`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const nextIdentity = payload.patientIdentity as PatientIdentity | undefined;
      setSelectedPatientId(item.patientUserId);
      setSelectedPatientIdentity(
        nextIdentity || {
          displayName: item.displayName,
          phone: item.phone,
          email: null,
        },
      );
      setSearchQuery('');
      setResults([]);
    } catch (error) {
      setPatientError(error instanceof Error ? error.message : '載入病人資料失敗');
    } finally {
      setPatientLoading(false);
    }
  }

  function clearSelectedPatient() {
    setSelectedPatientId('');
    setSelectedPatientIdentity(null);
    setPatientError('');
    setSearchQuery('');
    setResults([]);
  }

  const bookingFlowKey = selectedPatientId || 'manual-staff-booking';

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary/15 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900">姑娘代約</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              呢頁專俾姑娘或前台代病人落單。可先搜尋現有病人帶入聯絡資料，或者直接手動輸入資料；建立預約後，
              系統會優先發送 WhatsApp 確認，若病人有電郵則會再寄確認電郵。
            </p>
          </div>

          <Link
            href="/doctor"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-primary/30 hover:text-primary"
          >
            返回病人列表
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">先搜尋病人（可選）</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="輸入姓名或電話，揀已有病人自動帶入資料"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-primary"
                />
              </div>
            </label>

            <p className="text-xs leading-5 text-slate-500">
              如現場病人未建立帳戶，亦可以直接用下方表單手動輸入資料完成代約。之後如要綁定病人帳戶，可到
              {' '}
              <Link href="/doctor" className="font-medium text-primary underline-offset-2 hover:underline">
                病人列表
              </Link>
              {' '}
              新增病人。
            </p>

            {searchLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在搜尋病人...
              </div>
            ) : null}

            {searchError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {searchError}
              </div>
            ) : null}

            {!searchLoading && deferredQuery.length >= MIN_SEARCH_QUERY_LENGTH && results.length === 0 && !searchError ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                搵唔到相符病人，你可以直接喺下方手動輸入病人資料代約。
              </div>
            ) : null}

            {!searchLoading && results.length > 0 ? (
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                {results.map((item) => (
                  <button
                    key={item.patientUserId}
                    type="button"
                    onClick={() => void handleSelectPatient(item)}
                    className="flex w-full items-start justify-between rounded-xl border border-transparent bg-white px-4 py-3 text-left transition hover:border-primary/20 hover:bg-primary-light/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {item.displayName || '未命名病人'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.phone || '未有電話資料'}
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 text-xs font-medium text-primary">帶入資料</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">今次代約對象</p>
                <p className="text-xs text-slate-500">揀咗病人就會連結到病人檔案；否則只會按表單資料代約。</p>
              </div>
            </div>

            {patientLoading ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在載入病人資料...
              </div>
            ) : selectedPatientId && selectedPatientIdentity ? (
              <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    {selectedPatientIdentity.displayName || '未命名病人'}
                  </p>
                  <p className="mt-1 text-xs text-emerald-800/80">
                    已連結病人檔案，今次預約會寫入該病人資料。
                  </p>
                </div>
                <dl className="space-y-2 text-sm text-emerald-900">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-emerald-800/80">電話</dt>
                    <dd className="text-right">{selectedPatientIdentity.phone || '未提供'}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-emerald-800/80">電郵</dt>
                    <dd className="text-right break-all">{selectedPatientIdentity.email || '未提供'}</dd>
                  </div>
                </dl>
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/doctor/patients/${selectedPatientId}`}
                    className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    打開病人詳情
                  </Link>
                  <button
                    type="button"
                    onClick={clearSelectedPatient}
                    className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 transition hover:bg-emerald-100"
                  >
                    改用手動輸入
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm leading-6 text-slate-600">
                目前未連結病人檔案。你仍可直接代約，系統會用下方表單的電話作 WhatsApp 確認及之後的管理入口依據。
              </div>
            )}

            {patientError ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {patientError}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <BookingTabFlow
        key={bookingFlowKey}
        doctors={doctors}
        initialContact={selectedPatientIdentity}
        staffPatientUserId={selectedPatientId || null}
        flowVariant="staff"
      />
    </div>
  );
}
