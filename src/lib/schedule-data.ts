import type { CellStatus, Milestone, MindNode, Stream, Task, TaskStatus } from "./types";
import { currentWeekIndex, WEEKS } from "./weeks";

/** Snapshot date the baseline plan was written against, so SSR and the client seed the same cells. */
export const BASELINE_AS_OF_WEEK = currentWeekIndex(new Date(2026, 7, 31));

export const BASELINE_STREAMS: Stream[] = [
  { id: "arch", title: "아키텍처 · 설계", shortTitle: "설계", color: "#4338ca", side: "left" },
  { id: "storage", title: "스토리지 엔진", shortTitle: "스토리지", color: "#0f766e", side: "left" },
  { id: "query", title: "쿼리 엔진", shortTitle: "쿼리", color: "#b45309", side: "left" },
  { id: "txn", title: "트랜잭션 · 동시성", shortTitle: "트랜잭션", color: "#be123c", side: "right" },
  { id: "repl", title: "복제 · HA", shortTitle: "복제", color: "#6d28d9", side: "right" },
  { id: "ops", title: "운영 · 관측", shortTitle: "운영", color: "#0369a1", side: "right" },
  { id: "qa", title: "품질 · 릴리스", shortTitle: "품질", color: "#047857", side: "right" },
];

export const BASELINE_ROOT_LABEL = "TCR DB 엔진";

export function streamMapOf(streams: Stream[]): Record<string, Stream> {
  return Object.fromEntries(streams.map((s) => [s.id, s]));
}

export function seedWeekStatus(
  startWeek: number,
  endWeek: number,
  overall: TaskStatus,
  nowWeek = BASELINE_AS_OF_WEEK,
): Record<number, CellStatus> {
  const rec: Record<number, CellStatus> = {};
  for (let i = startWeek; i <= endWeek; i++) {
    if (overall === "done") rec[i] = "done";
    else if (overall === "planned") rec[i] = "planned";
    else if (overall === "blocked") {
      rec[i] = i === nowWeek ? "blocked" : i < nowWeek ? "done" : "planned";
    } else if (i < nowWeek) rec[i] = "done";
    else if (i === nowWeek) rec[i] = "active";
    else rec[i] = "planned";
  }
  return rec;
}

function task(
  partial: Omit<Task, "weekStatus"> & { overall: TaskStatus },
): Task {
  const { overall, ...rest } = partial;
  return {
    ...rest,
    weekStatus: seedWeekStatus(rest.startWeek, rest.endWeek, overall),
  };
}

