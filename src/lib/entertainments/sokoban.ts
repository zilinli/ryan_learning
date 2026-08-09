/** Tiny Sokoban engine — `#` wall, `@` player, `$` box, `.` goal, `*` box on goal, `+` player on goal, ` ` floor */

export type SokobanLevel = {
  id: number;
  name: string;
  rows: string[];
};

export const SOKOBAN_LEVELS: SokobanLevel[] = [
  {
    id: 1,
    name: "Warm-up",
    rows: ["#####", "#.@ #", "# $.#", "#   #", "#####"],
  },
  {
    id: 2,
    name: "Corner",
    rows: ["######", "# .  #", "# $# #", "# @  #", "######"],
  },
  {
    id: 3,
    name: "Two crates",
    rows: ["#######", "#.   .#", "# $$  #", "#  @  #", "#######"],
  },
  {
    id: 4,
    name: "Hall",
    rows: [
      "########",
      "#......#",
      "#$$$$$#",
      "#  @  #",
      "########",
    ],
  },
  {
    id: 5,
    name: "Zigzag",
    rows: [
      "  ##### ",
      "###   # ",
      "#.@$  # ",
      "### $.# ",
      "#.##$ # ",
      "# # . ##",
      "#$ *$$.#",
      "#   .  #",
      "########",
    ],
  },
];

export type SokobanState = {
  levelId: number;
  w: number;
  h: number;
  walls: boolean[];
  goals: boolean[];
  boxes: boolean[];
  player: number;
  moves: number;
  history: Array<{ boxes: boolean[]; player: number }>;
};

function key(x: number, y: number, w: number) {
  return y * w + x;
}

export function loadSokoban(level: SokobanLevel): SokobanState {
  const h = level.rows.length;
  const w = Math.max(...level.rows.map((r) => r.length));
  const walls = Array(w * h).fill(false) as boolean[];
  const goals = Array(w * h).fill(false) as boolean[];
  const boxes = Array(w * h).fill(false) as boolean[];
  let player = 0;
  for (let y = 0; y < h; y++) {
    const row = level.rows[y]!.padEnd(w, " ");
    for (let x = 0; x < w; x++) {
      const ch = row[x]!;
      const i = key(x, y, w);
      if (ch === "#") walls[i] = true;
      if (ch === "." || ch === "*" || ch === "+") goals[i] = true;
      if (ch === "$" || ch === "*") boxes[i] = true;
      if (ch === "@" || ch === "+") player = i;
    }
  }
  return {
    levelId: level.id,
    w,
    h,
    walls,
    goals,
    boxes,
    player,
    moves: 0,
    history: [],
  };
}

export function moveSokoban(
  state: SokobanState,
  dx: number,
  dy: number,
): SokobanState {
  const x = state.player % state.w;
  const y = Math.floor(state.player / state.w);
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= state.w || ny >= state.h) return state;
  const ni = key(nx, ny, state.w);
  if (state.walls[ni]) return state;
  const boxes = [...state.boxes];
  if (boxes[ni]) {
    const bx = nx + dx;
    const by = ny + dy;
    if (bx < 0 || by < 0 || bx >= state.w || by >= state.h) return state;
    const bi = key(bx, by, state.w);
    if (state.walls[bi] || boxes[bi]) return state;
    boxes[ni] = false;
    boxes[bi] = true;
  }
  return {
    ...state,
    boxes,
    player: ni,
    moves: state.moves + 1,
    history: [
      ...state.history,
      { boxes: state.boxes, player: state.player },
    ],
  };
}

export function undoSokoban(state: SokobanState): SokobanState {
  if (!state.history.length) return state;
  const prev = state.history[state.history.length - 1]!;
  return {
    ...state,
    boxes: prev.boxes,
    player: prev.player,
    moves: Math.max(0, state.moves - 1),
    history: state.history.slice(0, -1),
  };
}

export function isSokobanWon(state: SokobanState): boolean {
  for (let i = 0; i < state.boxes.length; i++) {
    if (state.boxes[i] && !state.goals[i]) return false;
  }
  return state.boxes.some(Boolean);
}
