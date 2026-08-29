"use client";

import { useRef, useState } from "react";
import { Check, Download, FolderOpen, Save, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SavedSchedule } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatSavedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type ScheduleLibraryBarProps = {
  activeName: string | null;
  dirty: boolean;
  snapshots: SavedSchedule[];
  highlightSaveAs?: boolean;
  onSave: () => void;
  onSaveAs: (name: string) => void;
  onLoad: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onExport: (id?: string) => void;
  onImportFile: (file: File) => void;
};

export function ScheduleLibraryBar({
  activeName,
  dirty,
  snapshots,
  highlightSaveAs = false,
  onSave,
  onSaveAs,
  onLoad,
  onRename,
  onDelete,
  onExport,
  onImportFile,
}: ScheduleLibraryBarProps) {
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function openSaveAs() {
    setDraftName(activeName ? `${activeName} 사본` : `TCR DB 엔진 스케줄 ${new Date().getMonth() + 1}월`);
    setSaveAsOpen(true);
  }

  function submitSaveAs() {
    onSaveAs(draftName);
    setSaveAsOpen(false);
    setListOpen(true);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">현재 스케줄</span>
        <span
          data-testid="active-schedule-name"
          className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold"
        >
          {activeName ?? "저장 안 된 작업본"}
        </span>
        {dirty ? (
          <span
            data-testid="dirty-badge"
            className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900"
          >
            변경됨 · 저장 필요
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
            저장됨
          </span>
        )}

        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button size="sm" data-testid="save-schedule" onClick={onSave}>
            <Save data-icon="inline-start" />
            저장
          </Button>
          <Button
            size="sm"
            variant={highlightSaveAs ? "default" : "outline"}
            data-testid="save-as-open"
            onClick={openSaveAs}
          >
            다른 이름으로 저장
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="toggle-library"
            onClick={() => setListOpen((v) => !v)}
          >
            <FolderOpen data-icon="inline-start" />
            불러오기 ({snapshots.length})
          </Button>
          <Button size="sm" variant="outline" data-testid="export-current" onClick={() => onExport()}>
            <Download data-icon="inline-start" />
            파일로 내보내기
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload data-icon="inline-start" />
            파일 가져오기
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {saveAsOpen ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
          <label className="text-xs text-muted-foreground" htmlFor="save-as-name">
            새 이름
          </label>
          <input
            id="save-as-name"
            data-testid="save-as-name"
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitSaveAs();
              if (e.key === "Escape") setSaveAsOpen(false);
            }}
            className="h-8 min-w-[220px] flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="예) 12월 GA 목표안"
          />
          <Button size="sm" data-testid="save-as-confirm" onClick={submitSaveAs}>
            <Check data-icon="inline-start" />
            저장
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSaveAsOpen(false)}>
            취소
          </Button>
        </div>
      ) : null}

      {listOpen ? (
        <div data-testid="library-list" className="rounded-lg border">
          {snapshots.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              저장된 스케줄이 없습니다. 「다른 이름으로 저장」으로 첫 버전을 만들어 두세요.
            </p>
          ) : (
            <ul className="divide-y">
              {snapshots.map((snapshot) => (
                <li key={snapshot.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  {renamingId === snapshot.id ? (
                    <>
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onRename(snapshot.id, renameDraft);
                            setRenamingId(null);
                          }
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="h-8 min-w-[200px] flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          onRename(snapshot.id, renameDraft);
                          setRenamingId(null);
                        }}
                      >
                        확인
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRenamingId(null)}>
                        취소
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-[180px] flex-1">
                        <div className="text-sm font-medium">{snapshot.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatSavedAt(snapshot.savedAt)} 저장 · {snapshot.tasks.length}개 업무
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`load-${snapshot.id}`}
                        onClick={() => onLoad(snapshot.id)}
                      >
                        불러오기
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRenamingId(snapshot.id);
                          setRenameDraft(snapshot.name);
                        }}
                      >
                        이름 변경
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onExport(snapshot.id)} aria-label="내보내기">
                        <Download />
                      </Button>
                      {confirmDeleteId === snapshot.id ? (
                        <span className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              onDelete(snapshot.id);
                              setConfirmDeleteId(null);
                            }}
                          >
                            삭제 확인
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)} aria-label="취소">
                            <X />
                          </Button>
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className={cn("text-destructive")}
                          onClick={() => setConfirmDeleteId(snapshot.id)}
                          aria-label="삭제"
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
