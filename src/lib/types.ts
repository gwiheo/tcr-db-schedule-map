export type CellStatus = "empty" | "planned" | "active" | "done" | "blocked";
export type TaskStatus = "planned" | "active" | "done" | "blocked";
export type BranchSide = "left" | "right";

export type Week = {
  index: number;
  start: string;
  end: string;
  month: number;
  label: string;
  rangeLabel: string;
};

export type Stream = {
  id: string;
  title: string;
  shortTitle: string;
  color: string;
  side: BranchSide;
};

export type Task = {
  id: string;
  title: string;
  summary: string;
  streamId: string;
  owner: string;
  startWeek: number;
  endWeek: number;
  notes: string;
  weekStatus: Record<number, CellStatus>;
};

export type Milestone = {
  id: string;
  title: string;
  week: number;
};

export type MindNode = {
  id: string;
  label: string;
  streamId?: string;
  taskId?: string;
  children?: MindNode[];
};

export type PersistedState = {
  version: 1;
  tasks: Task[];
};