export const BASELINE_TASKS: Task[] = [
  task({
    id: "arch-req",
    title: "요구사항 · 범위 확정",
    summary: "엔진 범위, 비범위, 성능 목표(지연·처리량)와 호환 SQL 부분집합을 고정한다.",
    streamId: "arch",
    owner: "설계 리드",
    startWeek: 0,
    endWeek: 1,
    notes: "OLTP 우선, 분석은 후속 단계. SQL-92 핵심 + JSON 일부.",
    overall: "done",
  }),
  task({
    id: "arch-layout",
    title: "스토리지 레이아웃 설계",
    summary: "페이지 크기, 슬롯 디렉터리, 프리 스페이스 맵, 카탈로그 온디스크 포맷.",
    streamId: "arch",
    owner: "설계 리드",
    startWeek: 0,
    endWeek: 2,
    notes: "8KB 페이지, 리틀엔디안, 체크섬 per page.",
    overall: "done",
  }),
  task({
    id: "arch-pipeline",
    title: "쿼리 파이프라인 설계",
    summary: "파서 → 바인더 → 논리계획 → 물리계획 → 실행기의 단계와 중간 IR을 정의한다.",
    streamId: "arch",
    owner: "설계 리드",
    startWeek: 1,
    endWeek: 3,
    notes: "Volcano 모델을 기본으로 배치/벡터 실행을 얹는 하이브리드.",
    overall: "active",
  }),
  task({
    id: "arch-protocol",
    title: "와이어 프로토콜 · API 스펙",
    summary: "클라이언트 프로토콜, 세션, 단순 SQL API, 관리 엔드포인트.",
    streamId: "arch",
    owner: "설계 리드",
    startWeek: 2,
    endWeek: 4,
    notes: "1차 마일스톤은 Postgres 호환이 아니라 자체 바이너리 프로토콜.",
    overall: "active",
  }),
  task({
    id: "arch-spike",
    title: "버퍼풀 · WAL 스파이크",
    summary: "페이지 핀/언핀, 플러시 정책, WAL 레코드 포맷을 스파이크로 검증한다.",
    streamId: "arch",
    owner: "스토리지",
    startWeek: 1,
    endWeek: 3,
    notes: "시계열 로그 재생으로 크래시 후 재기동 경로를 확인.",
    overall: "done",
  }),
  task({
    id: "st-page",
    title: "페이지 매니저",
    summary: "파일 세그먼트, 페이지 할당/해제, 체크섬, 프리 리스트.",
    streamId: "storage",
    owner: "스토리지",
    startWeek: 3,
    endWeek: 6,
    notes: "단일 테이블스페이스부터. 다중 파일은 10월 확장.",
    overall: "active",
  }),
  task({
    id: "st-buffer",
    title: "버퍼 풀",
    summary: "클락 스윕, 더티 페이지 라이터, 핀 카운트, 버퍼 디스크립터.",
    streamId: "storage",
    owner: "스토리지",
    startWeek: 4,
    endWeek: 7,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "st-wal",
    title: "WAL · 체크포인트",
    summary: "로그 레코드 직렬화, fsync 그룹 커밋, 체크포인트, redo.",
    streamId: "storage",
    owner: "스토리지",
    startWeek: 5,
    endWeek: 9,
    notes: "복제 스트림의 원천이므로 레코드 타입을 초기에 고정.",
    overall: "planned",
  }),
  task({
    id: "st-heap",
    title: "테이블 힙 · 슬롯 페이지",
    summary: "힙 삽입/갱신/삭제, 토스트, 가시성 힌트 비트.",
    streamId: "storage",
    owner: "스토리지",
    startWeek: 6,
    endWeek: 9,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "st-btree",
    title: "B+Tree 인덱스",
    summary: "리프/내부 페이지, 분할·병합, 동시 삽입, 커버링 스캔.",
    streamId: "storage",
    owner: "스토리지",
    startWeek: 8,
    endWeek: 12,
    notes: "1차 키 타입: int64, 가변 문자열.",
    overall: "planned",
  }),
  task({
    id: "st-compact",
    title: "컴팩션 · 힙 GC",
    summary: "데드 튜플 회수, 인덱스 클린업, 백그라운드 워커.",
    streamId: "storage",
    owner: "스토리지",
    startWeek: 10,
    endWeek: 13,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "q-parser",
    title: "SQL 렉서 · 파서",
    summary: "SELECT/INSERT/UPDATE/DELETE, DDL 일부, 바인드 파라미터.",
    streamId: "query",
    owner: "쿼리",
    startWeek: 5,
    endWeek: 8,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "q-catalog",
    title: "카탈로그 · 스키마",
    summary: "데이터베이스/테이블/컬럼/인덱스 메타, 캐시 무효화.",
    streamId: "query",
    owner: "쿼리",
    startWeek: 6,
    endWeek: 8,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "q-planner",
    title: "논리 플래너",
    summary: "프로젝션 푸시다운, 술어 단순화, 조인 재배치 전 정규화.",
    streamId: "query",
    owner: "쿼리",
    startWeek: 8,
    endWeek: 11,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "q-cbo",
    title: "비용 기반 옵티마이저",
    summary: "히스토그램, 선택도, 조인 순서, 인덱스 vs 시퀀셜 스캔.",
    streamId: "query",
    owner: "쿼리",
    startWeek: 10,
    endWeek: 14,
    notes: "통계 수집은 수동 ANALYZE부터.",
    overall: "planned",
  }),
  task({
    id: "q-exec",
    title: "벡터화 실행기",
    summary: "배치 루프, 표현식 평가, 프로젝션/필터, 메모리 어카운팅.",
    streamId: "query",
    owner: "쿼리",
    startWeek: 9,
    endWeek: 15,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "q-joins",
    title: "조인 · 집계 연산자",
    summary: "해시 조인, 네스티드 루프, 해시 어그리게이션, 소트.",
    streamId: "query",
    owner: "쿼리",
    startWeek: 12,
    endWeek: 16,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "t-mvcc",
    title: "MVCC 스냅샷",
    summary: "xmin/xmax, 스냅샷, 튜플 가시성, 트랜잭션 상태 배열.",
    streamId: "txn",
    owner: "트랜잭션",
    startWeek: 9,
    endWeek: 13,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "t-lock",
    title: "락 매니저",
    summary: "행/테이블 락, 데드락 감지, wait-for 그래프.",
    streamId: "txn",
    owner: "트랜잭션",
    startWeek: 11,
    endWeek: 14,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "t-iso",
    title: "격리 수준",
    summary: "READ COMMITTED, REPEATABLE READ. 시리얼라이즈블은 후속.",
    streamId: "txn",
    owner: "트랜잭션",
    startWeek: 13,
    endWeek: 15,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "t-recover",
    title: "크래시 복구",
    summary: "redo, 미완료 트랜잭션 undo, 복구 후 가용성 검증.",
    streamId: "txn",
    owner: "트랜잭션",
    startWeek: 12,
    endWeek: 16,
    notes: "WAL 포맷이 안정된 뒤 본격 착수.",
    overall: "planned",
  }),
  task({
    id: "r-stream",
    title: "물리 복제 로그 스트리밍",
    summary: "프라이머리 WAL을 스탠바이로 전송, 적용 지연 계측.",
    streamId: "repl",
    owner: "분산",
    startWeek: 14,
    endWeek: 18,
    notes: "동기/비동기 커밋 옵션.",
    overall: "planned",
  }),
  task({
    id: "r-fail",
    title: "자동 페일오버",
    summary: "리더 선출, 프로모션, 클라이언트 리다이렉트.",
    streamId: "repl",
    owner: "분산",
    startWeek: 16,
    endWeek: 19,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "r-member",
    title: "클러스터 멤버십",
    summary: "노드 등록, 하트비트, 쿼럼, 설정 변경.",
    streamId: "repl",
    owner: "분산",
    startWeek: 15,
    endWeek: 18,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "o-metrics",
    title: "메트릭 · 트레이싱",
    summary: "버퍼 히트율, WAL 지연, 쿼리 latency histogram, 슬로우 로그.",
    streamId: "ops",
    owner: "SRE",
    startWeek: 13,
    endWeek: 17,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "o-backup",
    title: "백업 · 복원",
    summary: "베이스 백업 + WAL 아카이브, PITR.",
    streamId: "ops",
    owner: "SRE",
    startWeek: 16,
    endWeek: 19,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "o-tune",
    title: "설정 · 튜닝 가이드",
    summary: "공유 버퍼, WAL, 병렬 워커, 운영 런북.",
    streamId: "ops",
    owner: "SRE",
    startWeek: 18,
    endWeek: 20,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "qa-test",
    title: "단위 · 통합 테스트",
    summary: "스토리지부터 쿼리까지 회귀 스위트. 매주 실패율을 일정에 반영.",
    streamId: "qa",
    owner: "QA",
    startWeek: 2,
    endWeek: 20,
    notes: "엔진 모듈이 생기는 대로 테스트를 확장하는 상시 트랙.",
    overall: "active",
  }),
  task({
    id: "qa-bench",
    title: "벤치마크 · TPC-C 일부",
    summary: "단일 노드 처리량, p99 지연, 복제 지연 목표 대비 측정.",
    streamId: "qa",
    owner: "QA",
    startWeek: 16,
    endWeek: 20,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "qa-alpha",
    title: "알파 컷",
    summary: "로컬 단일 노드에서 CRUD + 인덱스 + 크래시 복구 데모.",
    streamId: "qa",
    owner: "QA",
    startWeek: 15,
    endWeek: 17,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "qa-beta",
    title: "베타 컷",
    summary: "1 프라이머리 + 1 스탠바이, 페일오버 시나리오 통과.",
    streamId: "qa",
    owner: "QA",
    startWeek: 18,
    endWeek: 19,
    notes: "",
    overall: "planned",
  }),
  task({
    id: "qa-ga",
    title: "GA 릴리스",
    summary: "릴리스 노트, 호환 약속, 알려진 제한, 12월 말 컷오버.",
    streamId: "qa",
    owner: "QA",
    startWeek: 20,
    endWeek: 21,
    notes: "외부 공개 전 내부 GA.",
    overall: "planned",
  }),
];

