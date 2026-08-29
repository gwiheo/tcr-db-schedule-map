"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

type RootNodeWindowProps = {
  open: boolean;
  label: string;
  notes: string;
  onChangeNotes: (notes: string) => void;
  onClose: () => void;
};

export function RootNodeWindow({ open, label, notes, onChangeNotes, onClose }: RootNodeWindowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
    // onClose is a setState wrapper; including it would refocus on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="노드 창 닫기"
        className="absolute inset-0 bg-stone-900/25 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="root-node-window-title"
        data-testid="root-node-window"
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b bg-slate-800 px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-[0.16em] text-slate-300 uppercase">노드</p>
            <h3 id="root-node-window-title" className="truncate text-base font-semibold">
              {label}
            </h3>
            <p className="text-xs text-slate-300">2026.08 – 12 · 22주</p>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            data-testid="close-root-node-window"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="닫기"
          >
            <X />
          </Button>
        </div>
        <div className="flex flex-col gap-2 p-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">메모</span>
            <textarea
              ref={textareaRef}
              data-testid="root-notes-input"
              value={notes}
              onChange={(e) => onChangeNotes(e.target.value)}
              placeholder="엔진 범위, 성능 목표, 이번 분기 결정 사항을 적어 두세요."
              className="min-h-44 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            이 메모는 가운데 노드에 붙습니다. 저장 대상이므로 「저장」 또는 「다른 이름으로 저장」을 눌러 두세요.
          </p>
        </div>
      </div>
    </div>
  );
}
