"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";

/* ================================================================
   Types
   ================================================================ */

interface CareProfile {
  patientUserId: string;
  constitution: string;
  constitutionNote: string | null;
  lastVisitAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

interface CareInstruction {
  id: string;
  instructionType: string;
  title: string;
  contentMd: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FollowUp {
  id: string;
  suggestedDate: string;
  reason: string | null;
  status: string;
  linkedBookingId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PatientProfile {
  careProfile: CareProfile | null;
  activeInstructions: CareInstruction[];
  pendingFollowUps: FollowUp[];
}

/* ================================================================
   Constants / helpers
   ================================================================ */

const CONSTITUTION_OPTIONS = [
  { value: "depleting", label: "虛損", color: "bg-emerald-100 text-emerald-800" },
  { value: "crossing", label: "鬱結", color: "bg-blue-100 text-blue-800" },
  { value: "hoarding", label: "痰濕", color: "bg-purple-100 text-purple-800" },
  { value: "mixed", label: "混合", color: "bg-orange-100 text-orange-800" },
  { value: "unknown", label: "未評估", color: "bg-gray-100 text-gray-600" },
];

const INSTRUCTION_TYPE_OPTIONS = [
  { value: "diet_avoid", label: "紅色避口", color: "bg-red-100 text-red-800" },
  { value: "diet_recommend", label: "綠色推薦", color: "bg-green-100 text-green-800" },
  { value: "lifestyle", label: "生活建議", color: "bg-sky-100 text-sky-800" },
  { value: "warning", label: "警告", color: "bg-amber-100 text-amber-800" },
  { value: "medication_note", label: "藥物備註", color: "bg-violet-100 text-violet-800" },
];

const INSTRUCTION_STATUS_OPTIONS = [
  { value: "active", label: "生效中" },
  { value: "paused", label: "暫停" },
  { value: "done", label: "完成" },
];

const FOLLOW_UP_STATUS_OPTIONS = [
  { value: "pending", label: "待覆診", color: "bg-amber-100 text-amber-800" },
  { value: "booked", label: "已預約", color: "bg-blue-100 text-blue-800" },
  { value: "done", label: "已完成", color: "bg-green-100 text-green-800" },
  { value: "overdue", label: "逾期", color: "bg-red-100 text-red-800" },
  { value: "cancelled", label: "已取消", color: "bg-gray-100 text-gray-600" },
];

function constitutionBadge(value: string) {
  const opt = CONSTITUTION_OPTIONS.find((o) => o.value === value) || CONSTITUTION_OPTIONS[4];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${opt.color}`}>
      {opt.label}
    </span>
  );
}

function instructionTypeBadge(value: string) {
  const opt = INSTRUCTION_TYPE_OPTIONS.find((o) => o.value === value);
  if (!opt) return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">{value}</span>;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${opt.color}`}>
      {opt.label}
    </span>
  );
}

function followUpStatusBadge(value: string) {
  const opt = FOLLOW_UP_STATUS_OPTIONS.find((o) => o.value === value);
  if (!opt) return <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">{value}</span>;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${opt.color}`}>
      {opt.label}
    </span>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ================================================================
   Modal wrapper
   ================================================================ */

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4 rounded-t-xl">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ================================================================
   Main page component
   ================================================================ */

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const patientUserId = params.patientUserId as string;

  const [data, setData] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---------- Fetch ---------- */
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor/patients/${patientUserId}/profile`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json: PatientProfile = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [patientUserId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  /* ---------- Loading / Error states ---------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2d5016] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-10 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <button
          onClick={fetchProfile}
          className="mt-3 rounded-md bg-red-100 px-4 py-1.5 text-sm font-medium text-red-800 hover:bg-red-200"
        >
          重試
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={() => router.push("/doctor")}
        className="inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-[#2d5016]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        返回病人列表
      </button>

      {/* Section A: Constitution */}
      <ConstitutionSection
        patientUserId={patientUserId}
        careProfile={data.careProfile}
        onUpdated={fetchProfile}
      />

      {/* Section B: Care Instructions */}
      <InstructionsSection
        patientUserId={patientUserId}
        instructions={data.activeInstructions}
        onUpdated={fetchProfile}
      />

      {/* Section C: Follow-up Plans */}
      <FollowUpsSection
        patientUserId={patientUserId}
        followUps={data.pendingFollowUps}
        onUpdated={fetchProfile}
      />
    </div>
  );
}

/* ================================================================
   Section A: Constitution
   ================================================================ */

function ConstitutionSection({
  patientUserId,
  careProfile,
  onUpdated,
}: {
  patientUserId: string;
  careProfile: CareProfile | null;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [constitution, setConstitution] = useState(careProfile?.constitution || "unknown");
  const [note, setNote] = useState(careProfile?.constitutionNote || "");
  const [formError, setFormError] = useState<string | null>(null);

  function openEdit() {
    setConstitution(careProfile?.constitution || "unknown");
    setNote(careProfile?.constitutionNote || "");
    setFormError(null);
    setEditing(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/doctor/patients/${patientUserId}/constitution`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constitution, constitutionNote: note || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "儲存失敗");
      }
      setEditing(false);
      onUpdated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">體質評估</h2>
        <button
          onClick={openEdit}
          className="rounded-md bg-[#2d5016]/10 px-3 py-1.5 text-xs font-medium text-[#2d5016] transition-colors hover:bg-[#2d5016]/20"
        >
          編輯
        </button>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">體質分型:</span>
          {constitutionBadge(careProfile?.constitution || "unknown")}
        </div>
        {careProfile?.constitutionNote && (
          <div>
            <span className="text-sm text-gray-500">備註:</span>
            <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
              {careProfile.constitutionNote}
            </p>
          </div>
        )}
        {careProfile?.updatedAt && (
          <p className="text-xs text-gray-400">
            最後更新: {formatDate(careProfile.updatedAt)}
          </p>
        )}
        {!careProfile && (
          <p className="text-sm text-gray-400">尚未建立體質評估記錄</p>
        )}
      </div>

      {/* Edit modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title="編輯體質評估">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">體質分型</label>
            <select
              value={constitution}
              onChange={(e) => setConstitution(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
            >
              {CONSTITUTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
              placeholder="輸入體質備註..."
            />
          </div>
          {formError && (
            <p className="text-sm text-red-600">{formError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#2d5016] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d6b20] disabled:opacity-50"
            >
              {saving ? "儲存中..." : "儲存"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

/* ================================================================
   Section B: Care Instructions
   ================================================================ */

function InstructionsSection({
  patientUserId,
  instructions,
  onUpdated,
}: {
  patientUserId: string;
  instructions: CareInstruction[];
  onUpdated: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<CareInstruction | null>(null);

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">護理指引</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-md bg-[#2d5016] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#3d6b20]"
        >
          + 新增指引
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {instructions.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-400">暫無護理指引</p>
          </div>
        ) : (
          instructions.map((instr) => (
            <div key={instr.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {instructionTypeBadge(instr.instructionType)}
                    <span className="text-sm font-medium text-gray-900">{instr.title}</span>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3">
                    {instr.contentMd}
                  </p>
                  <p className="text-xs text-gray-400">
                    {instr.startDate && `${formatDate(instr.startDate)}`}
                    {instr.startDate && instr.endDate && " ~ "}
                    {instr.endDate && `${formatDate(instr.endDate)}`}
                    {!instr.startDate && !instr.endDate && `建立: ${formatDate(instr.createdAt)}`}
                  </p>
                </div>
                <button
                  onClick={() => setEditTarget(instr)}
                  className="shrink-0 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
                >
                  編輯
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add instruction modal */}
      <AddInstructionModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        patientUserId={patientUserId}
        onCreated={() => { setShowAdd(false); onUpdated(); }}
      />

      {/* Edit instruction modal */}
      {editTarget && (
        <EditInstructionModal
          open={true}
          onClose={() => setEditTarget(null)}
          instruction={editTarget}
          onSaved={() => { setEditTarget(null); onUpdated(); }}
        />
      )}
    </section>
  );
}

function AddInstructionModal({
  open,
  onClose,
  patientUserId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  patientUserId: string;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [instructionType, setInstructionType] = useState("diet_avoid");
  const [title, setTitle] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState("");

  // Reset form on open
  useEffect(() => {
    if (open) {
      setInstructionType("diet_avoid");
      setTitle("");
      setContentMd("");
      setStartDate(todayStr());
      setEndDate("");
      setFormError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !contentMd.trim()) {
      setFormError("標題和內容為必填");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        instructionType,
        title: title.trim(),
        contentMd: contentMd.trim(),
      };
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;

      const res = await fetch(`/api/doctor/patients/${patientUserId}/instructions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "建立失敗");
      }
      onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="新增護理指引">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">指引類型</label>
          <select
            value={instructionType}
            onChange={(e) => setInstructionType(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
          >
            {INSTRUCTION_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">標題 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
            placeholder="例: 忌食辛辣"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">內容 *</label>
          <textarea
            value={contentMd}
            onChange={(e) => setContentMd(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
            placeholder="詳細描述..."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
            />
          </div>
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#2d5016] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d6b20] disabled:opacity-50"
          >
            {saving ? "建立中..." : "建立"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditInstructionModal({
  open,
  onClose,
  instruction,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  instruction: CareInstruction;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState(instruction.title);
  const [contentMd, setContentMd] = useState(instruction.contentMd);
  const [status, setStatus] = useState(instruction.status);
  const [startDate, setStartDate] = useState(instruction.startDate || "");
  const [endDate, setEndDate] = useState(instruction.endDate || "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !contentMd.trim()) {
      setFormError("標題和內容為必填");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        contentMd: contentMd.trim(),
        status,
      };
      if (startDate) body.startDate = startDate;
      else body.startDate = null;
      if (endDate) body.endDate = endDate;
      else body.endDate = null;

      const res = await fetch(`/api/doctor/instructions/${instruction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "儲存失敗");
      }
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="編輯護理指引">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">類型</label>
          <div className="py-1">{instructionTypeBadge(instruction.instructionType)}</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
          >
            {INSTRUCTION_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">標題 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">內容 *</label>
          <textarea
            value={contentMd}
            onChange={(e) => setContentMd(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
            />
          </div>
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#2d5016] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d6b20] disabled:opacity-50"
          >
            {saving ? "儲存中..." : "儲存"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ================================================================
   Section C: Follow-up Plans
   ================================================================ */

function FollowUpsSection({
  patientUserId,
  followUps,
  onUpdated,
}: {
  patientUserId: string;
  followUps: FollowUp[];
  onUpdated: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<FollowUp | null>(null);

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">覆診計劃</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-md bg-[#2d5016] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#3d6b20]"
        >
          + 新增覆診
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {followUps.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-400">暫無覆診計劃</p>
          </div>
        ) : (
          followUps.map((fu) => (
            <div key={fu.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {followUpStatusBadge(fu.status)}
                    <span className="text-sm font-medium text-gray-900">
                      {formatDate(fu.suggestedDate)}
                    </span>
                  </div>
                  {fu.reason && (
                    <p className="text-sm text-gray-600">{fu.reason}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    建立: {formatDate(fu.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setEditTarget(fu)}
                  className="shrink-0 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
                >
                  編輯
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add follow-up modal */}
      <AddFollowUpModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        patientUserId={patientUserId}
        onCreated={() => { setShowAdd(false); onUpdated(); }}
      />

      {/* Edit follow-up modal */}
      {editTarget && (
        <EditFollowUpModal
          open={true}
          onClose={() => setEditTarget(null)}
          followUp={editTarget}
          onSaved={() => { setEditTarget(null); onUpdated(); }}
        />
      )}
    </section>
  );
}

function AddFollowUpModal({
  open,
  onClose,
  patientUserId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  patientUserId: string;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [suggestedDate, setSuggestedDate] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setSuggestedDate("");
      setReason("");
      setFormError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!suggestedDate) {
      setFormError("建議日期為必填");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = { suggestedDate };
      if (reason.trim()) body.reason = reason.trim();

      const res = await fetch(`/api/doctor/patients/${patientUserId}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "建立失敗");
      }
      onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="新增覆診計劃">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">建議覆診日期 *</label>
          <input
            type="date"
            value={suggestedDate}
            onChange={(e) => setSuggestedDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">原因</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
            placeholder="例: 療程第二次覆診..."
          />
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#2d5016] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d6b20] disabled:opacity-50"
          >
            {saving ? "建立中..." : "建立"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditFollowUpModal({
  open,
  onClose,
  followUp,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  followUp: FollowUp;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState(followUp.status);
  const [suggestedDate, setSuggestedDate] = useState(followUp.suggestedDate);
  const [reason, setReason] = useState(followUp.reason || "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!suggestedDate) {
      setFormError("建議日期為必填");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        status,
        suggestedDate,
      };
      if (reason.trim()) body.reason = reason.trim();
      else body.reason = "";

      const res = await fetch(`/api/doctor/follow-ups/${followUp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "儲存失敗");
      }
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="編輯覆診計劃">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
          >
            {FOLLOW_UP_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">建議覆診日期 *</label>
          <input
            type="date"
            value={suggestedDate}
            onChange={(e) => setSuggestedDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">原因</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#2d5016] focus:outline-none focus:ring-1 focus:ring-[#2d5016]"
          />
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#2d5016] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#3d6b20] disabled:opacity-50"
          >
            {saving ? "儲存中..." : "儲存"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
