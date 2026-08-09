/**
 * Sokoban puzzle logic.
 * Grid: ' ' = floor, '#' = wall, '.' = target, '$' = box, '*' = box on target,
 *       '@' = player, '+' = player on target
 */

export type SokobanCell = " " | "#" | "." | "$" | "*" | "@" | "+";
export type SokobanGrid = SokobanCell[][];
export type Direction = "up" | "down" | "left" | "right";

export interface SokobanState {
  grid: SokobanGrid;
  playerRow: number;
  playerCol: number;
  moveCount: number;
  pushCount: number;
  history: SokobanGrid[];
  levelIndex: number;
  solved: boolean;
}

const DIRECTION_DELTA: Record<Direction, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

const LEVELS: string[] = [
  // Level 1 - tutorial
  `
  ####
###  ####
#     $ #
# #  #$ #
# . .#@ #
#########
`,
  // Level 2
  `
  ####
  #  ####
  # $ $ #
###  ##  #
#    $ . #
# #  # . #
#     ####
####  #
   ####
`,
  // Level 3
  `
  #####
###   ##
#  $ $ #
# #.## #  #
# . .  ####
# . . .  #
##########
`,
  // Level 4
  `
 ######
 #    ##
## $ $ #  ##
#  . .  #  #
# ## . # $ #
#    # # $ #
# $ . . . #
#   # #   #
###########
`,
  // Level 5
  `
    ######
    #    ##
##### $ $ #
#   #  .  ####
# $   ## #  #
#  .#     $ #
## # . # #  #
 # .   # .  #
 #  ##   ####
  #######
`,
  // Level 6
  `
  #####
###   ##
#     #
# # # ##
# .$.  #
# .$ . ##
# .$.$  #
##  #####
 #####
`,
  // Level 7
  `
 #########
##  ##   ##
#    # $  #
# $  . $  #
## .# # $ #
 # . .  . #
 #  ## ####
  ####
`,
  // Level 8
  `
 ########
 #      ###
## $$ $   #
#  . . .  #
# ##.######
#  . . #  ##
# $  $    #
#     #####
########
`,
  // Level 9
  `
 ######
 #  # #####
 #  $ $   #
 # . $ #  ###
### . . # $ #
#   # . # $ #
# $   $ $  #
#   #      #
###########
`,
  // Level 10
  `
  #####
###   ##
#  $  #
#  # ###
#  #    ####
## .$ $ . #
 # # # $  #
 # . .  # #
 # . .  # #
 # ##  #  #
  ######
`,
];

export function parseLevel(raw: string): SokobanGrid {
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const maxLen = Math.max(...lines.map((l) => l.length));
  return lines.map((l) => {
    const row = l.padEnd(maxLen, " ").split("") as SokobanCell[];
    return row as SokobanCell[];
  });
}

function findPlayer(grid: SokobanGrid): [number, number] {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === "@" || grid[r][c] === "+") return [r, c];
    }
  }
  return [0, 0];
}

function deepCopyGrid(grid: SokobanGrid): SokobanGrid {
  return grid.map((row) => [...row] as SokobanCell[]);
}

function cellAt(grid: SokobanGrid, r: number, c: number): SokobanCell {
  if (r < 0 || r >= grid.length || c < 0 || c >= grid[r].length) return "#";
  return grid[r][c];
}

function isWalkable(cell: SokobanCell): boolean {
  return cell === " " || cell === ".";
}

function isTarget(cell: SokobanCell): boolean {
  return cell === "." || cell === "*" || cell === "+";
}

function setCell(grid: SokobanGrid, r: number, c: number, cell: SokobanCell) {
  if (r >= 0 && r < grid.length && c >= 0 && c < grid[r].length) {
    grid[r][c] = cell;
  }
}

export function initSokoban(levelIndex = 0): SokobanState {
  const grid = parseLevel(LEVELS[levelIndex % LEVELS.length]);
  const [pr, pc] = findPlayer(grid);
  return {
    grid,
    playerRow: pr,
    playerCol: pc,
    moveCount: 0,
    pushCount: 0,
    history: [],
    levelIndex,
    solved: false,
  };
}

export function movePlayer(state: SokobanState, dir: Direction): SokobanState {
  if (state.solved) return state;

  const [dr, dc] = DIRECTION_DELTA[dir];
  const pr = state.playerRow;
  const pc = state.playerCol;
  const nr = pr + dr;
  const nc = pc + dc;
  const target = cellAt(state.grid, nr, nc);

  if (target === "#") return state;

  const newGrid = deepCopyGrid(state.grid);

  if (target === "$" || target === "*") {
    const br = nr + dr;
    const bc = nc + dc;
    const beyond = cellAt(state.grid, br, bc);
    if (!isWalkable(beyond)) return state;

    const playerOnTarget = isTarget(cellAt(state.grid, pr, pc));
    setCell(newGrid, pr, pc, playerOnTarget ? "." : " ");
    setCell(newGrid, nr, nc, isTarget(target) ? "+" : "@");
    setCell(newGrid, br, bc, isTarget(beyond) ? "*" : "$");

    const newHistory = [...state.history, state.grid];
    const allBoxesOnTarget = isAllSolved(newGrid);

    return {
      ...state,
      grid: newGrid,
      playerRow: nr,
      playerCol: nc,
      moveCount: state.moveCount + 1,
      pushCount: state.pushCount + 1,
      history: newHistory,
      solved: allBoxesOnTarget,
    };
  }

  if (isWalkable(target)) {
    const playerOnTarget = isTarget(cellAt(state.grid, pr, pc));
    setCell(newGrid, pr, pc, playerOnTarget ? "." : " ");
    setCell(newGrid, nr, nc, isTarget(target) ? "+" : "@");

    return {
      ...state,
      grid: newGrid,
      playerRow: nr,
      playerCol: nc,
      moveCount: state.moveCount + 1,
      history: [...state.history, state.grid],
    };
  }

  return state;
}

export function undoMove(state: SokobanState): SokobanState {
  if (state.history.length === 0) return state;
  const prev = state.history[state.history.length - 1];
  const [pr, pc] = findPlayer(prev);
  return {
    ...state,
    grid: prev,
    playerRow: pr,
    playerCol: pc,
    moveCount: state.moveCount + 1,
    history: state.history.slice(0, -1),
    solved: false,
  };
}

function isAllSolved(grid: SokobanGrid): boolean {
  for (const row of grid) {
    for (const cell of row) {
      if (cell === "$") return false;
    }
  }
  return true;
}

export function getLevelCount(): number {
  return LEVELS.length;
}
