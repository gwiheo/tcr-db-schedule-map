"use client";

import type { CSSProperties } from "react";

import {
  CELL_LABEL,
  MILESTONES,
  STATUS_LABEL,
  cellOf,
  streamMapOf,
  taskProgress,
  taskStatus,
} from "@/lib/schedule-data";
import type { CellStatus, Stream, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { monthGroups, WEEKS } from "@/lib/weeks";

const months = monthGroups();

function statusClass(status: ReturnType<typeof taskStatus>) {
  switch (status) {
    case "done":
      return "bg-emerald-50 text-emerald-800";
    case "active":
      return "bg-sky-50 text-sky-800";
    case "blocked":
      return "bg-rose-50 text-rose-800";
    default:
      return "bg-stone-100 text-stone-600";
  }
}

function cellStyle(color: string, status: CellStatus, isCurrent: boolean) {
  if (status === "empty") {
    return {
        className: cn("h-9 w-9 rounded-sm border border-transparent", isCurrent && "bg-amber-50"),
      style: undefined as CSSProperties | undefined,
    };
  }
  const map: Record<Exclude<CellStatus, "empty">, { bg: string; extra: string }> = {
    planned: { bg: `${color}33`, extra: "" },
    active: { bg: `${color}cc`, extra: "ring-2 ring-offset-1 ring-black/20" },
    done: { bg: color, extra: "" },
    blocked: { bg: "#e11d48", extra: "" },
  };
  const m = map[status];
  return {
    className: cn(
      "h-9 w-9 rounded-sm border border-black/10 text-[11px] font-semibold text-white",
      m.extra,
      isCurrent && "outline outline-2 outline-amber-400",
    ),
        style: { backgroundColor: m.bg } as CSSProperties,
  };
}

function cellMark(status: CellStatus) {
  if (status === "done") return "✓";
  if (status === "active") return "▶";
  if (status === "blocked") return "!";
  return "";
}

type ScheduleTableProps = {
  tasks: Task[];
  streams: Stream[];
  currentWeek: number;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onCycleCell: (taskId: string, week: number) => void;
  emptyMessage?: string;
};

export function ScheduleTable({
  tasks,
  streams,
  currentWeek,
  selectedTaskId,
  onSelectTask,
  onCycleCell,
  emptyMessage,
}: ScheduleTableProps) {
  const streamMap = streamMapOf(streams);
  const byStream = new Map<string, Task[]>();
  for (const task of tasks) {
    const list = byStream.get(task.streamId) ?? [];
    list.push(task);
    byStream.set(task.streamId, list);
  }

  return (
    <div className="overflow-auto rounded-xl border bg-card">
      <table className="min-w-max border-collapse text-sm">
        <thead className="sticky top-0 z-20">
          <tr className="bg-stone-100 text-stone-600">
            <th
              rowSpan={2}
              className="sticky left-0 z-30 min-w-[168px] border-b border-r bg-stone-100 px-3 text-left font-medium"
            >
              업무
            </th>
            <th
              rowSpan={2}
              className="sticky left-[168px] z-30 min-w-[72px] border-b border-r bg-stone-100 px-2 text-left font-medium"
            >
              담당
            </th>
            <th
              rowSpan={2}
              className="sticky left-[240px] z-30 min-w-[64px] border-b border-r bg-stone-100 px-2 text-left font-medium"
            >
              상태
            </th>
            {months.map((g) => (
              <th
                key={g.month}
                colSpan={g.count}
                className="border-b border-l px-1 py-1.5 text-center text-xs font-semibold tracking-wide"
              >
                {g.month}월
              </th>
            ))}
          </tr>
          <tr className="bg-stone-50 text-[11px] text-stone-500">
            {WEEKS.map((week) => (
              <th
                key={week.index}
                className={cn(
                  "border-b border-l px-0 py-1 text-center font-medium",
                  week.index === currentWeek && "bg-amber-100 text-amber-900",
                )}
              >
                <div>{week.label}</div>
                {week.index === currentWeek ? <div className="text-[9px] font-bold">이번 주</div> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="bg-white">
            <td
              className="sticky left-0 z-10 border-b border-r bg-white px-3 py-2 text-xs font-medium text-stone-500"
              colSpan={3}
            >
              마일스톤
            </td>
            {WEEKS.map((week) => {
              const marks = MILESTONES.filter((m) => m.week === week.index);
              return (
                <td
                  key={week.index}
                  className={cn(
                    "border-b border-l px-0 py-1 text-center",
                    week.index === currentWeek && "bg-amber-50",
                  )}
                >
                  {marks.map((m) => (
                    <div
                      key={m.id}
                      title={m.title}
                      className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-stone-800 text-[9px] font-bold text-white"
                    >
                      M{m.id.slice(1)}
                    </div>
                  ))}
                </td>
              );
            })}
          </tr>
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={3 + WEEKS.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                {emptyMessage ?? "표시할 일정이 없습니다."}
              </td>
            </tr>
          ) : (
            [...byStream.entries()].map(([streamId, streamTasks]) => {
              const stream = streamMap[streamId];
              return (
                <StreamRows
                  key={streamId}
                  streamId={streamId}
                  streamTitle={stream?.title ?? streamId}
                  color={stream?.color ?? "#57534e"}
                  tasks={streamTasks}
                  currentWeek={currentWeek}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={onSelectTask}
                  onCycleCell={onCycleCell}
                />
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function StreamRows({
  streamTitle,
  color,
  tasks,
  currentWeek,
  selectedTaskId,
  onSelectTask,
  onCycleCell,
}: {
  streamId: string;
  streamTitle: string;
  color: string;
  tasks: Task[];
  currentWeek: number;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onCycleCell: (taskId: string, week: number) => void;
}) {
  const avg =
    tasks.length === 0 ? 0 : Math.round(tasks.reduce((s, t) => s + taskProgress(t), 0) / tasks.length);
  return (
    <>
      <tr>
        <td
          colSpan={3 + WEEKS.length}
          className="border-b px-3 py-1.5 text-xs font-semibold tracking-wide text-white"
          style={{ backgroundColor: color }}
        >
          {streamTitle}
          <span className="ml-2 font-normal opacity-80">평균 {avg}%</span>
        </td>
      </tr>
      {tasks.map((task) => {
        const status = taskStatus(task);
        const selected = selectedTaskId === task.id;
        return (
          <tr
            key={task.id}
            id={`task-row-${task.id}`}
            className={cn("group", selected && "bg-amber-50/60")}
          >
            <td
              className={cn(
                "sticky left-0 z-10 border-b border-r bg-card px-3 py-1.5 align-middle",
                selected && "bg-amber-50",
              )}
            >
              <button
                type="button"
                data-testid={`task-open-${task.id}`}
                className="block w-full text-left"
                onClick={() => onSelectTask(task.id)}
              >
                <div className="font-medium leading-5 underline-offset-2 group-hover:underline">{task.title}</div>
                <div className="text-[11px] text-muted-foreground">상세 보기</div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200">
                  <div className="h-full rounded-full" style={{ width: `${taskProgress(task)}%`, backgroundColor: color }} />
                </div>
              </button>
            </td>
            <td
              className={cn(
                "sticky left-[168px] z-10 max-w-[72px] truncate border-b border-r bg-card px-2 text-xs text-muted-foreground",
                selected && "bg-amber-50",
              )}
            >
              {task.owner}
            </td>
            <td
              className={cn(
                "sticky left-[240px] z-10 border-b border-r bg-card px-2",
                selected && "bg-amber-50",
              )}
            >
              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", statusClass(status))}>
                {STATUS_LABEL[status]}
              </span>
            </td>
            {WEEKS.map((week) => {
              const statusCell = cellOf(task, week.index);
              const visual = cellStyle(color, statusCell, week.index === currentWeek);
              return (
                <td
                  key={week.index}
                  className={cn("border-b border-l p-0.5", week.index === currentWeek && "bg-amber-50")}
                >
                  <button
                    type="button"
                    data-testid={`week-cell-${task.id}-${week.index}`}
                    title={`${task.title} · ${week.rangeLabel} · ${CELL_LABEL[statusCell]} — 클릭하여 변경`}
                    aria-label={`${task.title} ${week.rangeLabel} ${CELL_LABEL[statusCell]}`}
                    className={cn("mx-auto flex cursor-pointer items-center justify-center hover:brightness-95", visual.className)}
                    style={visual.style}
                    onClick={() => onCycleCell(task.id, week.index)}
                  >
                    {cellMark(statusCell)}
                  </button>
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
