// Shared schedule configuration between frontend and backend

// Time range like "11:00-13:30" or "15:30-19:00"
export interface TimeRange {
  start: string; // HH:mm
  end: string;   // HH:mm
}

// Working hours per day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
// null means closed that day
export type WeeklySchedule = {
  [day: number]: TimeRange[] | null;
};

export interface CalendarMapping {
  doctorId: string;
  clinicId: string;
  calendarId: string;
  isActive: boolean;
  schedule: WeeklySchedule;
}

// ============================================================================
// CALENDAR MAPPINGS WITH SCHEDULES
// Edit this section to update doctor schedules and calendar IDs
// ============================================================================

export const CALENDAR_MAPPINGS: CalendarMapping[] = [
  // ===== Dr. Chau 周德健醫師 =====
  { 
    doctorId: "chau", 
    clinicId: "central", 
    calendarId: "a8b20307316b7d558eb2d01e1adaf3ed4bf3210152e43bc36fccad1da1089754@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: [{ start: "11:00", end: "14:00" }],
      2: [{ start: "11:00", end: "14:00" }],
      3: [{ start: "11:00", end: "14:00" }],
      4: null,
      5: null,
      6: null,
    }
  },
  { 
    doctorId: "chau", 
    clinicId: "jordan", 
    calendarId: "40cb62a1e50a16724e785554027785b0b1b041a4b8dffea974d0a2d243c0985f@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: null,
      2: [{ start: "15:00", end: "19:00" }],
      3: null,
      4: [{ start: "15:00", end: "19:00" }],
      5: [{ start: "15:00", end: "19:00" }],
      6: null,
    }
  },
  { 
    doctorId: "chau", 
    clinicId: "online", 
    calendarId: "a8b20307316b7d558eb2d01e1adaf3ed4bf3210152e43bc36fccad1da1089754@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: [{ start: "10:00", end: "12:00" }],
      2: [{ start: "10:00", end: "12:00" }],
      3: [{ start: "10:00", end: "12:00" }],
      4: [{ start: "10:00", end: "12:00" }],
      5: [{ start: "10:00", end: "12:00" }],
      6: null,
    }
  },

  // ===== Dr. Lee 李芊霖醫師 =====
  { 
    doctorId: "lee", 
    clinicId: "central", 
    calendarId: "f1cabc3fe412870f97fc6d1b8c4cfc297727071bd9dccfcaaa1ef3aba4080c48@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: [{ start: "15:30", end: "20:00" }],
      2: [{ start: "15:30", end: "19:00" }],
      3: [{ start: "11:00", end: "13:30" }, { start: "15:30", end: "19:00" }],
      4: null,
      5: null,
      6: null,
    }
  },
  { 
    doctorId: "lee", 
    clinicId: "jordan", 
    calendarId: "5f26cf9dc01ffe7daf609d3dfb7c17460ac2d83e79099c924a9e92ec1e974c97@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: null,
      2: null,
      3: null,
      4: [{ start: "11:00", end: "14:00" }, { start: "15:30", end: "19:00" }],
      5: [{ start: "11:00", end: "14:00" }, { start: "15:30", end: "19:00" }],
      6: [{ start: "10:00", end: "13:00" }],
    }
  },
  { 
    doctorId: "lee", 
    clinicId: "tsuenwan", 
    calendarId: "00675921f690d3dfd53efaa89b916768890c310a9027b8818d7a1763cd1b07ea@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: [{ start: "10:00", end: "14:00" }],
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
    }
  },
  { 
    doctorId: "lee", 
    clinicId: "online", 
    calendarId: "primary-calendar-lee-online@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: [{ start: "20:00", end: "23:00" }],
      2: [{ start: "20:00", end: "21:00" }],
      3: [{ start: "20:00", end: "21:00" }],
      4: [{ start: "20:00", end: "21:00" }],
      5: [{ start: "20:00", end: "21:00" }],
      6: null,
    }
  },

  // ===== Dr. Chan 陳家富醫師 =====
  { 
    doctorId: "chan", 
    clinicId: "central", 
    calendarId: "b3dd85b8d679e420cd80e595d4442c9f779e26678fe9b3eebe7f11cfc33eb032@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: [{ start: "11:00", end: "14:00" }],
      2: [{ start: "11:00", end: "14:00" }],
      3: null,
      4: null,
      5: null,
      6: null,
    }
  },
  { 
    doctorId: "chan", 
    clinicId: "jordan", 
    calendarId: "q65lm70v5v733drnuii13ok2u8@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: null,
      2: null,
      3: [{ start: "15:00", end: "19:00" }],
      4: [{ start: "15:00", end: "19:00" }],
      5: [{ start: "15:00", end: "19:00" }],
      6: [{ start: "10:00", end: "14:00" }],
    }
  },
  { 
    doctorId: "chan", 
    clinicId: "tsuenwan", 
    calendarId: "a7p2f7o664nel4p94sbj3istns@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: [{ start: "15:00", end: "18:00" }],
      2: [{ start: "15:00", end: "18:00" }],
      3: null,
      4: null,
      5: null,
      6: null,
    }
  },
  { 
    doctorId: "chan", 
    clinicId: "online", 
    calendarId: "b3dd85b8d679e420cd80e595d4442c9f779e26678fe9b3eebe7f11cfc33eb032@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: [{ start: "20:00", end: "21:00" }],
      2: [{ start: "20:00", end: "21:00" }],
      3: [{ start: "20:00", end: "21:00" }],
      4: [{ start: "20:00", end: "21:00" }],
      5: [{ start: "20:00", end: "21:00" }],
      6: null,
    }
  },
  
  // ===== Dr. Hon 韓曉恩醫師 =====
  { 
    doctorId: "hon", 
    clinicId: "central", 
    calendarId: "032435361d8f90c72b278f94d462622adae3633939f46f1dcc508493f14ad1ed@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: null,
      2: null,
      3: [{ start: "15:00", end: "19:00" }],
      4: [{ start: "15:00", end: "19:00" }],
      5: [{ start: "15:00", end: "19:00" }],
      6: null,
    }
  },
  { 
    doctorId: "hon", 
    clinicId: "jordan", 
    calendarId: "8722c3b55b390f936e659695115607387057e71b395c86187089a1a2c55e17b9@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: [{ start: "11:00", end: "14:00" }, { start: "15:30", end: "19:00" }],
      2: [{ start: "11:00", end: "14:00" }, { start: "15:30", end: "19:00" }],
      3: null,
      4: null,
      5: null,
      6: [{ start: "10:00", end: "14:00" }],
    }
  },
  { 
    doctorId: "hon", 
    clinicId: "tsuenwan", 
    calendarId: "79e5638e12bd9579183595c7baad1eb44d1a27036a3d2686432d155abd04c044@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: null,
      2: null,
      3: [{ start: "10:00", end: "13:00" }],
      4: null,
      5: null,
      6: null,
    }
  },
  { 
    doctorId: "hon", 
    clinicId: "online", 
    calendarId: "032435361d8f90c72b278f94d462622adae3633939f46f1dcc508493f14ad1ed@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: [{ start: "20:00", end: "21:00" }],
      2: [{ start: "20:00", end: "21:00" }],
      3: [{ start: "20:00", end: "21:00" }],
      4: [{ start: "20:00", end: "21:00" }],
      5: [{ start: "20:00", end: "21:00" }],
      6: null,
    }
  },

  // ===== Dr. Cheung 張天慧醫師 =====
  { 
    doctorId: "cheung", 
    clinicId: "central", 
    calendarId: "1n6d816lab7isce87ma0ua8qoc@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
    }
  },
  { 
    doctorId: "cheung", 
    clinicId: "jordan", 
    calendarId: "r0ea9kabll5gdc7ll2s13n5hko@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
    }
  },

  // ===== Dr. Leung 梁仲威醫師 =====
  { 
    doctorId: "leung", 
    clinicId: "central", 
    calendarId: "117uj7jkd40t0otf9aekvscm84@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
    }
  },
  { 
    doctorId: "leung", 
    clinicId: "jordan", 
    calendarId: "a7b5r8c6pfslia0sefcu1f4c38@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
    }
  },
  { 
    doctorId: "leung", 
    clinicId: "tsuenwan", 
    calendarId: "ibk3t07kqhdvp5lfvpim401vqo@group.calendar.google.com", 
    isActive: true,
    schedule: {
      0: null,
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
    }
  },
];

