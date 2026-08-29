"use client";

import { Plus, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Stream } from "@/lib/types";

type NameEditorProps = {
  rootLabel: string;
  streams: Stream[];
  taskCountByStream: Record<string, number>;
  onChangeRootLabel: (label: string) => void;
  onChangeStream: (id: string, patch: Partial<Pick<Stream, "title" | "shortTitle" | "color" | "side">>) => void;
  onAddStream: () => Stream;
  onDeleteStream: (id: string) => void;
  onResetNames: () => void;
};

export function NameEditor({
  rootLabel,
  streams,
  taskCountByStream,
  onChangeRootLabel,
  onChangeStream,
  onAddStream,
  onDeleteStream,
  onResetNames,
}: NameEditorProps) {
  const canDelete = streams.length > 1;

  function handleAdd() {
    const stream = onAddStream();
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(`[data-testid="stream-title-${stream.id}"]`);
      input?.focus();
      input?.select();
    });
  }

  function handleDelete(stream: Stream) {
    if (!canDelete) return;
    const n = taskCountByStream[stream.id] ?? 0;
    const message =
      n > 0
        ? `「${stream.title}」과 그 안의 업무 ${n}건을 삭제할까요? 저장된 안을 불러오면 되돌릴 수 있습니다.`
        : `「${stream.title}」을 삭제할까요?`;
    if (!window.confirm(message)) return;
    onDeleteStream(stream.id);
  }

  return (
    <div data-testid="name-editor" className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">영역 이름 편집</h3>
          <p className="text-xs text-muted-foreground">
            전체 이름 행을 추가하거나 지울 수 있습니다. 영역을 지우면 그 안의 업무도 함께 삭제됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" data-testid="add-stream" onClick={handleAdd}>
            <Plus data-icon="inline-start" />
            영역 추가
          </Button>
          <Button size="sm" variant="outline" data-testid="reset-names" onClick={onResetNames}>
            <RotateCcw data-icon="inline-start" />
            기본 이름으로
          </Button>
        </div>
      </div>

      <label className="mt-4 block max-w-md">
        <span className="text-xs text-muted-foreground">가운데 노드 (프로젝트 이름)</span>
        <input
          data-testid="root-label-input"
          value={rootLabel}
          onChange={(e) => onChangeRootLabel(e.target.value)}
          className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-1 font-medium">전체 이름 (마인드맵 · 테이블 그룹)</th>
              <th className="pb-1 font-medium">짧은 이름 (필터 칩 · 이번 주 보드)</th>
              <th className="pb-1 font-medium">위치</th>
              <th className="pb-1 font-medium">색</th>
              <th className="pb-1 font-medium">업무</th>
              <th className="pb-1 font-medium">
                <span className="sr-only">삭제</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {streams.map((stream) => (
              <tr key={stream.id} data-testid={`stream-row-${stream.id}`}>
                <td className="py-1 pr-2">
                  <input
                    data-testid={`stream-title-${stream.id}`}
                    value={stream.title}
                    onChange={(e) => onChangeStream(stream.id, { title: e.target.value })}
                    className="h-8 w-full min-w-[180px] rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    data-testid={`stream-short-${stream.id}`}
                    value={stream.shortTitle}
                    onChange={(e) => onChangeStream(stream.id, { shortTitle: e.target.value })}
                    className="h-8 w-full min-w-[110px] rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </td>
                <td className="py-1 pr-2">
                  <select
                    aria-label={`${stream.title} 마인드맵 위치`}
                    data-testid={`stream-side-${stream.id}`}
                    value={stream.side}
                    onChange={(e) =>
                      onChangeStream(stream.id, { side: e.target.value === "left" ? "left" : "right" })
                    }
                    className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="left">왼쪽</option>
                    <option value="right">오른쪽</option>
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="color"
                    aria-label={`${stream.title} 색`}
                    data-testid={`stream-color-${stream.id}`}
                    value={stream.color}
                    onChange={(e) => onChangeStream(stream.id, { color: e.target.value })}
                    className="h-8 w-12 cursor-pointer rounded-lg border border-input bg-background p-1"
                  />
                </td>
                <td className="py-1 pr-2 text-xs text-muted-foreground">{taskCountByStream[stream.id] ?? 0}개</td>
                <td className="py-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    data-testid={`delete-stream-${stream.id}`}
                    aria-label={`${stream.title} 삭제`}
                    title={canDelete ? "이 영역 삭제" : "영역은 하나 이상 남아 있어야 합니다"}
                    disabled={!canDelete}
                    onClick={() => handleDelete(stream)}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        개별 업무 제목은 업무 이름 아래 「상세 보기」에서 바꿉니다. 영역 추가·삭제와 이름 변경도 저장 대상이므로 「저장」
        또는 「다른 이름으로 저장」을 눌러 두세요. 「기본 이름으로」는 원래 영역의 이름·색만 되돌리고, 추가하거나 지운
        행은 그대로 둡니다.
      </p>
    </div>
  );
}
