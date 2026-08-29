"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { RotateCcw, X } from "lucide-react";

import { MindMap } from "@/components/mind-map";
import { ScheduleLibraryBar } from "@/components/schedule-library";
import { ScheduleTable } from "@/components/schedule-table";
import { TaskDetailPanel } from "@/components/task-detail-panel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  CELL_LABEL,
  MIND_TREE,
  STATUS_LABEL,
  STREAMS,
  STREAM_MAP,
  cellOf,
  descendantTaskIds,
  findNode,
  nextCellStatus,
  taskProgress,
  taskStatus,
} from "@/lib/schedule-data";
import {
  deleteSchedule,
  exportPayload,
  getServerState,
  getStoreState,
  importFromJson,
  loadSchedule,
  renameSchedule,
  resetToBaseline,
  saveActiveSchedule,
  saveAsNewSchedule,
  subscribeStore,
  updateTasks,
} from "@/lib/storage";
import type { CellStatus, Task } from "@/lib/types";
import { currentWeekIndex, WEEKS } from "@/lib/weeks";
import { cn } from "@/lib/utils";

export function SchedulerApp() {
  const store = useSyncExternalStore(subscribeStore, getStoreState, getServerState);
  const { tasks, snapshots, activeName, dirty, error } = store;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [thisWeekOnly, setThisWeekOnly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveAsHint, setSaveAsHint] = useState(false);
  const nowWeek = currentWeekIndex();

  const selectedNode = selectedNodeId ? findNode(MIND_TREE, selectedNodeId) : null;
  const selectedStreamId =
    selectedNodeId?.startsWith("stream-") ? selectedNodeId.slice("stream-".length) : selectedNode?.streamId;

  const highlightedTaskIds = useMemo(() => {
    if (!selectedNode || selectedNode.id === "root") return new Set<string>();
    const ids = descendantTaskIds(selectedNode);
    if (ids.length === 0 && selectedStreamId) {
      return new Set(tasks.filter((t) => t.streamId === selectedStreamId).map((t) => t.id));
    }
    return new Set(ids);
  }, [selectedNode, selectedStreamId, tasks]);

  const visibleTasks = useMemo(() => {
    let list = tasks;
    if (selectedStreamId) {
      list = list.filter((t) => t.streamId === selectedStreamId);
    } else if (highlightedTaskIds.size > 0) {
      list = list.filter((t) => highlightedTaskIds.has(t.id));
    }
    if (thisWeekOnly) {
      list = list.filter((t) => cellOf(t, nowWeek) !== "empty");
    }
    return list;
  }, [tasks, selectedStreamId, highlightedTaskIds, thisWeekOnly, nowWeek]);

  const stats = useMemo(() => {
    const counts = { planned: 0, active: 0, done: 0, blocked: 0 };
    let progressSum = 0;
    for (const task of tasks) {
      counts[taskStatus(task)] += 1;
      progressSum += taskProgress(task);
    }
    return {
      ...counts,
      overall: tasks.length ? Math.round(progressSum / tasks.length) : 0,
    };
  }, [tasks]);

  const currentWeek = WEEKS[nowWeek];
  const thisWeekTasks = tasks.filter((t) => cellOf(t, nowWeek) !== "empty");
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const activeStream = selectedStreamId ? STREAM_MAP[selectedStreamId] : null;

  function patchTask(id: string, updater: (task: Task) => Task) {
    updateTasks(tasks.map((t) => (t.id === id ? updater(t) : t)));
  }

  function cycleCell(taskId: string, week: number) {
    patchTask(taskId, (task) => {
      const current = cellOf(task, week);
      return { ...task, weekStatus: { ...task.weekStatus, [week]: nextCellStatus(current) } };
    });
  }

  function setCell(taskId: string, week: number, status: CellStatus) {
    patchTask(taskId, (task) => ({
      ...task,
      weekStatus: { ...task.weekStatus, [week]: status },
    }));
  }

  function markAll(taskId: string, status: CellStatus) {
    patchTask(taskId, (task) => {
      const weekStatus = { ...task.weekStatus };
      if (status === "blocked") {
        weekStatus[nowWeek] = "blocked";
      } else {
        for (let i = task.startWeek; i <= task.endWeek; i++) weekStatus[i] = status;
      }
      return { ...task, weekStatus };
    });
  }

  function resetPlan() {
    resetToBaseline();
    setSelectedNodeId(null);
    setSelectedTaskId(null);
    setNotice("기본 계획으로 되돌렸습니다. 저장된 스케줄은 그대로 남아 있습니다.");
  }

  function handleSave() {
    if (saveActiveSchedule()) {
      setSaveAsHint(false);
      setNotice(`「${activeName}」에 저장했습니다.`);
      return;
    }
    setSaveAsHint(true);
    setNotice("아직 이름이 없습니다. 「다른 이름으로 저장」으로 이름을 정해 주세요.");
  }

  function handleSaveAs(name: string) {
    const snapshot = saveAsNewSchedule(name);
    setSaveAsHint(false);
    setNotice(`「${snapshot.name}」(으)로 저장했습니다.`);
  }

  function handleLoad(id: string) {
    const snapshot = snapshots.find((s) => s.id === id);
    if (dirty && !window.confirm("저장하지 않은 변경이 있습니다. 불러오면 지금 화면의 변경은 사라집니다. 계속할까요?")) {
      return;
    }
    if (loadSchedule(id)) {
      setSelectedTaskId(null);
      setNotice(`「${snapshot?.name}」을 불러왔습니다.`);
    }
  }

  function handleExport(id?: string) {
    const payload = exportPayload(id);
    if (!payload) return;
    const url = URL.createObjectURL(new Blob([payload.json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = payload.filename;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(`${payload.filename} 파일로 내려받았습니다.`);
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const result = importFromJson(text);
    setNotice(result.error ?? `${result.added}개 스케줄을 목록에 추가했습니다.`);
  }

  const detail = selectedTask ? (
    <TaskDetailPanel
      task={selectedTask}
      currentWeek={nowWeek}
      onClose={() => setSelectedTaskId(null)}
      onChangeNotes={(notes) => patchTask(selectedTask.id, (t) => ({ ...t, notes }))}
      onChangeOwner={(owner) => patchTask(selectedTask.id, (t) => ({ ...t, owner }))}
      onSetCell={(week, status) => setCell(selectedTask.id, week, status)}
      onMarkAll={(status) => markAll(selectedTask.id, status)}
    />
  ) : null;

  return (
    <TooltipProvider>
      <div className="flex min-h-full flex-1 flex-col bg-[oklch(0.975_0.01_85)]">
        <header className="border-b bg-card/90 px-4 py-4 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-medium tracking-[0.18em] text-stone-500 uppercase">
                  TCR DB Engine · 2026 H2
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  TCR DB 엔진 개발 스케줄
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  8월부터 12월까지 22주 전체 트랙입니다. 주간 업무 보고가 아니라, 스토리지·쿼리·트랜잭션·복제 경로가
                  매주 어떻게 겹치는지 한 판에서 관리합니다.
                </p>
              </div>
              <div className="min-w-[240px]">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>전체 진척</span>
                  <span className="font-semibold text-foreground">{stats.overall}%</span>
                </div>
                <Progress value={stats.overall} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["done", "active", "planned", "blocked"] as const).map((key) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs"
                >
                  <span className="font-medium">{STATUS_LABEL[key]}</span>
                  <span className="text-muted-foreground">{stats[key]}</span>
                </span>
              ))}
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-950">
                {currentWeek
                  ? `이번 주 ${currentWeek.month}월 ${currentWeek.label} (${currentWeek.rangeLabel})`
                  : nowWeek < 0
                    ? "일정 시작 전"
                    : "12월 일정 종료"}
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
          ) : null}

          <ScheduleLibraryBar
            activeName={activeName}
            dirty={dirty}
            snapshots={snapshots}
            highlightSaveAs={saveAsHint}
            onSave={handleSave}
            onSaveAs={handleSaveAs}
            onLoad={handleLoad}
            onRename={renameSchedule}
            onDelete={deleteSchedule}
            onExport={handleExport}
            onImportFile={handleImportFile}
          />
          {notice ? (
            <div
              data-testid="notice"
              className="flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900"
            >
              <span>{notice}</span>
              <Button size="sm" variant="ghost" onClick={() => setNotice(null)} aria-label="알림 닫기">
                <X />
              </Button>
            </div>
          ) : null}

          <section className="flex flex-col gap-2">
            <div className="flex items-end justify-between">
              <h2 className="text-sm font-semibold">개발 마인드맵</h2>
              {selectedNode && selectedNode.id !== "root" ? (
                <Button size="sm" variant="ghost" onClick={() => setSelectedNodeId(null)}>
                  <X data-icon="inline-start" />
                  필터 해제
                </Button>
              ) : null}
            </div>
            <MindMap
              tasks={tasks}
              selectedId={selectedNodeId}
              highlightedTaskIds={highlightedTaskIds}
              onSelect={(id) => {
                setSelectedNodeId(id);
                const node = id ? findNode(MIND_TREE, id) : null;
                if (node?.taskId) {
                  setSelectedTaskId(node.taskId);
                }
              }}
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                data-testid="filter-all"
                className={cn(
                  "h-7 rounded-lg border px-2.5 text-[0.8rem] font-medium",
                  !selectedNodeId || selectedNodeId === "root"
                    ? "border-stone-800 bg-stone-800 text-white"
                    : "border-stone-300 bg-white",
                )}
                onClick={() => setSelectedNodeId(null)}
              >
                전체
              </button>
              {STREAMS.map((stream) => {
                const active = selectedNodeId === `stream-${stream.id}`;
                return (
                  <button
                    key={stream.id}
                    type="button"
                    data-testid={`filter-${stream.id}`}
                    className="h-7 rounded-lg border px-2.5 text-[0.8rem] font-medium"
                    style={
                      active
                        ? { backgroundColor: stream.color, borderColor: stream.color, color: "white" }
                        : { borderColor: stream.color, color: stream.color, backgroundColor: "white" }
                    }
                    onClick={() => setSelectedNodeId(`stream-${stream.id}`)}
                  >
                    {stream.shortTitle}
                  </button>
                );
              })}
            </div>
          </section>

          {detail ? (
            <section className="rounded-xl border bg-card p-4 shadow-sm">{detail}</section>
          ) : null}

          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold">주간 스케줄 테이블 · 8월–12월</h2>
                  {activeStream ? (
                    <p className="text-xs font-medium" style={{ color: activeStream.color }}>
                      {activeStream.title}만 표시 · {visibleTasks.length}개 업무
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      칸을 누르면 예정 → 진행 → 완료 → 지연. 업무 이름 아래 「상세 보기」로 메모를 엽니다.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={thisWeekOnly ? "default" : "outline"}
                    data-testid="this-week-only"
                    onClick={() => setThisWeekOnly((v) => !v)}
                  >
                    이번 주만
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetPlan}>
                    <RotateCcw data-icon="inline-start" />
                    기본 계획으로
                  </Button>
                </div>
              </div>
              <ScheduleTable
                tasks={visibleTasks}
                currentWeek={nowWeek}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                onCycleCell={cycleCell}
                emptyMessage={
                  thisWeekOnly
                    ? "이번 주에 잡혀 있는 업무가 없습니다."
                    : "선택한 영역에 연결된 일정이 없습니다."
                }
              />
            </div>

            <aside className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">이번 주 보드</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {currentWeek ? `${currentWeek.rangeLabel}에 칸이 있는 업무` : "현재 주가 계획 구간 밖입니다."}
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {thisWeekTasks.length === 0 ? (
                  <li className="rounded-lg bg-muted px-3 py-4 text-sm text-muted-foreground">이번 주 항목 없음</li>
                ) : (
                  thisWeekTasks.map((task) => {
                    const cell = cellOf(task, nowWeek);
                    const stream = STREAMS.find((s) => s.id === task.streamId);
                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(task.id)}
                          className={cn(
                            "w-full rounded-lg border px-3 py-2 text-left hover:bg-muted/60",
                            selectedTaskId === task.id && "border-stone-400 bg-muted/40",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium" style={{ color: stream?.color }}>
                              {stream?.shortTitle}
                            </span>
                            <span className="text-[11px] text-muted-foreground">{CELL_LABEL[cell]}</span>
                          </div>
                          <div className="mt-0.5 text-sm font-medium">{task.title}</div>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <LegendDot color="#94a3b8" label="예정" />
                <LegendDot color="#0f766e" label="진행" />
                <LegendDot color="#0f766e" solid label="완료" />
                <LegendDot color="#e11d48" solid label="지연" />
              </div>
            </aside>
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}

function LegendDot({ color, label, solid }: { color: string; label: string; solid?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-3 w-3 rounded-sm border border-black/10"
        style={{ backgroundColor: solid ? color : `${color}55` }}
      />
      {label}
    </span>
  );
}
