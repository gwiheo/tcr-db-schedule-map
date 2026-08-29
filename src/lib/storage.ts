import { BASELINE_ROOT_LABEL, BASELINE_STREAMS, BASELINE_TASKS } from "./schedule-data";
import type { BranchSide, PersistedState, SavedSchedule, ScheduleLibrary, Stream, StoreState, Task } from "./types";

const WORK_KEY = "tcr-db-engine-schedule-v1";
const LIBRARY_KEY = "tcr-db-engine-library-v1";

const EXTRA_STREAM_COLORS = [
  "#0d9488",
  "#db2777",
  "#65a30d",
  "#c026d3",
  "#ea580c",
  "#0284c7",
  "#ca8a04",
  "#4f46e5",
  "#64748b",
  "#9333ea",
];

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

function isStream(value: unknown): value is Stream {
  return Boolean(value && typeof value === "object" && typeof (value as Stream).id === "string");
}

function normalizeStream(raw: Stream, fallback?: Stream): Stream {
  const title = (raw.title ?? fallback?.title ?? "새 영역").trim() || "새 영역";
  const shortTitle = (raw.shortTitle ?? fallback?.shortTitle ?? title).trim() || title;
  const color = /^#[0-9a-fA-F]{6}$/.test(raw.color ?? "") ? (raw.color as string) : (fallback?.color ?? "#64748b");
  const side: BranchSide =
    raw.side === "left" || raw.side === "right" ? raw.side : (fallback?.side ?? "right");
  return { id: raw.id, title, shortTitle, color, side };
}

/**
 * Preserves saved stream order and membership so added areas stay and deleted
 * baseline areas do not come back on reload.
 */
function mergeStreams(savedList: Stream[] | undefined): Stream[] {
  const baseById = new Map(BASELINE_STREAMS.map((s) => [s.id, s]));
  if (!Array.isArray(savedList)) return structuredClone(BASELINE_STREAMS);

  const seen = new Set<string>();
  const out: Stream[] = [];
  for (const raw of savedList) {
    if (!isStream(raw) || seen.has(raw.id)) continue;
    seen.add(raw.id);
    out.push(normalizeStream(raw, baseById.get(raw.id)));
  }
  return out.length ? out : structuredClone(BASELINE_STREAMS);
}

/** Keeps saved edits and extra tasks; drops work whose area no longer exists. */
function mergeSaved(savedList: Task[] | undefined, streams: Stream[]): Task[] {
  const streamIds = new Set(streams.map((s) => s.id));
  const fallbackStreamId = streams[0]?.id;
  const baseById = new Map(BASELINE_TASKS.map((t) => [t.id, t]));

  if (!Array.isArray(savedList)) {
    return BASELINE_TASKS.filter((t) => streamIds.has(t.streamId)).map((t) => structuredClone(t));
  }

  const seen = new Set<string>();
  const out: Task[] = [];

  for (const prev of savedList.filter(isTask)) {
    if (seen.has(prev.id)) continue;
    const base = baseById.get(prev.id);
    const streamId =
      prev.streamId && streamIds.has(prev.streamId)
        ? prev.streamId
        : base && streamIds.has(base.streamId)
          ? base.streamId
          : fallbackStreamId;
    if (!streamId || !streamIds.has(streamId)) continue;
    seen.add(prev.id);
    out.push({
      id: prev.id,
      title: prev.title?.trim() || base?.title || "작업",
      summary: prev.summary ?? base?.summary ?? "",
      streamId,
      owner: prev.owner || base?.owner || "",
      startWeek: Number.isFinite(prev.startWeek) ? prev.startWeek : (base?.startWeek ?? 0),
      endWeek: Number.isFinite(prev.endWeek) ? prev.endWeek : (base?.endWeek ?? 0),
      notes: prev.notes ?? base?.notes ?? "",
      weekStatus: { ...(base?.weekStatus ?? {}), ...prev.weekStatus },
    });
  }

  for (const base of BASELINE_TASKS) {
    if (seen.has(base.id) || !streamIds.has(base.streamId)) continue;
    seen.add(base.id);
    out.push(structuredClone(base));
  }

  return out;
}

function hydrate(tasks: Task[] | undefined, streams: Stream[] | undefined) {
  const nextStreams = mergeStreams(streams);
  return { streams: nextStreams, tasks: mergeSaved(tasks, nextStreams) };
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
    return parsed.snapshots.filter(isSavedSchedule).map((s) => {
      const hydrated = hydrate(s.tasks, s.streams);
      return {
        ...s,
        savedAt: s.savedAt ?? new Date().toISOString(),
        tasks: hydrated.tasks,
        streams: hydrated.streams,
        rootLabel: s.rootLabel?.trim() || BASELINE_ROOT_LABEL,
      };
    });
  } catch {
    return [];
  }
}

function writeLibrary(snapshots: SavedSchedule[]) {
  const payload: ScheduleLibrary = { version: 1, snapshots };
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(payload));
}

