import {
  type User, type InsertUser,
  type DoctorSchedule, type InsertDoctorSchedule,
  type Holiday, type InsertHoliday,
  type IntakeQuestion, type InsertIntakeQuestion,
  type Doctor, type InsertDoctor,
  doctorSchedules, holidays, intakeQuestions, doctors
} from "@/shared/schema";
import { db } from "./db";
import { eq, and, or, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Doctor schedules
  getAllDoctorSchedules(): Promise<DoctorSchedule[]>;
  getDoctorSchedule(doctorId: string, clinicId: string): Promise<DoctorSchedule | undefined>;
  upsertDoctorSchedule(schedule: InsertDoctorSchedule): Promise<DoctorSchedule>;
  deleteDoctorSchedule(doctorId: string, clinicId: string): Promise<void>;

  // Holidays
  getAllHolidays(): Promise<Holiday[]>;
  getHolidaysForDate(date: string): Promise<Holiday[]>;
  getHolidaysBlocking(date: string, doctorId?: string, clinicId?: string): Promise<Holiday[]>;
  createHoliday(holiday: InsertHoliday): Promise<Holiday>;
  deleteHoliday(id: string): Promise<void>;

  // Schedule queries for booking integration
  getSchedulesForDoctor(doctorId: string): Promise<DoctorSchedule[]>;
  getActiveSchedulesForDoctor(doctorId: string): Promise<DoctorSchedule[]>;

  // Intake questions
  getAllIntakeQuestions(): Promise<IntakeQuestion[]>;
  getIntakeQuestionsByVisitType(visitType: string): Promise<IntakeQuestion[]>;
  upsertIntakeQuestion(question: InsertIntakeQuestion & { id?: string }): Promise<IntakeQuestion>;
  deleteIntakeQuestion(id: string): Promise<void>;

  // Doctors
  getAllDoctors(): Promise<Doctor[]>;
  getDoctor(id: string): Promise<Doctor | undefined>;
  upsertDoctor(doctor: InsertDoctor): Promise<Doctor>;
  deleteDoctor(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users (kept in memory for now)
  private users: Map<string, User> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Doctor schedules
  async getAllDoctorSchedules(): Promise<DoctorSchedule[]> {
    return db.select().from(doctorSchedules);
  }

  async getDoctorSchedule(doctorId: string, clinicId: string): Promise<DoctorSchedule | undefined> {
    const results = await db.select().from(doctorSchedules)
      .where(and(eq(doctorSchedules.doctorId, doctorId), eq(doctorSchedules.clinicId, clinicId)));
    return results[0];
  }

  async upsertDoctorSchedule(schedule: InsertDoctorSchedule): Promise<DoctorSchedule> {
    const existing = await this.getDoctorSchedule(schedule.doctorId, schedule.clinicId);
    if (existing) {
      await db.update(doctorSchedules)
        .set(schedule)
        .where(and(eq(doctorSchedules.doctorId, schedule.doctorId), eq(doctorSchedules.clinicId, schedule.clinicId)));
      return { ...existing, ...schedule };
    } else {
      const result = await db.insert(doctorSchedules).values(schedule).returning();
      return result[0];
    }
  }

  async deleteDoctorSchedule(doctorId: string, clinicId: string): Promise<void> {
    await db.delete(doctorSchedules)
      .where(and(eq(doctorSchedules.doctorId, doctorId), eq(doctorSchedules.clinicId, clinicId)));
  }

  // Holidays
  async getAllHolidays(): Promise<Holiday[]> {
    return db.select().from(holidays);
  }

  async getHolidaysForDate(date: string): Promise<Holiday[]> {
    return db.select().from(holidays).where(eq(holidays.holidayDate, date));
  }

  async getHolidaysBlocking(date: string, doctorId?: string, clinicId?: string): Promise<Holiday[]> {
    const allHolidays = await this.getHolidaysForDate(date);
    return allHolidays.filter(h => {
      if (!h.doctorId && !h.clinicId) return true;
      if (h.doctorId && h.doctorId !== doctorId) return false;
      if (h.clinicId && h.clinicId !== clinicId) return false;
      return true;
    });
  }

  async getSchedulesForDoctor(doctorId: string): Promise<DoctorSchedule[]> {
    return db.select().from(doctorSchedules).where(eq(doctorSchedules.doctorId, doctorId));
  }

  async getActiveSchedulesForDoctor(doctorId: string): Promise<DoctorSchedule[]> {
    return db.select().from(doctorSchedules)
      .where(and(eq(doctorSchedules.doctorId, doctorId), eq(doctorSchedules.isActive, true)));
  }

  async createHoliday(holiday: InsertHoliday): Promise<Holiday> {
    const result = await db.insert(holidays).values(holiday).returning();
    return result[0];
  }

  async deleteHoliday(id: string): Promise<void> {
    await db.delete(holidays).where(eq(holidays.id, id));
  }

  // Intake questions
  async getAllIntakeQuestions(): Promise<IntakeQuestion[]> {
    return db.select().from(intakeQuestions);
  }

  async getIntakeQuestionsByVisitType(visitType: string): Promise<IntakeQuestion[]> {
    return db.select().from(intakeQuestions)
      .where(and(eq(intakeQuestions.visitType, visitType), eq(intakeQuestions.isActive, true)));
  }

  async upsertIntakeQuestion(question: InsertIntakeQuestion & { id?: string }): Promise<IntakeQuestion> {
    if (question.id) {
      await db.update(intakeQuestions).set(question).where(eq(intakeQuestions.id, question.id));
      const result = await db.select().from(intakeQuestions).where(eq(intakeQuestions.id, question.id));
      return result[0];
    } else {
      const result = await db.insert(intakeQuestions).values(question).returning();
      return result[0];
    }
  }

  async deleteIntakeQuestion(id: string): Promise<void> {
    await db.delete(intakeQuestions).where(eq(intakeQuestions.id, id));
  }

  // Doctors
  async getAllDoctors(): Promise<Doctor[]> {
    return db.select().from(doctors);
  }

  async getDoctor(id: string): Promise<Doctor | undefined> {
    const results = await db.select().from(doctors).where(eq(doctors.id, id));
    return results[0];
  }

  async upsertDoctor(doctor: InsertDoctor): Promise<Doctor> {
    const existing = await this.getDoctor(doctor.id);
    if (existing) {
      await db.update(doctors).set(doctor).where(eq(doctors.id, doctor.id));
      return { ...existing, ...doctor };
    } else {
      const result = await db.insert(doctors).values(doctor).returning();
      return result[0];
    }
  }

  async deleteDoctor(id: string): Promise<void> {
    await db.delete(doctors).where(eq(doctors.id, id));
  }
}

export const storage = new DatabaseStorage();