export const MILESTONES: Milestone[] = [
  { id: "m1", title: "M1 아키텍처 동결", week: 4 },
  { id: "m2", title: "M2 스토리지 알파", week: 9 },
  { id: "m3", title: "M3 쿼리 알파", week: 15 },
  { id: "m4", title: "M4 클러스터 베타", week: 19 },
  { id: "m5", title: "M5 GA", week: 21 },
];

export function buildMindTree(streams: Stream[], tasks: Task[], rootLabel = BASELINE_ROOT_LABEL): MindNode {
  return {
    id: "root",
    label: rootLabel,
    children: streams.map((stream) => ({
      id: `stream-${stream.id}`,
      label: stream.title,
      streamId: stream.id,
      children: tasks
        .filter((t) => t.streamId === stream.id)
        .map((t) => ({
          id: `task-${t.id}`,
          label: t.title,
          streamId: stream.id,
          taskId: t.id,
        })),
    })),
  };
}

export const CELL_CYCLE: CellStatus[] = ["planned", "active", "done", "blocked"];

export function nextCellStatus(status: CellStatus): CellStatus {
  if (status === "empty") return "planned";
  return CELL_CYCLE[(CELL_CYCLE.indexOf(status) + 1) % CELL_CYCLE.length];
}

export function cellOf(task: Task, week: number): CellStatus {
  if (week < 0 || week >= WEEKS.length) return "empty";
  return task.weekStatus[week] ?? "empty";
}

