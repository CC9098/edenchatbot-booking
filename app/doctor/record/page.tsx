"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CantoneseVoiceNoteTool, type VoiceNotePatient } from "@/components/doctor/CantoneseVoiceNoteTool";

const CONSTITUTION_LABELS: Record<string, string> = {
  depleting: "虛耗型",
  crossing: "交錯型",
  hoarding: "屯積型",
  mixed: "混合",
  unknown: "未評估",
};

const CONSTITUTION_COLORS: Record<string, string> = {
  depleting: "bg-emerald-100 text-emerald-800",
  crossing: "bg-blue-100 text-blue-800",
  hoarding: "bg-purple-100 text-purple-800",
  mixed: "bg-orange-100 text-orange-800",
  unknown: "bg-gray-100 text-gray-600",
};

export default function DoctorRecordPage() {
  const [patients, setPatients] = useState<VoiceNotePatient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [patientsError, setPatientsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedPatientUserId, setSelectedPatientUserId] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchPatients = useCallback(async (searchText: string) => {
    setLoadingPatients(true);
    setPatientsError(null);
    try {
      const params = new URLSearchParams();
      if (searchText.trim()) params.set("q", searchText.trim());
      params.set("limit", "50");

      const response = await fetch(`/api/doctor/patients?${params.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      const nextPatients = Array.isArray(payload.items) ? (payload.items as VoiceNotePatient[]) : [];
      setPatients(nextPatients);
    } catch (error) {
      setPatientsError(error instanceof Error ? error.message : "病人名單載入失敗");
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  useEffect(() => {
    void fetchPatients(debouncedQuery);
  }, [debouncedQuery, fetchPatients]);

  useEffect(() => {
    if (!selectedPatientUserId) return;
    const stillExists = patients.some((patient) => patient.patientUserId === selectedPatientUserId);
    if (!stillExists) {
      setSelectedPatientUserId("");
    }
  }, [patients, selectedPatientUserId]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.patientUserId === selectedPatientUserId) || null,
    [patients, selectedPatientUserId]
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">語音病歷記錄</h1>
        <p className="mt-1 text-sm text-gray-600">
          可直接錄音；若先勾選病人，分析後可一鍵寫入該病人記錄。
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">選取病人</h2>
            <p className="mt-1 text-sm text-gray-600">
              這一步可選。若選了病人，語音摘要可直接寫入該病人症狀記錄。
            </p>
          </div>
          {selectedPatient ? (
            <button
              type="button"
              onClick={() => setSelectedPatientUserId("")}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              清除選擇
            </button>
          ) : null}
        </div>

        <div className="mt-4">
          <label htmlFor="record-patient-search" className="mb-1 block text-xs font-medium text-gray-600">
            搜尋病人姓名或電話
          </label>
          <input
            id="record-patient-search"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例如：陳大文 / 9123 4567"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {loadingPatients ? (
          <div className="mt-4 flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : patientsError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3">
            <p className="text-sm text-red-700">{patientsError}</p>
            <button
              type="button"
              onClick={() => void fetchPatients(debouncedQuery)}
              className="mt-2 rounded-md bg-red-100 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-200"
            >
              重試
            </button>
          </div>
        ) : patients.length === 0 ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-6 text-sm text-gray-600">
            找不到符合病人。
          </div>
        ) : (
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
            {patients.map((patient) => {
              const isSelected = patient.patientUserId === selectedPatientUserId;
              const constitutionLabel = CONSTITUTION_LABELS[patient.constitution] || CONSTITUTION_LABELS.unknown;
              const constitutionColor = CONSTITUTION_COLORS[patient.constitution] || CONSTITUTION_COLORS.unknown;

              return (
                <button
                  key={patient.patientUserId}
                  type="button"
                  onClick={() => setSelectedPatientUserId(patient.patientUserId)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? "border-primary/50 bg-primary/[0.06]"
                      : "border-gray-200 bg-white hover:border-primary/30 hover:bg-primary/[0.03]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {patient.displayName || "未設定姓名"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-600">電話：{patient.phone || "--"}</p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${constitutionColor}`}>
                      {constitutionLabel}
                    </span>
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded border text-xs ${
                        isSelected
                          ? "border-primary bg-primary text-white"
                          : "border-gray-300 bg-white text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedPatient ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            已選擇病人：{selectedPatient.displayName || "未設定姓名"}（{selectedPatient.phone || "--"}）
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            未勾選病人：你仍可開始錄音；之後可先複製摘要再自行貼上。
          </div>
        )}
      </section>

      <CantoneseVoiceNoteTool selectedPatient={selectedPatient} />
    </div>
  );
}
