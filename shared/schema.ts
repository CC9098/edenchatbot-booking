import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, json, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Doctor schedule mappings - stored in database for admin editing
export const doctorSchedules = pgTable("doctor_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: text("doctor_id").notNull(),
  clinicId: text("clinic_id").notNull(),
  calendarId: text("calendar_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  schedule: json("schedule").notNull(), // WeeklySchedule JSON
});

export const insertDoctorScheduleSchema = createInsertSchema(doctorSchedules).omit({ id: true });
export type InsertDoctorSchedule = z.infer<typeof insertDoctorScheduleSchema>;
export type DoctorSchedule = typeof doctorSchedules.$inferSelect;

// Holidays - dates when doctors are not available
export const holidays = pgTable("holidays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  doctorId: text("doctor_id"), // null means all doctors
  clinicId: text("clinic_id"), // null means all clinics
  holidayDate: date("holiday_date").notNull(),
  startTime: text("start_time"), // null means all-day holiday
  endTime: text("end_time"), // null means all-day holiday
  reason: text("reason"),
});

export const insertHolidaySchema = createInsertSchema(holidays).omit({ id: true });
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type Holiday = typeof holidays.$inferSelect;

// Intake form questions - customizable questionnaire
export const intakeQuestions = pgTable("intake_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitType: text("visit_type").notNull(), // 'first_time' or 'returning'
  questionKey: text("question_key").notNull(), // unique identifier
  labelEn: text("label_en").notNull(),
  labelZh: text("label_zh").notNull(),
  fieldType: text("field_type").notNull(), // 'text', 'textarea', 'select', 'radio', 'checkbox'
  required: boolean("required").notNull().default(false),
  options: json("options"), // for select/radio/checkbox types
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertIntakeQuestionSchema = createInsertSchema(intakeQuestions).omit({ id: true });
export type InsertIntakeQuestion = z.infer<typeof insertIntakeQuestionSchema>;
export type IntakeQuestion = typeof intakeQuestions.$inferSelect;

// Doctors metadata - for admin to manage doctor list
export const doctors = pgTable("doctors", {
  id: varchar("id").primaryKey(), // e.g., "lee", "chan"
  name: text("name").notNull(),
  nameZh: text("name_zh").notNull(),
  title: text("title").notNull(),
  titleZh: text("title_zh").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertDoctorSchema = createInsertSchema(doctors);
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Doctor = typeof doctors.$inferSelect;
