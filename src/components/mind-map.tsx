"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CELL_LABEL, MIND_TREE, STREAM_MAP, taskProgress, taskStatus } from "@/lib/schedule-data";
import type { MindNode, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type LaidOut = {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  depth: number;
  streamId?: string;
  taskId?: string;
  parentId?: string;
  hasChildren: boolean;
  collapsed: boolean;
  side: "left" | "right";
};

const NODE_H = 36;
const ROOT_H = 58;
const V_GAP = 10;
const BRANCH_GAP = 22;
const H_GAP = 48;

function textWidth(label: string, depth: number) {
  let w = 0;
  for (const ch of label) w += ch.charCodeAt(0) > 127 ? 12.4 : 7.2;
  const pad = depth === 0 ? 36 : 28;
  return Math.max(depth === 0 ? 172 : 108, Math.ceil(w + pad));
}

function subtreeHeight(node: MindNode, collapsed: Set<string>): number {
  if (!node.children?.length || collapsed.has(node.id)) return NODE_H;
  return node.children.reduce((sum, child, i) => {
    return sum + subtreeHeight(child, collapsed) + (i === 0 ? 0 : V_GAP);
  }, 0);
}

function layoutTree(root: MindNode, collapsed: Set<string>): { nodes: LaidOut[]; width: number; height: number } {
  const nodes: LaidOut[] = [];
  const left = (root.children ?? []).filter((c) => STREAM_MAP[c.streamId ?? ""]?.side === "left");
  const right = (root.children ?? []).filter((c) => STREAM_MAP[c.streamId ?? ""]?.side !== "left");

  const leftH = left.reduce((s, n, i) => s + subtreeHeight(n, collapsed) + (i ? BRANCH_GAP : 0), 0);
  const rightH = right.reduce((s, n, i) => s + subtreeHeight(n, collapsed) + (i ? BRANCH_GAP : 0), 0);
  const contentH = Math.max(leftH, rightH, 320);
  const rootW = textWidth(root.label, 0);
  const originY = 56;
  const rootX = 820;
  const rootY = originY + contentH / 2 - ROOT_H / 2;

  nodes.push({
    id: root.id,
    label: root.label,
    x: rootX - rootW / 2,
    y: rootY,
    w: rootW,
    h: ROOT_H,
    color: "#1e293b",
    depth: 0,
    hasChildren: true,
    collapsed: false,
    side: "right",
  });

  function colorOf(node: MindNode) {
    if (node.streamId && STREAM_MAP[node.streamId]) return STREAM_MAP[node.streamId].color;
    return "#334155";
  }

  function place(
    node: MindNode,
    side: "left" | "right",
    depth: number,
    xAnchor: number,
    y: number,
    parentId: string,
  ): number {
    const h = collapsed.has(node.id) || !node.children?.length ? NODE_H : subtreeHeight(node, collapsed);
    const w = textWidth(node.label, depth);
    const x = side === "right" ? xAnchor : xAnchor - w;
    const ny = y + h / 2 - NODE_H / 2;
    nodes.push({
      id: node.id,
      label: node.label,
      x,
      y: ny,
      w,
      h: NODE_H,
      color: colorOf(node),
      depth,
      streamId: node.streamId,
      taskId: node.taskId,
      parentId,
      hasChildren: Boolean(node.children?.length),
      collapsed: collapsed.has(node.id),
      side,
    });
    if (!node.children?.length || collapsed.has(node.id)) return h;
    const childAnchor = side === "right" ? x + w + H_GAP : x - H_GAP;
    let cy = y;
    for (const child of node.children) {
      const ch = place(child, side, depth + 1, childAnchor, cy, node.id);
      cy += ch + V_GAP;
    }
    return h;
  }

  let ly = originY + (contentH - leftH) / 2;
  for (const branch of left) {
    const h = place(branch, "left", 1, rootX - rootW / 2 - H_GAP, ly, root.id);
    ly += h + BRANCH_GAP;
  }
  let ry = originY + (contentH - rightH) / 2;
  for (const branch of right) {
    const h = place(branch, "right", 1, rootX + rootW / 2 + H_GAP, ry, root.id);
    ry += h + BRANCH_GAP;
  }

  const maxX = Math.max(...nodes.map((n) => n.x + n.w)) + 48;
  const maxY = Math.max(...nodes.map((n) => n.y + n.h)) + 56;
  return { nodes, width: Math.max(1680, maxX + 40), height: Math.max(contentH + 120, maxY) };
}

function linkPath(from: LaidOut, to: LaidOut) {
  const y1 = from.y + from.h / 2;
  const y2 = to.y + to.h / 2;
  if (to.side === "right") {
    const x1 = from.x + from.w;
    const x2 = to.x;
    const c = Math.max(24, (x2 - x1) * 0.5);
    return `M ${x1} ${y1} C ${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}`;
  }
  const x1 = from.x;
  const x2 = to.x + to.w;
  const c = Math.max(24, (x1 - x2) * 0.5);
  return `M ${x1} ${y1} C ${x1 - c} ${y1}, ${x2 + c} ${y2}, ${x2} ${y2}`;
}

type MindMapProps = {
  tasks: Task[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  highlightedTaskIds: Set<string>;
};

export function MindMap({ tasks, selectedId, onSelect, highlightedTaskIds }: MindMapProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [transform, setTransform] = useState({ x: 0, y: 12, scale: 0.78 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const { nodes, width, height } = useMemo(() => layoutTree(MIND_TREE, collapsed), [collapsed]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  function fit() {
    const el = viewportRef.current;
    if (!el) return;
    const scale = Math.min(el.clientWidth / width, (el.clientHeight - 8) / height, 1);
    setTransform({
      x: (el.clientWidth - width * scale) / 2,
      y: Math.max(12, (el.clientHeight - height * scale) / 2),
      scale,
    });
  }

  useEffect(() => {
    fit();
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(el);
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setTransform((prev) => {
        const next = Math.min(1.7, Math.max(0.4, prev.scale * (e.deltaY > 0 ? 0.92 : 1.08)));
        const k = next / prev.scale;
        return {
          scale: next,
          x: px - (px - prev.x) * k,
          y: py - (py - prev.y) * k,
        };
      });
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => {
      observer.disconnect();
      el.removeEventListener("wheel", onWheelNative);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    if (Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y) > 3) {
      drag.current.moved = true;
    }
    setTransform({
      scale: transform.scale,
      x: drag.current.tx + (e.clientX - drag.current.x),
      y: drag.current.ty + (e.clientY - drag.current.y),
    });
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="relative overflow-hidden rounded-xl border bg-[#f6f1e6]">
      <div className="pointer-events-none absolute inset-0 mindmap-dots" />
      <div className="absolute top-3 right-3 z-10 flex gap-1">
        <Button
          size="icon-sm"
          variant="outline"
          className="bg-white/90"
          onClick={() => setTransform((t) => ({ ...t, scale: Math.min(1.7, t.scale + 0.1) }))}
          aria-label="확대"
        >
          <Plus />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          className="bg-white/90"
          onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.4, t.scale - 0.1) }))}
          aria-label="축소"
        >
          <Minus />
        </Button>
        <Button size="icon-sm" variant="outline" className="bg-white/90" onClick={fit} aria-label="화면에 맞추기">
          <RotateCcw />
        </Button>
      </div>
      <p className="absolute left-4 top-3 z-10 hidden text-xs text-stone-500 sm:block">
        노드를 눌러 아래 일정을 필터합니다 · 빈 곳은 드래그, 휠은 확대
      </p>
      <div
        ref={viewportRef}
        className="relative h-[min(58vh,640px)] w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <svg width="100%" height="100%" className="pointer-events-none absolute inset-0 overflow-visible">
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
            {nodes
              .filter((n) => n.parentId)
              .map((n) => {
                const parent = byId.get(n.parentId!);
                if (!parent) return null;
                const dim =
                  highlightedTaskIds.size > 0 &&
                  n.taskId &&
                  !highlightedTaskIds.has(n.taskId) &&
                  n.depth > 1;
                return (
                  <path
                    key={`l-${n.id}`}
                    d={linkPath(parent, n)}
                    fill="none"
                    stroke={n.color}
                    strokeWidth={n.depth === 1 ? 2.4 : 1.6}
                    strokeOpacity={dim ? 0.12 : 0.55}
                  />
                );
              })}
          </g>
        </svg>
        <div
          className="absolute top-0 left-0"
          style={{
            width,
            height,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "0 0",
          }}
        >
          {nodes.map((n) => {
            const task = n.taskId ? taskById.get(n.taskId) : undefined;
            const status = task ? taskStatus(task) : undefined;
            const selected = selectedId === n.id;
            const related =
              highlightedTaskIds.size === 0 ||
              n.depth === 0 ||
              (n.taskId
                ? highlightedTaskIds.has(n.taskId)
                : Boolean(
                    n.streamId &&
                      [...highlightedTaskIds].some((id) => taskById.get(id)?.streamId === n.streamId),
                  ));
            return (
              <div
                key={n.id}
                data-node
                className="absolute"
                style={{ left: n.x, top: n.y, width: n.w, height: n.h, opacity: related ? 1 : 0.32 }}
              >
                <button
                  type="button"
                  data-testid={`mind-node-${n.id}`}
                  title={
                    task
                      ? `${task.title} · ${CELL_LABEL[status ?? "planned"]} · ${taskProgress(task)}%`
                      : n.label
                  }
                  onClick={() => onSelect(selected ? null : n.id)}
                  className={cn(
                    "flex h-full w-full items-center overflow-hidden rounded-[10px] border bg-white text-left shadow-sm",
                    n.depth === 0 && "rounded-full border-2 bg-slate-800 text-white shadow-md",
                    selected ? "ring-2 ring-offset-1" : "",
                  )}
                  style={{
                    borderColor: n.depth === 0 ? "white" : n.color,
                    boxShadow: n.depth === 1 ? `inset 6px 0 0 ${n.color}` : undefined,
                    ["--tw-ring-color" as string]: n.color,
                  }}
                >
                  <span
                    className={cn(
                      "w-full truncate px-3 text-[11.5px] font-medium text-stone-900",
                      n.depth === 0 && "px-2 text-center text-[13px] font-bold text-white",
                      n.depth === 1 && "pl-4 text-[12.5px] font-bold",
                    )}
                  >
                    {n.label}
                    {n.depth === 0 ? (
                      <span className="mt-0.5 block text-[10px] font-normal text-slate-300">
                        2026.08 – 12 · 22주
                      </span>
                    ) : null}
                  </span>
                  {status === "done" ? (
                    <span
                      className="mr-2 size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: n.color }}
                    />
                  ) : null}
                </button>
                {n.hasChildren && n.depth > 0 ? (
                  <button
                    type="button"
                    data-node
                    aria-label={n.collapsed ? "펼치기" : "접기"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(n.id);
                    }}
                    className="absolute top-1/2 z-10 flex size-4 -translate-y-1/2 items-center justify-center rounded-full border bg-white text-[10px] font-bold"
                    style={{
                      borderColor: n.color,
                      color: n.color,
                      [n.side === "right" ? "right" : "left"]: -8,
                    }}
                  >
                    {n.collapsed ? "+" : "–"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
