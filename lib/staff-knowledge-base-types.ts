export type StaffKnowledgeStatus = "seed" | "placeholder" | "draft" | "reviewed";
export type StaffKnowledgeSensitivity = "public" | "internal" | "restricted";

export interface StaffKnowledgeDocument {
  id: string;
  noteId?: string;
  title: string;
  category: string;
  status: StaffKnowledgeStatus;
  sensitivity: StaffKnowledgeSensitivity;
  source: string;
  updatedAt: string;
  createdAt?: string;
  updatedBy?: string | null;
  excerpt: string;
  contentMd: string;
  patientReplyMd: string | null;
  sourcePath: string;
  tags: string[];
  editable?: boolean;
  imported?: boolean;
}

export interface StaffKnowledgeSearchResult {
  document: StaffKnowledgeDocument;
  score: number;
  snippets: string[];
}

export interface StaffKnowledgeChatAnswer {
  answer: string;
  confidence: "high" | "medium" | "low" | "blocked";
  sources: Array<{
    id: string;
    title: string;
    category: string;
    snippets: string[];
  }>;
}