// Helper functions
export function getMapping(doctorId: string, clinicId: string): CalendarMapping | undefined {
  return CALENDAR_MAPPINGS.find(m => m.doctorId === doctorId && m.clinicId === clinicId);
}

export function getScheduleForDay(schedule: WeeklySchedule, dayOfWeek: number): TimeRange[] | null {
  return schedule[dayOfWeek] ?? null;
}

export function isDayClosed(schedule: WeeklySchedule, dayOfWeek: number): boolean {
  return schedule[dayOfWeek] === null;
}

export interface TimeRangeWithClinic extends TimeRange {
  clinicId: string;
  calendarId: string;
}

export function getAllPhysicalClinicsForDay(doctorId: string, dayOfWeek: number): CalendarMapping[] {
  const physicalClinics = ["central", "jordan", "tsuenwan"];
  const result: CalendarMapping[] = [];
  
  for (const clinicId of physicalClinics) {
    const mapping = getMapping(doctorId, clinicId);
    if (mapping && mapping.isActive) {
      const daySchedule = getScheduleForDay(mapping.schedule, dayOfWeek);
      if (daySchedule !== null && daySchedule.length > 0) {
        result.push(mapping);
      }
    }
  }
  
  return result;
}

export function getPhysicalClinicForTime(doctorId: string, dayOfWeek: number, time: string): CalendarMapping | null {
  const physicalClinics = ["central", "jordan", "tsuenwan"];
  const [targetHour, targetMin] = time.split(':').map(Number);
  const targetMinutes = targetHour * 60 + targetMin;
  
  for (const clinicId of physicalClinics) {
    const mapping = getMapping(doctorId, clinicId);
    if (mapping && mapping.isActive) {
      const daySchedule = getScheduleForDay(mapping.schedule, dayOfWeek);
      if (daySchedule) {
        for (const range of daySchedule) {
          const [startHour, startMin] = range.start.split(':').map(Number);
          const [endHour, endMin] = range.end.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          
          if (targetMinutes >= startMinutes && targetMinutes < endMinutes) {
            return mapping;
          }
        }
      }
    }
  }
  
  return null;
}

