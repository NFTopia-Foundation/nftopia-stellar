// LocalStorage-based experiment assignment persistence
import { VariantAssignment } from './types';

const STORAGE_KEY = 'experiment_assignments_v1';
const EXPIRY_HOURS = 24;

export function saveAssignments(assignments: Map<string, VariantAssignment>) {
  if (typeof window === 'undefined') return;
  const obj: Record<string, VariantAssignment & { saved_at: number }> = {};
  const now = Date.now();
  assignments.forEach((assignment, key) => {
    obj[key] = { ...assignment, saved_at: now };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

export function loadAssignments(): Map<string, VariantAssignment> | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, VariantAssignment & { saved_at: number }>;
    const now = Date.now();
    const assignments = new Map<string, VariantAssignment>();
    for (const [key, value] of Object.entries(obj)) {
      if (now - value.saved_at < EXPIRY_HOURS * 3600 * 1000) {
        assignments.set(key, value);
      }
    }
    return assignments.size > 0 ? assignments : null;
  } catch {
    return null;
  }
}

export function clearAssignments() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