function readWorkingCopy(): { state: Omit<StoreState, "snapshots"> } {
  const empty = {
    tasks: structuredClone(BASELINE_TASKS),
    streams: structuredClone(BASELINE_STREAMS),
    rootLabel: BASELINE_ROOT_LABEL,
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
    const hydrated = hydrate(parsed.tasks, parsed.streams);
    return {
      state: {
        tasks: hydrated.tasks,
        streams: hydrated.streams,
        rootLabel: parsed.rootLabel?.trim() || BASELINE_ROOT_LABEL,
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
  streams: BASELINE_STREAMS,
  rootLabel: BASELINE_ROOT_LABEL,
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
    streams: next.streams,
    rootLabel: next.rootLabel,
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

export function updateStream(
  id: string,
  patch: Partial<Pick<Stream, "title" | "shortTitle" | "color" | "side">>,
) {
  const current = getStoreState();
  const streams = current.streams.map((s) => (s.id === id ? { ...s, ...patch } : s));
  commit({ streams, dirty: true });
}

export function updateRootLabel(rootLabel: string) {
  commit({ rootLabel, dirty: true });
}

/** Restores labels and colors of original areas. Added/removed areas stay as they are. */
export function resetStreamNames() {
  const current = getStoreState();
  const baseById = new Map(BASELINE_STREAMS.map((s) => [s.id, s]));
  const streams = current.streams.map((s) => {
    const base = baseById.get(s.id);
    if (!base) return s;
    return { ...s, title: base.title, shortTitle: base.shortTitle, color: base.color, side: base.side };
  });
  commit({ streams, rootLabel: BASELINE_ROOT_LABEL, dirty: true });
}

function uniqueLabel(existing: string[], base: string) {
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

function pickStreamColor(streams: Stream[]) {
  const used = new Set(streams.map((s) => s.color.toLowerCase()));
  const palette = [...BASELINE_STREAMS.map((s) => s.color), ...EXTRA_STREAM_COLORS];
  return palette.find((c) => !used.has(c.toLowerCase())) ?? palette[streams.length % palette.length];
}

export function addStream(): Stream {
  const current = getStoreState();
  const leftCount = current.streams.filter((s) => s.side === "left").length;
  const rightCount = current.streams.length - leftCount;
  const stream: Stream = {
    id: newId(),
    title: uniqueLabel(
      current.streams.map((s) => s.title),
      "새 영역",
    ),
    shortTitle: uniqueLabel(
      current.streams.map((s) => s.shortTitle),
      "새 영역",
    ),
    color: pickStreamColor(current.streams),
    side: leftCount <= rightCount ? "left" : "right",
  };
  commit({ streams: [...current.streams, stream], dirty: true });
  return stream;
}

/** Removes an area and every task in it. Refuses to delete the last remaining area. */
export function deleteStream(id: string): boolean {
  const current = getStoreState();
  if (current.streams.length <= 1) return false;
  if (!current.streams.some((s) => s.id === id)) return false;
  commit({
    streams: current.streams.filter((s) => s.id !== id),
    tasks: current.tasks.filter((t) => t.streamId !== id),
    dirty: true,
  });
  return true;
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
    streams: structuredClone(current.streams),
    rootLabel: current.rootLabel,
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
      ? {
          ...s,
          savedAt: new Date().toISOString(),
          tasks: structuredClone(current.tasks),
          streams: structuredClone(current.streams),
          rootLabel: current.rootLabel,
        }
      : s,
  );
  commit({ snapshots, dirty: false }, { persistLibrary: true });
  return true;
}

export function loadSchedule(id: string): boolean {
  const current = getStoreState();
  const snapshot = current.snapshots.find((s) => s.id === id);
  if (!snapshot) return false;
  const hydrated = hydrate(structuredClone(snapshot.tasks), snapshot.streams);
  commit({
    tasks: hydrated.tasks,
    streams: hydrated.streams,
    rootLabel: snapshot.rootLabel?.trim() || BASELINE_ROOT_LABEL,
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
    streams: structuredClone(BASELINE_STREAMS),
    rootLabel: BASELINE_ROOT_LABEL,
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
  const name = current.activeName ?? `${current.rootLabel} 스케줄`;
  const snapshot: SavedSchedule = {
    id: current.activeId ?? newId(),
    name,
    savedAt: new Date().toISOString(),
    tasks: current.tasks,
    streams: current.streams,
    rootLabel: current.rootLabel,
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
    const hydrated = hydrate(item.tasks, item.streams);
    const snapshot: SavedSchedule = {
      id: newId(),
      name: uniqueName(item.name.trim() || "가져온 스케줄", snapshots),
      savedAt: item.savedAt ?? new Date().toISOString(),
      tasks: hydrated.tasks,
      streams: hydrated.streams,
      rootLabel: item.rootLabel?.trim() || BASELINE_ROOT_LABEL,
    };
    snapshots = [snapshot, ...snapshots];
  }
  commit({ snapshots }, { persistLibrary: true });
  return { added: valid.length, error: null };
}
