import "server-only";

import type {
  DoctorRecommendation,
  RecommendedAppointmentSlot,
  Symptom,
} from "@/types";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { supabaseAdmin } from "@/lib/supabase";

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type DayKey = (typeof DAY_KEYS)[number];

interface TimeRange {
  start: string;
  end: string;
}

interface CsvDoctor {
  scheduleId: string;
  name: string;
  specialty: string;
  locationMiles: number;
  weeklyAvailability: Record<DayKey, TimeRange[]>;
  googleCalendarId: string;
}

interface DirectoryDoctor extends CsvDoctor {
  doctorId: string | null;
}

const DOCTOR_SCHEDULE_PATH = join(process.cwd(), "Doctor_Schedule.csv");

const SPECIALTY_RULES: Array<{
  patterns: RegExp[];
  specialties: string[];
}> = [
  {
    patterns: [/chest pain|palpitations|heart|pressure|blood pressure/i],
    specialties: ["Cardiology", "Internal Medicine", "General Practice"],
  },
  {
    patterns: [/shortness of breath|breath|wheez|asthma|cough|lung/i],
    specialties: ["Pulmonology", "Internal Medicine", "Family Medicine"],
  },
  {
    patterns: [/headache|migraine|dizz|seizure|numb|tingl|memory/i],
    specialties: ["Neurology", "Internal Medicine"],
  },
  {
    patterns: [/rash|itch|skin|acne|eczema/i],
    specialties: ["Dermatology", "Family Medicine"],
  },
  {
    patterns: [/diabetes|glucose|thyroid|fatigue|weight gain|weight loss/i],
    specialties: ["Endocrinology", "Internal Medicine"],
  },
  {
    patterns: [/stomach|abdominal|nausea|vomit|diarrhea|constipation|reflux/i],
    specialties: ["Gastroenterology", "Internal Medicine"],
  },
  {
    patterns: [/ear|sinus|throat|hearing|voice/i],
    specialties: ["ENT", "General Practice"],
  },
  {
    patterns: [/joint|knee|back|hip|shoulder|sprain|fracture/i],
    specialties: ["Orthopedics", "Rheumatology"],
  },
  {
    patterns: [/vision|eye|blurred/i],
    specialties: ["Ophthalmology", "Internal Medicine"],
  },
  {
    patterns: [/allergy|hives|immune/i],
    specialties: ["Allergy and Immunology", "Family Medicine"],
  },
  {
    patterns: [/anxiety|depress|panic|sleep|mood/i],
    specialties: ["Psychiatry", "Family Medicine"],
  },
  {
    patterns: [/infection|fever/i],
    specialties: ["Infectious Disease", "Internal Medicine"],
  },
];

let csvDoctorsPromise: Promise<CsvDoctor[]> | null = null;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function parseAvailability(raw: string) {
  if (!raw || raw === "Closed") return [] as TimeRange[];

  return raw.split(";").map((range) => {
    const [start, end] = range.split("-");

    return {
      start: start.trim(),
      end: end.trim(),
    };
  });
}

function parseCsvDoctors(text: string) {
  const [headerLine, ...rows] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");

  return rows
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const values = row.split(",");
      const record = Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? ""]),
      ) as Record<string, string>;

      const scheduleId = record.id.trim();
      const name = record.name.trim();
      const specialty = record.speciality.trim();

      return {
        scheduleId,
        name,
        specialty,
        locationMiles: Number.parseFloat(record.location_miles),
        weeklyAvailability: {
          Sun: parseAvailability(record.Sun),
          Mon: parseAvailability(record.Mon),
          Tue: parseAvailability(record.Tue),
          Wed: parseAvailability(record.Wed),
          Thu: parseAvailability(record.Thu),
          Fri: parseAvailability(record.Fri),
          Sat: parseAvailability(record.Sat),
        },
        googleCalendarId: `carecaller-${scheduleId}-${slugify(name)}`,
      } satisfies CsvDoctor;
    });
}

async function loadCsvDoctors() {
  if (!csvDoctorsPromise) {
    csvDoctorsPromise = readFile(DOCTOR_SCHEDULE_PATH, "utf8").then(
      parseCsvDoctors,
    );
  }

  return csvDoctorsPromise;
}

function buildSpecialtyMatches(symptoms: Symptom[]) {
  const matchMap = new Map<string, Set<string>>();
  const activeSymptoms = symptoms
    .map((symptom) => symptom.symptom_name.trim())
    .filter(Boolean);

  for (const symptom of activeSymptoms) {
    let matched = false;

    for (const rule of SPECIALTY_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(symptom))) {
        matched = true;

        for (const specialty of rule.specialties) {
          if (!matchMap.has(specialty)) {
            matchMap.set(specialty, new Set<string>());
          }

          matchMap.get(specialty)?.add(symptom);
        }
      }
    }

    if (!matched) {
      for (const specialty of [
        "General Practice",
        "Family Medicine",
        "Internal Medicine",
      ]) {
        if (!matchMap.has(specialty)) {
          matchMap.set(specialty, new Set<string>());
        }

        matchMap.get(specialty)?.add(symptom);
      }
    }
  }

  if (!matchMap.size) {
    for (const specialty of [
      "General Practice",
      "Family Medicine",
      "Internal Medicine",
    ]) {
      matchMap.set(specialty, new Set<string>());
    }
  }

  return matchMap;
}

function buildSlotKey(value: string) {
  return new Date(value).toISOString().slice(0, 16);
}

function combineDateAndTime(date: Date, time: string) {
  const [hours, minutes] = time
    .split(":")
    .map((part) => Number.parseInt(part, 10));
  const next = new Date(date);

  next.setHours(hours, minutes, 0, 0);

  return next;
}

