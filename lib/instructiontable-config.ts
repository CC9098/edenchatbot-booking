export type InstructiontableRelation = {
  column: string;
  targetTable: string;
  targetColumn: string;
};

export type InstructiontableDefinition = {
  name: string;
  label: string;
  group:
    | "content"
    | "chat"
    | "care"
    | "booking"
    | "billing"
    | "media";
  description: string;
  primaryKey: string[];
  relations: InstructiontableRelation[];
};

export const instructiontableDefinitions: InstructiontableDefinition[] = [
  {
    name: "articles",
    label: "Articles",
    group: "content",
    description: "Website article content records.",
    primaryKey: ["id"],
    relations: [{ column: "created_by", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "courses",
    label: "Courses",
    group: "content",
    description: "Course master records.",
    primaryKey: ["id"],
    relations: [{ column: "created_by", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "course_modules",
    label: "Course Modules",
    group: "content",
    description: "Course section groupings.",
    primaryKey: ["id"],
    relations: [{ column: "course_id", targetTable: "courses", targetColumn: "id" }],
  },
  {
    name: "course_lessons",
    label: "Course Lessons",
    group: "content",
    description: "Lesson content per course/module.",
    primaryKey: ["id"],
    relations: [
      { column: "course_id", targetTable: "courses", targetColumn: "id" },
      { column: "module_id", targetTable: "course_modules", targetColumn: "id" },
    ],
  },
  {
    name: "user_lesson_progress",
    label: "User Lesson Progress",
    group: "content",
    description: "Per-user learning progress by lesson.",
    primaryKey: ["user_id", "lesson_id"],
    relations: [
      { column: "user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "lesson_id", targetTable: "course_lessons", targetColumn: "id" },
    ],
  },

  {
    name: "chat_sessions",
    label: "Chat Sessions",
    group: "chat",
    description: "Conversation sessions.",
    primaryKey: ["session_id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "chat_messages",
    label: "Chat Messages",
    group: "chat",
    description: "Chat messages per session.",
    primaryKey: ["id"],
    relations: [
      { column: "session_id", targetTable: "chat_sessions", targetColumn: "session_id" },
      { column: "user_id", targetTable: "auth.users", targetColumn: "id" },
    ],
  },
  {
    name: "chat_prompt_settings",
    label: "Chat Prompt Settings",
    group: "chat",
    description: "Prompt variants and gears.",
    primaryKey: ["type"],
    relations: [],
  },
  {
    name: "chat_request_logs",
    label: "Chat Request Logs",
    group: "chat",
    description: "LLM request telemetry records.",
    primaryKey: ["id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "knowledge_docs",
    label: "Knowledge Docs",
    group: "chat",
    description: "Knowledge snippets for chat injection.",
    primaryKey: ["id"],
    relations: [],
  },

  {
    name: "patient_care_profile",
    label: "Patient Care Profile",
    group: "care",
    description: "Patient-level care profile and constitution.",
    primaryKey: ["patient_user_id"],
    relations: [
      { column: "patient_user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "updated_by", targetTable: "auth.users", targetColumn: "id" },
    ],
  },
  {
    name: "care_instructions",
    label: "Care Instructions",
    group: "care",
    description: "Doctor instructions for patient care.",
    primaryKey: ["id"],
    relations: [
      { column: "patient_user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "created_by", targetTable: "auth.users", targetColumn: "id" },
    ],
  },
  {
    name: "follow_up_plans",
    label: "Follow-up Plans",
    group: "care",
    description: "Scheduled follow-up targets for patients.",
    primaryKey: ["id"],
    relations: [
      { column: "patient_user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "created_by", targetTable: "auth.users", targetColumn: "id" },
    ],
  },
  {
    name: "symptom_logs",
    label: "Symptom Logs",
    group: "care",
    description: "Patient symptom history and severity.",
    primaryKey: ["id"],
    relations: [{ column: "patient_user_id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "audit_logs",
    label: "Audit Logs",
    group: "care",
    description: "Change history for sensitive operations.",
    primaryKey: ["id"],
    relations: [
      { column: "actor_user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "patient_user_id", targetTable: "auth.users", targetColumn: "id" },
    ],
  },
  {
    name: "patient_care_team",
    label: "Patient Care Team",
    group: "care",
    description: "Care team access mapping between staff and patient.",
    primaryKey: ["patient_user_id", "staff_user_id"],
    relations: [
      { column: "patient_user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "staff_user_id", targetTable: "auth.users", targetColumn: "id" },
    ],
  },
  {
    name: "profiles",
    label: "Profiles",
    group: "care",
    description: "Extended user profile data.",
    primaryKey: ["id"],
    relations: [{ column: "id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "staff_roles",
    label: "Staff Roles",
    group: "care",
    description: "Staff permission roles.",
    primaryKey: ["user_id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },

  {
    name: "booking_intake",
    label: "Booking Intake",
    group: "booking",
    description: "Structured booking payload and lifecycle.",
    primaryKey: ["id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "doctors",
    label: "Doctors",
    group: "booking",
    description: "Doctor catalog.",
    primaryKey: ["id"],
    relations: [],
  },
  {
    name: "doctor_schedules",
    label: "Doctor Schedules",
    group: "booking",
    description: "Doctor-to-clinic calendar mappings.",
    primaryKey: ["id"],
    relations: [{ column: "doctor_id", targetTable: "doctors", targetColumn: "id" }],
  },
  {
    name: "holidays",
    label: "Holidays",
    group: "booking",
    description: "Booking-blocked dates.",
    primaryKey: ["id"],
    relations: [{ column: "doctor_id", targetTable: "doctors", targetColumn: "id" }],
  },
  {
    name: "intake_questions",
    label: "Intake Questions",
    group: "booking",
    description: "Configurable booking intake fields.",
    primaryKey: ["id"],
    relations: [],
  },

  {
    name: "membership_plans",
    label: "Membership Plans",
    group: "billing",
    description: "Subscription plan definitions.",
    primaryKey: ["code"],
    relations: [],
  },
  {
    name: "user_subscriptions",
    label: "User Subscriptions",
    group: "billing",
    description: "Current subscription state by user.",
    primaryKey: ["id"],
    relations: [
      { column: "user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "plan_code", targetTable: "membership_plans", targetColumn: "code" },
    ],
  },
  {
    name: "stripe_customers",
    label: "Stripe Customers",
    group: "billing",
    description: "Mapping of app users to Stripe customer IDs.",
    primaryKey: ["user_id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "stripe_checkout_sessions",
    label: "Stripe Checkout Sessions",
    group: "billing",
    description: "Stripe checkout session lifecycle records.",
    primaryKey: ["id"],
    relations: [
      { column: "user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "plan_code", targetTable: "membership_plans", targetColumn: "code" },
    ],
  },
  {
    name: "billing_events",
    label: "Billing Events",
    group: "billing",
    description: "Webhook event journal for billing.",
    primaryKey: ["id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },
  {
    name: "member_subscriptions",
    label: "Member Subscriptions (Legacy)",
    group: "billing",
    description: "Legacy subscription table.",
    primaryKey: ["user_id"],
    relations: [{ column: "user_id", targetTable: "auth.users", targetColumn: "id" }],
  },

  {
    name: "user_images",
    label: "User Images",
    group: "media",
    description: "User image metadata records.",
    primaryKey: ["id"],
    relations: [
      { column: "user_id", targetTable: "auth.users", targetColumn: "id" },
      { column: "related_session_id", targetTable: "chat_sessions", targetColumn: "session_id" },
    ],
  },
];

export const instructiontableDefinitionMap = new Map(
  instructiontableDefinitions.map((item) => [item.name, item])
);

export const instructiontableTableNames = instructiontableDefinitions.map(
  (item) => item.name
);

export function getInstructiontableDefinition(table: string) {
  return instructiontableDefinitionMap.get(table) ?? null;
}