export function getOnlineScheduleForDoctor(doctorId: string): WeeklySchedule {
  const physicalClinics = ["central", "jordan", "tsuenwan"];
  const onlineSchedule: WeeklySchedule = {
    0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null
  };
  
  for (let day = 0; day <= 6; day++) {
    const allRanges: TimeRange[] = [];
    
    for (const clinicId of physicalClinics) {
      const mapping = getMapping(doctorId, clinicId);
      if (mapping && mapping.isActive) {
        const daySchedule = getScheduleForDay(mapping.schedule, day);
        if (daySchedule !== null && daySchedule.length > 0) {
          allRanges.push(...daySchedule);
        }
      }
    }
    
    if (allRanges.length > 0) {
      allRanges.sort((a, b) => a.start.localeCompare(b.start));
      onlineSchedule[day] = allRanges;
    }
  }
  
  return onlineSchedule;
}

export function getOnlineScheduleWithClinics(doctorId: string, dayOfWeek: number): TimeRangeWithClinic[] {
  const physicalClinics = ["central", "jordan", "tsuenwan"];
  const result: TimeRangeWithClinic[] = [];
  
  for (const clinicId of physicalClinics) {
    const mapping = getMapping(doctorId, clinicId);
    if (mapping && mapping.isActive) {
      const daySchedule = getScheduleForDay(mapping.schedule, dayOfWeek);
      if (daySchedule) {
        for (const range of daySchedule) {
          result.push({
            start: range.start,
            end: range.end,
            clinicId: mapping.clinicId,
            calendarId: mapping.calendarId,
          });
        }
      }
    }
  }
  
  result.sort((a, b) => a.start.localeCompare(b.start));
  return result;
}