function buildSlots(
  doctor: DirectoryDoctor,
  bookedKeys: Set<string>,
  maxSlots: number,
) {
  const slots: RecommendedAppointmentSlot[] = [];
  const now = new Date();
  const searchStart = new Date(now);

  searchStart.setHours(0, 0, 0, 0);

  for (let offset = 0; offset < 14 && slots.length < maxSlots; offset += 1) {
    const currentDate = new Date(searchStart);

    currentDate.setDate(searchStart.getDate() + offset);
    const dayKey = DAY_KEYS[currentDate.getDay()];
    const dayRanges = doctor.weeklyAvailability[dayKey];

    for (const range of dayRanges) {
      let current = combineDateAndTime(currentDate, range.start);
      const end = combineDateAndTime(currentDate, range.end);

      while (current < end && slots.length < maxSlots) {
        const slotEnd = new Date(current.getTime() + 30 * 60 * 1000);

        if (slotEnd > end) break;

        const startIso = current.toISOString();

        if (
          current.getTime() > now.getTime() + 30 * 60 * 1000 &&
          !bookedKeys.has(buildSlotKey(startIso))
        ) {
          slots.push({
            id: `${doctor.scheduleId}-${startIso}`,
            starts_at: startIso,
            ends_at: slotEnd.toISOString(),
          });
        }

        current = new Date(current.getTime() + 30 * 60 * 1000);
      }
    }
  }

  return slots;
}

export async function getAppointmentRecommendations(
  symptoms: Symptom[],
  options?: { limitDoctors?: number; slotsPerDoctor?: number },
) {
  const limitDoctors = options?.limitDoctors ?? 4;
  const slotsPerDoctor = options?.slotsPerDoctor ?? 6;
  const [csvDoctors, doctorsRes] = await Promise.all([
    loadCsvDoctors(),
    supabaseAdmin
      .from("doctors")
      .select("id, name, specialty, google_calendar_id")
      .order("name"),
  ]);

  const doctorLookup = new Map(
    (doctorsRes.data ?? []).map((doctor) => [
      `${normalize(doctor.name)}|${normalize(doctor.specialty ?? "")}`,
      doctor,
    ]),
  );

  const mergedDoctors: DirectoryDoctor[] = csvDoctors.map((doctor) => {
    const existingDoctor = doctorLookup.get(
      `${normalize(doctor.name)}|${normalize(doctor.specialty)}`,
    );

    return {
      ...doctor,
      doctorId: existingDoctor?.id ?? null,
      googleCalendarId:
        existingDoctor?.google_calendar_id ?? doctor.googleCalendarId,
    };
  });

  const existingDoctorIds = mergedDoctors
    .map((doctor) => doctor.doctorId)
    .filter((doctorId): doctorId is string => Boolean(doctorId));

  const appointmentsRes = existingDoctorIds.length
    ? await supabaseAdmin
        .from("appointments")
        .select("doctor_id, datetime, status")
        .in("doctor_id", existingDoctorIds)
        .in("status", ["scheduled", "confirmed", "rescheduled"])
        .gte("datetime", new Date().toISOString())
    : {
        data: [] as Array<{
          doctor_id: string | null;
          datetime: string;
          status: string | null;
        }>,
      };

  const bookedByDoctor = new Map<string, Set<string>>();

  for (const appointment of appointmentsRes.data ?? []) {
    if (!appointment.doctor_id) continue;

    if (!bookedByDoctor.has(appointment.doctor_id)) {
      bookedByDoctor.set(appointment.doctor_id, new Set<string>());
    }

    bookedByDoctor
      .get(appointment.doctor_id)
      ?.add(buildSlotKey(appointment.datetime));
  }

  const specialtyMatches = buildSpecialtyMatches(symptoms);
  const specialtyOrder = Array.from(specialtyMatches.entries());

  const recommendations = mergedDoctors
    .filter((doctor) => specialtyMatches.has(doctor.specialty))
    .map((doctor) => {
      const slots = buildSlots(
        doctor,
        doctor.doctorId
          ? (bookedByDoctor.get(doctor.doctorId) ?? new Set())
          : new Set(),
        slotsPerDoctor,
      );
      const specialtyRank = specialtyOrder.findIndex(
        ([specialty]) => specialty === doctor.specialty,
      );

      return {
        schedule_id: doctor.scheduleId,
        doctor_id: doctor.doctorId,
        doctor_name: doctor.name,
        specialty: doctor.specialty,
        google_calendar_id: doctor.googleCalendarId,
        distance_miles: doctor.locationMiles,
        matched_symptoms: Array.from(
          specialtyMatches.get(doctor.specialty) ?? new Set<string>(),
        ),
        next_available_at: slots[0]?.starts_at ?? null,
        slots,
        specialtyRank:
          specialtyRank === -1 ? Number.MAX_SAFE_INTEGER : specialtyRank,
      };
    })
    .filter((doctor) => doctor.slots.length > 0)
    .sort((a, b) => {
      if (a.specialtyRank !== b.specialtyRank) {
        return a.specialtyRank - b.specialtyRank;
      }

      if (a.distance_miles !== b.distance_miles) {
        return a.distance_miles - b.distance_miles;
      }

      return (
        new Date(a.next_available_at ?? 0).getTime() -
        new Date(b.next_available_at ?? 0).getTime()
      );
    })
    .slice(0, limitDoctors)
    .map(({ specialtyRank, ...doctor }) => doctor);

  return recommendations satisfies DoctorRecommendation[];
}
