import { BASELINE_TASKS } from "./schedule-data";
import type { PersistedState, Task } from "./types";

const KEY = "tcr-db-engine-schedule-v1";

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;
  const t = value as Task;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.streamId === "string" &&
    typeof t.weekStatus === "object" &&
    t.weekStatus !== null
  );
}

function mergeSaved(savedList: Task[]): Task[] {
  const saved = new Map(savedList.filter(isTask).map((t) => [t.id, t]));
  return BASELINE_TASKS.map((base) => {
    const prev = saved.get(base.id);
    if (!prev) return structuredClone(base);
    return {
      ...base,
      ...prev,
      id: base.id,
      title: base.title,
      summary: base.summary,
      streamId: base.streamId,
      startWeek: prev.startWeek,
      endWeek: prev.endWeek,
      owner: prev.owner || base.owner,
      notes: prev.notes ?? base.notes,
      weekStatus: { ...base.weekStatus, ...prev.weekStatus },
    };
  });
}

export function readStoredTasks(): { tasks: Task[]; error: string | null } {
  if (typeof window === "undefined") return { tasks: structuredClone(BASELINE_TASKS), error: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { tasks: structuredClone(BASELINE_TASKS), error: null };
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== 1 || !Array.isArray(parsed.tasks)) {
      return {
        tasks: structuredClone(BASELINE_TASKS),
        error: "저장된 일정이 손상되어 기본 계획으로 되돌렸습니다.",
      };
    }
    return { tasks: mergeSaved(parsed.tasks), error: null };
  } catch {
    return {
      tasks: structuredClone(BASELINE_TASKS),
      error: "저장된 일정을 읽지 못해 기본 계획으로 되돌렸습니다.",
    };
  }
}

export function writeStoredTasks(tasks: Task[]) {
  const payload: PersistedState = { version: 1, tasks };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function clearStoredTasks() {
  localStorage.removeItem(KEY);
}

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: Task[] | null = null;
let cacheError: string | null = null;

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeTasks(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getClientTasks() {
  if (!cache) {
    const loaded = readStoredTasks();
    cache = loaded.tasks;
    cacheError = loaded.error;
  }
  return cache;
}

export function getClientError() {
  getClientTasks();
  return cacheError;
}

export function getServerTasks() {
  return BASELINE_TASKS;
}

export function commitTasks(tasks: Task[]) {
  cache = tasks;
  cacheError = null;
  writeStoredTasks(tasks);
  emit();
}

export function resetTasks() {
  clearStoredTasks();
  cache = structuredClone(BASELINE_TASKS);
  cacheError = null;
  emit();
}

