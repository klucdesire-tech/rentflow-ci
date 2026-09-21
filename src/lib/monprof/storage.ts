"use client";

/* Mémoire persistante de l'élève (§18) : cours importés, progression,
   profil d'apprentissage. Tout reste dans le navigateur — aucune donnée
   n'est envoyée ailleurs. */

import type { Course, CourseProgress, LearnerProfile, Diagnostic } from "@/types/monprof";
import { POURCENTAGES, STATISTIQUES } from "./courses";

const K = {
  courses: "monprof.courses.v1",
  progress: "monprof.progress.v1",
  profile: "monprof.profile.v1",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota dépassé ou stockage désactivé : la session continue en mémoire.
  }
}

export const emptyDiagnostic = (): Diagnostic => ({
  level: "",
  goal: "",
  known: "",
  difficulties: "",
  minutes: 0,
  confidence: 0,
  done: false,
});

export const emptyProfile = (): LearnerProfile => ({
  name: "",
  preferredStrategy: null,
  frequentErrors: {},
});

export const newProgress = (courseId: string): CourseProgress => ({
  courseId,
  diagnostic: emptyDiagnostic(),
  memory: {},
  currentConceptId: null,
  turn: 0,
  lastSession: Date.now(),
  lastPosition: "",
});

/** Cours intégrés + cours importés par l'élève. */
export function loadCourses(): Course[] {
  const imported = read<Course[]>(K.courses, []);
  return [POURCENTAGES, STATISTIQUES, ...imported];
}

export function saveImportedCourse(course: Course) {
  const imported = read<Course[]>(K.courses, []);
  write(K.courses, [...imported.filter((c) => c.id !== course.id), course]);
}

export function deleteImportedCourse(courseId: string) {
  write(K.courses, read<Course[]>(K.courses, []).filter((c) => c.id !== courseId));
  const all = read<Record<string, CourseProgress>>(K.progress, {});
  delete all[courseId];
  write(K.progress, all);
}

export function loadProgress(courseId: string): CourseProgress {
  const all = read<Record<string, CourseProgress>>(K.progress, {});
  return all[courseId] ?? newProgress(courseId);
}

export function loadAllProgress(): Record<string, CourseProgress> {
  return read<Record<string, CourseProgress>>(K.progress, {});
}

export function saveProgress(progress: CourseProgress) {
  const all = read<Record<string, CourseProgress>>(K.progress, {});
  all[progress.courseId] = { ...progress, lastSession: Date.now() };
  write(K.progress, all);
}

export function loadProfile(): LearnerProfile {
  return read<LearnerProfile>(K.profile, emptyProfile());
}

export function saveProfile(profile: LearnerProfile) {
  write(K.profile, profile);
}

export function resetCourseProgress(courseId: string) {
  const all = read<Record<string, CourseProgress>>(K.progress, {});
  all[courseId] = newProgress(courseId);
  write(K.progress, all);
}
