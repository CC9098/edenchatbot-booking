import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRecordText,
  mergeSymptomExtractions,
  splitTranscriptIntoSegments,
  type PatientContext,
} from "@/lib/doctor-voice-note";

test("splitTranscriptIntoSegments keeps each segment within the size limit", () => {
  const transcript = [
    "第一段：右肩痛兩星期，夜晚明顯加重，舉高手會扯住痛。",
    "第二段：瞓覺會痛醒，朝早僵硬，活動後稍為鬆動。",
    "第三段：否認發燒，否認近期跌倒，但近幾日工作後更痛。",
  ].join("\n\n");

  const segments = splitTranscriptIntoSegments(transcript, 32);

  assert.equal(segments.length, 3);
  assert.ok(segments.every((segment) => segment.length <= 32));
  assert.equal(segments[0], "第一段：右肩痛兩星期，夜晚明顯加重，舉高手會扯住痛。");
});

test("splitTranscriptIntoSegments falls back to hard splits for oversized unbroken text", () => {
  const transcript = "痛".repeat(55);
  const segments = splitTranscriptIntoSegments(transcript, 20);

  assert.deepEqual(segments, ["痛".repeat(20), "痛".repeat(20), "痛".repeat(15)]);
});

test("mergeSymptomExtractions dedupes repeated findings while preserving chronology", () => {
  const merged = mergeSymptomExtractions([
    {
      chiefComplaint: "右肩痛",
      presentIllnessSummary: "右肩痛兩星期，夜晚會痛醒。",
      associatedSymptoms: ["夜晚痛醒", "舉高手受限"],
      negativeSymptoms: ["無發燒"],
      durationAndCourse: "兩星期",
      otherRecordableFindings: ["按壓右肩前側有痛"],
      verificationItems: ["確認痛感分數"],
    },
    {
      chiefComplaint: "右肩痛",
      presentIllnessSummary: "朝早僵硬，做完搬運後加劇。",
      associatedSymptoms: ["舉高手受限", "朝早僵硬"],
      negativeSymptoms: ["無發燒", "無外傷"],
      durationAndCourse: "工作後更痛",
      otherRecordableFindings: ["外展動作受限"],
      verificationItems: ["確認有無手麻"],
    },
  ]);

  assert.equal(merged.chiefComplaint, "右肩痛");
  assert.equal(merged.presentIllnessSummary, "右肩痛兩星期，夜晚會痛醒。；朝早僵硬，做完搬運後加劇。");
  assert.deepEqual(merged.associatedSymptoms, ["夜晚痛醒", "舉高手受限", "朝早僵硬"]);
  assert.deepEqual(merged.negativeSymptoms, ["無發燒", "無外傷"]);
  assert.equal(merged.durationAndCourse, "兩星期；工作後更痛");
  assert.deepEqual(merged.otherRecordableFindings, ["按壓右肩前側有痛", "外展動作受限"]);
  assert.deepEqual(merged.verificationItems, ["確認痛感分數", "確認有無手麻"]);
});

test("buildRecordText includes patient header when patient info is present", () => {
  const patient: PatientContext = {
    patientUserId: "patient-123",
    patientDisplayName: "陳大文",
    patientPhone: "91234567",
  };

  const recordText = buildRecordText(
    {
      chiefComplaint: "頭痛",
      presentIllnessSummary: "近三日頭痛，下午較重。",
      associatedSymptoms: ["怕光"],
      negativeSymptoms: ["無發燒"],
      durationAndCourse: "三日",
      otherRecordableFindings: ["按壓太陽穴敏感"],
      verificationItems: ["確認睡眠時數"],
    },
    patient,
  );

  assert.match(recordText, /病人ID：patient-123/);
  assert.match(recordText, /病人姓名：陳大文/);
  assert.match(recordText, /主訴：頭痛/);
});
