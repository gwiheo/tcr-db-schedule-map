import { BASELINE_TASKS } from "./schedule-data";
import type { PersistedState, SavedSchedule, ScheduleLibrary, StoreState, Task } from "./types";

const WORK_KEY = "tcr-db-engine-schedule-v1";
const LIBRARY_KEY = "tcr-db-engine-library-v1";

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

/** Keeps saved progress while picking up title/summary edits shipped in newer baselines. */
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

function isSavedSchedule(value: unknown): value is SavedSchedule {
  if (!value || typeof value !== "object") return false;
  const s = value as SavedSchedule;
  return typeof s.id === "string" && typeof s.name === "string" && Array.isArray(s.tasks);
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readLibrary(): SavedSchedule[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScheduleLibrary;
    if (parsed.version !== 1 || !Array.isArray(parsed.snapshots)) return [];
    return parsed.snapshots.filter(isSavedSchedule).map((s) => ({
      ...s,
      savedAt: s.savedAt ?? new Date().toISOString(),
      tasks: mergeSaved(s.tasks),
    }));
  } catch {
    return [];
  }
}

function writeLibrary(snapshots: SavedSchedule[]) {
  const payload: ScheduleLibrary = { version: 1, snapshots };
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(payload));
}

function readWorkingCopy(): { state: Omit<StoreState, "snapshots">; } {
  const empty = {
    tasks: structuredClone(BASELINE_TASKS),
    activeId: null,
    activeName: null,
    dirty: false,
    error: null,
  };
  try {
    const raw = localStorage.getItem(WORK_KEY);
    if (!raw) return { state: empty };
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== 1 || !Array.isArray(parsed.tasks)) {
      return { state: { ...empty, error: "저장된 일정이 손상되어 기본 계획으로 되돌렸습니다." } };
    }
    return {
      state: {
        tasks: mergeSaved(parsed.tasks),
        activeId: parsed.activeId ?? null,
        activeName: parsed.activeName ?? null,
        dirty: parsed.dirty ?? false,
        error: null,
      },
    };
  } catch {
    return { state: { ...empty, error: "저장된 일정을 읽지 못해 기본 계획으로 되돌렸습니다." } };
  }
}

const SERVER_STATE: StoreState = {
  tasks: BASELINE_TASKS,
  activeId: null,
  activeName: null,
  dirty: false,
  snapshots: [],
  error: null,
};