export function scheduledWeekCount(task: Task) {
  return Object.values(task.weekStatus).filter((s) => s !== "empty").length;
}

export function taskProgress(task: Task) {
  const scheduled = Object.values(task.weekStatus).filter((s) => s !== "empty");
  if (scheduled.length === 0) return 0;
  const done = scheduled.filter((s) => s === "done").length;
  return Math.round((done / scheduled.length) * 100);
}

export function taskStatus(task: Task): TaskStatus {
  const cells = Object.values(task.weekStatus).filter((s) => s !== "empty");
  if (cells.length === 0) return "planned";
  if (cells.some((s) => s === "blocked")) return "blocked";
  if (cells.every((s) => s === "done")) return "done";
  if (cells.some((s) => s === "active" || s === "done")) return "active";
  return "planned";
}

export function descendantTaskIds(node: MindNode): string[] {
  const ids: string[] = [];
  function walk(n: MindNode) {
    if (n.taskId) ids.push(n.taskId);
    n.children?.forEach(walk);
  }
  walk(node);
  return ids;
}

export function findNode(root: MindNode, id: string): MindNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  planned: "예정",
  active: "진행",
  done: "완료",
  blocked: "지연",
};

export const CELL_LABEL: Record<CellStatus, string> = {
  empty: "해당 없음",
  planned: "예정",
  active: "진행",
  done: "완료",
  blocked: "지연",
};
