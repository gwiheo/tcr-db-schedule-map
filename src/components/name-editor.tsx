"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Stream } from "@/lib/types";

type NameEditorProps = {
  rootLabel: string;
  streams: Stream[];
  taskCountByStream: Record<string, number>;
  onChangeRootLabel: (label: string) => void;
  onChangeStream: (id: string, patch: Partial<Pick<Stream, "title" | "shortTitle" | "color">>) => void;
  onResetNames: () => void;
};

export function NameEditor({
  rootLabel,
  streams,
  taskCountByStream,
  onChangeRootLabel,
  onChangeStream,
  onResetNames,
}: NameEditorProps) {
  return (
    <div data-testid="name-editor" className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">영역 이름 편집</h3>
          <p className="text-xs text-muted-foreground">
            마인드맵 가지, 필터 칩, 스케줄 테이블 그룹 제목이 함께 바뀝니다.
          </p>
        </div>
        <Button size="sm" variant="outline" data-testid="reset-names" onClick={onResetNames}>
          <RotateCcw data-icon="inline-start" />
          기본 이름으로
        </Button>
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
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-1 font-medium">전체 이름 (마인드맵 · 테이블 그룹)</th>
              <th className="pb-1 font-medium">짧은 이름 (필터 칩 · 이번 주 보드)</th>
              <th className="pb-1 font-medium">색</th>
              <th className="pb-1 font-medium">업무</th>
            </tr>
          </thead>
          <tbody>
            {streams.map((stream) => (
              <tr key={stream.id}>
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
                  <input
                    type="color"
                    aria-label={`${stream.title} 색`}
                    data-testid={`stream-color-${stream.id}`}
                    value={stream.color}
                    onChange={(e) => onChangeStream(stream.id, { color: e.target.value })}
                    className="h-8 w-12 cursor-pointer rounded-lg border border-input bg-background p-1"
                  />
                </td>
                <td className="py-1 text-xs text-muted-foreground">{taskCountByStream[stream.id] ?? 0}개</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        개별 업무 제목은 업무 이름 아래 「상세 보기」에서 바꿉니다. 이름 변경도 저장 대상이므로 「저장」 또는 「다른
        이름으로 저장」을 눌러 두세요.
      </p>
    </div>
  );
}
