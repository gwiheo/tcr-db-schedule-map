"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CELL_CYCLE, CELL_LABEL, STATUS_LABEL, cellOf, streamMapOf, taskProgress, taskStatus } from "@/lib/schedule-data";
import type { CellStatus, Stream, Task } from "@/lib/types";
import { WEEKS } from "@/lib/weeks";

type TaskDetailPanelProps = {
  task: Task;
  streams: Stream[];
  currentWeek: number;
  onClose: () => void;
  onChangeTitle: (title: string) => void;
  onChangeNotes: (notes: string) => void;
  onChangeOwner: (owner: string) => void;
  onSetCell: (week: number, status: CellStatus) => void;
  onMarkAll: (status: CellStatus) => void;
};

export function TaskDetailPanel({
  task,
  streams,
  currentWeek,
  onClose,
  onChangeTitle,
  onChangeNotes,
  onChangeOwner,
  onSetCell,
  onMarkAll,
}: TaskDetailPanelProps) {
  const stream = streamMapOf(streams)[task.streamId];
  const status = taskStatus(task);

  return (
    <div data-testid="task-detail" className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium" style={{ color: stream?.color }}>
          {stream?.title}
        </p>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="상세 닫기">
          닫기
        </Button>
      </div>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">업무 제목</span>
        <input
          data-testid="task-title-input"
          value={task.title}
          onChange={(e) => onChangeTitle(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-2.5 text-base font-semibold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>
      <p className="text-sm text-muted-foreground">{task.summary}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-muted px-2 py-0.5">{STATUS_LABEL[status]}</span>
        <span className="text-muted-foreground">진척 {taskProgress(task)}%</span>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">담당</span>
        <input
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={task.owner}
          onChange={(e) => onChangeOwner(e.target.value)}
        />
      </label>
      <div>
        <div className="mb-2 text-sm text-muted-foreground">주간 진행 (칸을 눌러 변경)</div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {WEEKS.filter((w) => w.index >= task.startWeek - 1 && w.index <= task.endWeek + 1).map((week) => {
            const cell = cellOf(task, week.index);
            const inPlan = week.index >= task.startWeek && week.index <= task.endWeek;
            return (
              <button
                key={week.index}
                type="button"
                data-testid={`detail-week-${week.index}`}
                onClick={() => {
                  const idx = CELL_CYCLE.indexOf(cell === "empty" ? "planned" : cell);
                  const next = cell === "empty" ? "planned" : CELL_CYCLE[(idx + 1) % CELL_CYCLE.length];
                  onSetCell(week.index, next);
                }}
                className="rounded-md border px-1.5 py-1 text-left text-[11px] leading-4 hover:bg-muted"
                style={{
                  borderColor: week.index === currentWeek ? "#d97706" : undefined,
                  backgroundColor:
                    cell === "done"
                      ? `${stream?.color}22`
                      : cell === "blocked"
                        ? "#ffe4e6"
                        : cell === "active"
                          ? `${stream?.color}33`
                          : undefined,
                  opacity: inPlan || cell !== "empty" ? 1 : 0.45,
                }}
              >
                <div className="font-medium">{week.label}</div>
                <div className="text-muted-foreground">{CELL_LABEL[cell]}</div>
              </button>
            );
          })}
        </div>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">메모</span>
        <textarea
          className="min-h-24 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={task.notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          placeholder="이번 구간 결정, 리스크, 의존성을 적어 두세요."
        />
      </label>
      <Separator />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onMarkAll("done")}>
          구간 전부 완료
        </Button>
        <Button size="sm" variant="outline" onClick={() => onMarkAll("planned")}>
          구간 전부 예정
        </Button>
        <Button size="sm" variant="outline" onClick={() => onMarkAll("blocked")}>
          현재 주 지연
        </Button>
      </div>
    </div>
  );
}
