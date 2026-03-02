"use client";

import { useEffect, useMemo, useState } from "react";

export interface SymptomFollowUpAnswer {
  id: string;
  symptomKey: string;
  symptomLabel: string;
  questionText: string;
  answerType: "yes_no" | "scale_0_10" | "trend" | "frequency" | "free_text";
  answerValueText: string;
  answerValueNumber: number | null;
  source: string;
  askedAt: string;
  recordedBy: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface TrendPoint {
  id: string;
  label: string;
  score: number;
  askedAt: string;
}

function formatDateLabel(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "--";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "--";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
}

export function SymptomFollowUpTrendPanel({ answers }: { answers: SymptomFollowUpAnswer[] }) {
  const scoreSeries = useMemo(() => {
    const seriesMap = new Map<string, { key: string; label: string; points: TrendPoint[] }>();

    for (const answer of answers) {
      if (answer.answerValueNumber === null || answer.answerValueNumber === undefined) continue;
      const key = `${answer.symptomKey}::${answer.symptomLabel}`;
      const existing = seriesMap.get(key) || {
        key,
        label: answer.symptomLabel || answer.symptomKey,
        points: [],
      };
      existing.points.push({
        id: answer.id,
        label: answer.symptomLabel || answer.symptomKey,
        score: answer.answerValueNumber,
        askedAt: answer.askedAt,
      });
      seriesMap.set(key, existing);
    }

    return Array.from(seriesMap.values())
      .map((series) => ({
        ...series,
        points: [...series.points].sort(
          (left, right) => new Date(left.askedAt).getTime() - new Date(right.askedAt).getTime()
        ),
      }))
      .sort((left, right) => {
        const leftLatest = left.points[left.points.length - 1]?.askedAt || "";
        const rightLatest = right.points[right.points.length - 1]?.askedAt || "";
        return new Date(rightLatest).getTime() - new Date(leftLatest).getTime();
      });
  }, [answers]);

  const [selectedSeriesKey, setSelectedSeriesKey] = useState("");

  useEffect(() => {
    if (scoreSeries.length === 0) {
      setSelectedSeriesKey("");
      return;
    }

    const stillExists = scoreSeries.some((series) => series.key === selectedSeriesKey);
    if (!stillExists) {
      setSelectedSeriesKey(scoreSeries[0].key);
    }
  }, [scoreSeries, selectedSeriesKey]);

  const selectedSeries = scoreSeries.find((series) => series.key === selectedSeriesKey) || scoreSeries[0] || null;
  const recentAnswers = answers.slice(0, 6);

  const chartModel = useMemo(() => {
    if (!selectedSeries || selectedSeries.points.length === 0) return null;

    const width = 640;
    const height = 220;
    const margin = { top: 20, right: 20, bottom: 40, left: 34 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const points = selectedSeries.points;

    const positionedPoints = points.map((point, index) => {
      const x =
        points.length === 1
          ? margin.left + plotWidth / 2
          : margin.left + (index / (points.length - 1)) * plotWidth;
      const y = margin.top + (1 - point.score / 10) * plotHeight;
      return {
        ...point,
        x,
        y,
      };
    });

    return {
      width,
      height,
      margin,
      positionedPoints,
      path: buildPath(positionedPoints),
      guideScores: [0, 5, 10],
    };
  }, [selectedSeries]);

  const latestPoint = selectedSeries?.points[selectedSeries.points.length - 1] || null;
  const previousPoint = selectedSeries && selectedSeries.points.length > 1
    ? selectedSeries.points[selectedSeries.points.length - 2]
    : null;
  const scoreDelta = latestPoint && previousPoint ? latestPoint.score - previousPoint.score : null;

  return (
    <div className="space-y-4 rounded-xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">問診跟進分數走勢</h3>
          <p className="mt-1 text-xs text-gray-600">
            由醫師問診卡寫入的結構化答案。0-10 分項目會自動進入趨勢圖。
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-cyan-900 ring-1 ring-cyan-100">
          已記錄 {answers.length} 筆
        </span>
      </div>

      {scoreSeries.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2">
            {scoreSeries.map((series) => {
              const isActive = selectedSeries?.key === series.key;
              const latestScore = series.points[series.points.length - 1]?.score;
              return (
                <button
                  key={series.key}
                  type="button"
                  onClick={() => setSelectedSeriesKey(series.key)}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-primary bg-primary text-white"
                      : "border-cyan-200 bg-white text-cyan-900 hover:bg-cyan-50"
                  }`}
                >
                  {series.label}
                  {latestScore !== undefined ? ` ${latestScore}/10` : ""}
                </button>
              );
            })}
          </div>

          {selectedSeries && chartModel ? (
            <div className="rounded-xl border border-white bg-white p-4 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-cyan-50 px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-cyan-900">最新分數</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">{latestPoint?.score ?? "--"}/10</p>
                  <p className="mt-1 text-xs text-gray-500">{latestPoint ? formatDateTime(latestPoint.askedAt) : "--"}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-900">較上次</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">
                    {scoreDelta === null ? "--" : scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {scoreDelta === null
                      ? "需要至少兩次評分"
                      : scoreDelta < 0
                        ? "分數下降，症狀改善"
                        : scoreDelta > 0
                          ? "分數上升，症狀加重"
                          : "分數無變"}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-600">評分次數</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">{selectedSeries.points.length}</p>
                  <p className="mt-1 text-xs text-gray-500">症狀：{selectedSeries.label}</p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <svg viewBox={`0 0 ${chartModel.width} ${chartModel.height}`} className="min-w-[560px] w-full">
                  {chartModel.guideScores.map((score) => {
                    const y = chartModel.margin.top + (1 - score / 10) * (chartModel.height - chartModel.margin.top - chartModel.margin.bottom);
                    return (
                      <g key={score}>
                        <line
                          x1={chartModel.margin.left}
                          x2={chartModel.width - chartModel.margin.right}
                          y1={y}
                          y2={y}
                          stroke="#dbeafe"
                          strokeDasharray="4 4"
                        />
                        <text x={8} y={y + 4} fontSize="11" fill="#64748b">
                          {score}
                        </text>
                      </g>
                    );
                  })}

                  <path d={chartModel.path} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                  {chartModel.positionedPoints.map((point) => (
                    <g key={point.id}>
                      <circle cx={point.x} cy={point.y} r={5} fill="#ffffff" stroke="#0f766e" strokeWidth="3" />
                      <text x={point.x} y={point.y - 12} textAnchor="middle" fontSize="11" fill="#0f172a">
                        {point.score}
                      </text>
                      <text x={point.x} y={chartModel.height - 12} textAnchor="middle" fontSize="11" fill="#64748b">
                        {formatDateLabel(point.askedAt)}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-cyan-200 bg-white px-4 py-5 text-sm text-gray-600">
          暫未有 0-10 分跟進答案。醫師在問診卡按分數並寫入後，呢度會自動出圖。
        </div>
      )}

      <div className="rounded-xl border border-white bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="text-sm font-semibold text-gray-900">最近問診跟進</h4>
          <span className="text-xs text-gray-500">包括分數、變化、頻率與文字答案</span>
        </div>

        {recentAnswers.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">暫未有跟進答案。</p>
        ) : (
          <div className="mt-3 space-y-3">
            {recentAnswers.map((answer) => (
              <div key={answer.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-medium text-cyan-900">
                    {answer.symptomLabel}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                    {answer.answerType === "scale_0_10" ? "0-10 分" : answer.answerType}
                  </span>
                  <span className="text-xs text-gray-400">{formatDateTime(answer.askedAt)}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-gray-900">{answer.answerValueText}{answer.answerValueNumber !== null ? "/10" : ""}</p>
                <p className="mt-1 text-xs text-gray-500">{answer.questionText}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