let state: StoreState | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeStore(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStoreState(): StoreState {
  if (!state) {
    const { state: work } = readWorkingCopy();
    state = { ...work, snapshots: readLibrary() };
  }
  return state;
}

export function getServerState(): StoreState {
  return SERVER_STATE;
}

function persistWorkingCopy(next: StoreState) {
  const payload: PersistedState = {
    version: 1,
    tasks: next.tasks,
    activeId: next.activeId,
    activeName: next.activeName,
    dirty: next.dirty,
  };
  localStorage.setItem(WORK_KEY, JSON.stringify(payload));
}

function commit(patch: Partial<StoreState>, options: { persistLibrary?: boolean } = {}) {
  const next: StoreState = { ...getStoreState(), ...patch };
  try {
    persistWorkingCopy(next);
    if (options.persistLibrary) writeLibrary(next.snapshots);
    next.error = patch.error ?? null;
  } catch {
    next.error = "브라우저 저장 공간이 가득 차 저장하지 못했습니다.";
  }
  state = next;
  emit();
}

export function updateTasks(tasks: Task[]) {
  commit({ tasks, dirty: true });
}

/** Returns the name actually used; a duplicate gets a numeric suffix. */
function uniqueName(name: string, snapshots: SavedSchedule[], ignoreId?: string) {
  const taken = new Set(snapshots.filter((s) => s.id !== ignoreId).map((s) => s.name));
  if (!taken.has(name)) return name;
  let n = 2;
  while (taken.has(`${name} (${n})`)) n += 1;
  return `${name} (${n})`;
}

export function saveAsNewSchedule(rawName: string): SavedSchedule {
  const current = getStoreState();
  const name = uniqueName(rawName.trim() || "이름 없는 스케줄", current.snapshots);
  const snapshot: SavedSchedule = {
    id: newId(),
    name,
    savedAt: new Date().toISOString(),
    tasks: structuredClone(current.tasks),
  };
  commit(
    {
      snapshots: [snapshot, ...current.snapshots],
      activeId: snapshot.id,
      activeName: snapshot.name,
      dirty: false,
    },
    { persistLibrary: true },
  );
  return snapshot;
}

/** Overwrites the schedule currently loaded. Returns false when nothing is loaded yet. */
export function saveActiveSchedule(): boolean {
  const current = getStoreState();
  if (!current.activeId) return false;
  const snapshots = current.snapshots.map((s) =>
    s.id === current.activeId
      ? { ...s, savedAt: new Date().toISOString(), tasks: structuredClone(current.tasks) }
      : s,
  );
  commit({ snapshots, dirty: false }, { persistLibrary: true });
  return true;
}

export function loadSchedule(id: string): boolean {
  const current = getStoreState();
  const snapshot = current.snapshots.find((s) => s.id === id);
  if (!snapshot) return false;
  commit({
    tasks: mergeSaved(structuredClone(snapshot.tasks)),
    activeId: snapshot.id,
    activeName: snapshot.name,
    dirty: false,
  });
  return true;
}

export function renameSchedule(id: string, rawName: string) {
  const current = getStoreState();
  const name = uniqueName(rawName.trim() || "이름 없는 스케줄", current.snapshots, id);
  const snapshots = current.snapshots.map((s) => (s.id === id ? { ...s, name } : s));
  commit(
    {
      snapshots,
      activeName: current.activeId === id ? name : current.activeName,
    },
    { persistLibrary: true },
  );
}

export function deleteSchedule(id: string) {
  const current = getStoreState();
  const snapshots = current.snapshots.filter((s) => s.id !== id);
  const wasActive = current.activeId === id;
  commit(
    {
      snapshots,
      activeId: wasActive ? null : current.activeId,
      activeName: wasActive ? null : current.activeName,
      dirty: wasActive ? true : current.dirty,
    },
    { persistLibrary: true },
  );
}

export function resetToBaseline() {
  commit({
    tasks: structuredClone(BASELINE_TASKS),
    activeId: null,
    activeName: null,
    dirty: false,
    error: null,
  });
}

export function exportPayload(id?: string): { filename: string; json: string } | null {
  const current = getStoreState();
  if (id) {
    const snapshot = current.snapshots.find((s) => s.id === id);
    if (!snapshot) return null;
    return {
      filename: `${snapshot.name.replace(/[^\w가-힣 -]/g, "_")}.json`,
      json: JSON.stringify({ version: 1, snapshots: [snapshot] }, null, 2),
    };
  }
  const name = current.activeName ?? "TCR DB 엔진 스케줄";
  const snapshot: SavedSchedule = {
    id: current.activeId ?? newId(),
    name,
    savedAt: new Date().toISOString(),
    tasks: current.tasks,
  };
  return {
    filename: `${name.replace(/[^\w가-힣 -]/g, "_")}.json`,
    json: JSON.stringify({ version: 1, snapshots: [snapshot] }, null, 2),
  };
}

/** Accepts a full library export or a single snapshot; imported entries are always added, never overwritten. */
export function importFromJson(text: string): { added: number; error: string | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { added: 0, error: "JSON 파일을 읽지 못했습니다." };
  }
  const candidates: unknown[] = Array.isArray(parsed)
    ? parsed
    : isSavedSchedule(parsed)
      ? [parsed]
      : Array.isArray((parsed as ScheduleLibrary)?.snapshots)
        ? (parsed as ScheduleLibrary).snapshots
        : [];
  const valid = candidates.filter(isSavedSchedule);
  if (valid.length === 0) {
    return { added: 0, error: "이 파일에서 불러올 스케줄을 찾지 못했습니다." };
  }
  const current = getStoreState();
  let snapshots = current.snapshots;
  for (const item of valid) {
    const snapshot: SavedSchedule = {
      id: newId(),
      name: uniqueName(item.name.trim() || "가져온 스케줄", snapshots),
      savedAt: item.savedAt ?? new Date().toISOString(),
      tasks: mergeSaved(item.tasks),
    };
    snapshots = [snapshot, ...snapshots];
  }
  commit({ snapshots }, { persistLibrary: true });
  return { added: valid.length, error: null };
}
