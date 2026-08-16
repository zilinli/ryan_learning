/**
 * Lab recommendation for the main chat: given a topic / recent interest,
 * pick the Studio lab that fits best and pitch it in one line.
 */

import { LAB_GAME_PARAM, LAB_TITLES, type LabId } from "./cross-lab";

export type LabRecommendation = {
  labId: LabId;
  gameParam: string;
  title: string;
  /** One-line pitch for the card (student-facing). */
  line: string;
};

/** Topic keyword → best-fit lab. First match wins. */
const LAB_ROUTES: Array<{ re: RegExp; to: LabId; line: string }> = [
  {
    re: /space|astronom|planet|star|universe|galaxy|black hole|cosmos|moon|mars|太阳|太空|宇宙|星球|星星|黑洞|火星|月球|航天/i,
    to: "ted",
    line: "想看看科学家怎么讲宇宙?去 TED Lab 看一场演讲,再和 AI 老师聊一聊。",
  },
  {
    re: /animal|wildlife|nature|ocean|dinosaur|biology|marine|forest|extinct|动物|恐龙|海洋|森林|生物|自然|生态/i,
    to: "natgeo",
    line: "大自然的故事最精彩——去 NatGeo Lab 看动物与地球的纪录片吧。",
  },
  {
    re: /psycholog|education|creativity|society|emotion|learning|大脑|心理|教育|创意|社会|情绪/i,
    to: "rsa",
    line: "关于头脑和社会的好问题,去 RSA Lab 听听思想家的短演讲。",
  },
  {
    re: /history|documentary|ancient|war|geography|climate|earth|environment|历史|纪录片|古代|地球|气候|环境|地理/i,
    to: "bbc",
    line: "想知道过去和世界为什么是这样?BBC Doc Lab 里有答案。",
  },
  {
    re: /science|technology|discovery|experiment|physics|chemistry|科学|技术|实验|物理|化学/i,
    to: "ted",
    line: "对科学新发现好奇吗?去 TED Lab 看看顶级的想法。",
  },
];

/** Fallback when nothing matches — rotate politely across labs. */
const FALLBACK_LABS: LabId[] = ["natgeo", "ted", "bbc", "rsa"];

export function suggestLabFromText(text: string): LabRecommendation | null {
  const t = String(text || "").trim();
  if (!t) return null;
  const slice = t.slice(0, 400);
  for (const route of LAB_ROUTES) {
    if (route.re.test(slice)) {
      return {
        labId: route.to,
        gameParam: LAB_GAME_PARAM[route.to],
        title: LAB_TITLES[route.to],
        line: route.line,
      };
    }
  }
  const labId = FALLBACK_LABS[Math.abs(hashString(slice)) % FALLBACK_LABS.length];
  const lines: Record<LabId, string> = {
    ted: "换个方式学——去 TED Lab 看一场演讲,和 AI 老师聊聊想法。",
    natgeo: "想出去看看世界?NatGeo Lab 有超棒的纪录片等着你。",
    bbc: "BBC Doc Lab 里有很多值得一看的纪录片,去逛逛?",
    rsa: "RSA Lab 里有关于教育、创造力的短演讲,去听听?",
  };
  return {
    labId,
    gameParam: LAB_GAME_PARAM[labId],
    title: LAB_TITLES[labId],
    line: lines[labId],
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}
