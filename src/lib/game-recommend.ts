/**
 * Game recommendation for the main chat — pick a learning game from the
 * recent topic so "let's play" lands on something that reinforces the
 * current skill instead of random arcade.
 */

import type { GameId } from "./entertain/types";

export type GameRecommendation = {
  gameId: GameId;
  title: string;
  line: string;
};

/** Topic keyword → best-fit learning game. First match wins. */
const GAME_ROUTES: Array<{ re: RegExp; gameId: GameId; title: string; line: string }> = [
  {
    re: /fraction|decimal|percent|ratio|number line|分母|分数|小数|百分比|比例|数轴/i,
    gameId: "fraction-voyager",
    title: "Fraction Voyager",
    line: "分数与数轴正对味——开飞船,把分数放对位置。",
  },
  {
    re: /force|gravity|push|pull|motion|velocity|力|重力|推力|拉力|运动|速度/i,
    gameId: "force-bay",
    title: "Force Bay",
    line: "力的世界——推拖船,猜猜它会停在哪儿。",
  },
  {
    re: /energy|electric|circuit|heat|light|sound|能量|电|电路|热|光|声/i,
    gameId: "energy-chain",
    title: "Energy Chain",
    line: "能量会在机器里怎么变身?去 Energy Chain 里试试。",
  },
  {
    re: /orbit|planet|gravity|space|satellite|轨道|行星|卫星|太空/i,
    gameId: "orbit-scout",
    title: "Orbit Scout",
    line: "星球和轨道——去 Orbit Scout 感受引力的方向。",
  },
  {
    re: /ecosystem|food chain|habitat|species|population|生态|食物链|栖息地|种群/i,
    gameId: "eco-genesis",
    title: "Eco Genesis",
    line: "生态系统的秘密——去 Eco Genesis 亲手搭建一个世界。",
  },
  {
    re: /history|timeline|ancient|civilization|war|century|历史|时间线|古代|文明|世纪/i,
    gameId: "time-vault",
    title: "Time Vault",
    line: "历史事件该按什么顺序排?Time Vault 请你当考古侦探。",
  },
  {
    re: /spelling|word|vocabulary|英语|拼写|单词|词汇/i,
    gameId: "word-echo",
    title: "Spell Words",
    line: "来 Spell Words 听一个、写一个,拼写越练越稳。",
  },
];

/** Lightweight "recent skill" hints — passed by the caller from memory/session. */
export type GameContextHints = {
  /** Recent subject tags, e.g. ["math","fraction"] or ["science","ecosystem"]. */
  tags?: string[];
  /** Free text fallback (last user message / topic). */
  text?: string;
};

/** Deterministic fallback within learning games. */
const FALLBACK_GAMES: GameId[] = [
  "fraction-voyager",
  "eco-genesis",
  "orbit-scout",
  "word-echo",
];

const TITLES: Partial<Record<GameId, string>> = {
  "fraction-voyager": "Fraction Voyager",
  "force-bay": "Force Bay",
  "energy-chain": "Energy Chain",
  "orbit-scout": "Orbit Scout",
  "eco-genesis": "Eco Genesis",
  "time-vault": "Time Vault",
  "word-echo": "Spell Words",
};

const FALLBACK_LINES: Partial<Record<GameId, string>> = {
  "fraction-voyager": "想放松也想练手?来开一趟分数飞船。",
  "force-bay": "想放松也想练手?去 Force Bay 推两艘船。",
  "orbit-scout": "想放松也想练手?去 Orbit Scout 转一圈。",
  "word-echo": "想放松也想练手?来拼几个单词。",
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function suggestGame(hints: GameContextHints): GameRecommendation | null {
  const tagText = (hints.tags || []).join(" ");
  const text = [tagText, hints.text || ""].filter(Boolean).join(" ").slice(0, 400);
  if (!text) {
    const gameId = FALLBACK_GAMES[0];
    return {
      gameId,
      title: TITLES[gameId] ?? gameId,
      line: FALLBACK_LINES[gameId] ?? `想放松也想练手?来玩 ${TITLES[gameId] ?? gameId}。`,
    };
  }
  for (const route of GAME_ROUTES) {
    if (route.re.test(text)) {
      return { gameId: route.gameId, title: route.title, line: route.line };
    }
  }
  const gameId =
    FALLBACK_GAMES[Math.abs(hashString(text)) % FALLBACK_GAMES.length];
  return {
    gameId,
    title: TITLES[gameId] ?? gameId,
    line: FALLBACK_LINES[gameId] ?? `想放松也想练手?来玩 ${TITLES[gameId] ?? gameId}。`,
  };
}
