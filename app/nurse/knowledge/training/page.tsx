import fs from "node:fs/promises";
import path from "node:path";

import Link from "next/link";
import { ArrowLeft, PlayCircle } from "lucide-react";

import MarkdownContent from "@/components/content/MarkdownContent";

export const dynamic = "force-dynamic";

const TRAINING_DOC_PATH = path.join(
  process.cwd(),
  "docs",
  "training",
  "staff-knowledge-onboarding-level-tests-2026-05-09.md",
);

export default async function NurseKnowledgeTrainingPage() {
  const content = await fs.readFile(TRAINING_DOC_PATH, "utf8");

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-emerald-100 bg-white p-5 shadow-sm">
        <Link
          href="/nurse/knowledge"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
        >
          <ArrowLeft className="h-4 w-4" />
          返回知識庫
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">姑娘知識庫訓練</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">
              兼職姑娘 Level Test
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              先看訓練影片，再按 Level 0-5 完成測試。
            </p>
          </div>
          <a
            href="/staff-training/staff-knowledge-onboarding.mp4"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            <PlayCircle className="h-4 w-4" />
            開啟訓練影片
          </a>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-emerald-100 bg-slate-950 shadow-sm">
        <video
          className="aspect-video w-full bg-slate-950"
          controls
          preload="metadata"
          poster="/staff-training/staff-knowledge-onboarding-frame.png"
        >
          <source src="/staff-training/staff-knowledge-onboarding.mp4" type="video/mp4" />
          你的瀏覽器未能播放此影片。
        </video>
      </section>

      <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <MarkdownContent content={content} className="max-w-none" />
      </article>
    </div>
  );
}
