/**
 * Timeline Detective — Static case library.
 * G4-adapted history cases about Egypt, Mesopotamia, and early civilizations.
 */

export type TimelineEvent = {
  id: string;
  label: string;
  year?: number;
};

export type TimelineCase = {
  id: string;
  title: string;
  passage: string;
  events: TimelineEvent[];
  correctOrder: string[];
  evidenceSentenceIndices: number[];
  evidenceMap: Record<string, number>;
};

export const TIMELINE_CASES: TimelineCase[] = [
  {
    id: "nile-villages",
    title: "The Nile's Secret",
    passage:
      "The ancient Egyptians built the Great Pyramid of Giza around 2560 BCE. " +
      "Before the pyramids, early Egyptians lived in small villages along the Nile " +
      "around 5000 BCE. The writing system called hieroglyphics was developed " +
      "around 3200 BCE. Later, the Rosetta Stone was created in 196 BCE to " +
      "carry the same message in three different scripts.",
    events: [
      { id: "a", label: "Rosetta Stone created", year: -196 },
      { id: "b", label: "Great Pyramid built", year: -2560 },
      { id: "c", label: "Hieroglyphics developed", year: -3200 },
      { id: "d", label: "Early Nile villages", year: -5000 },
    ],
    correctOrder: ["d", "c", "b", "a"],
    evidenceSentenceIndices: [0, 1, 2, 3],
    evidenceMap: { d: 1, c: 2, b: 0, a: 3 },
  },
  {
    id: "egypt-kingdoms",
    title: "Kingdoms of Egypt",
    passage:
      "Ancient Egypt's history is divided into three main periods. " +
      "The Old Kingdom began around 2700 BCE and is known for pyramid building. " +
      "After a time of chaos, the Middle Kingdom started around 2050 BCE and " +
      "brought stability and art. The New Kingdom began around 1550 BCE and " +
      "was Egypt's golden age of empire and powerful pharaohs like Ramesses II.",
    events: [
      { id: "a", label: "New Kingdom begins", year: -1550 },
      { id: "b", label: "Old Kingdom begins", year: -2700 },
      { id: "c", label: "Middle Kingdom begins", year: -2050 },
    ],
    correctOrder: ["b", "c", "a"],
    evidenceSentenceIndices: [1, 2, 3],
    evidenceMap: { b: 1, c: 2, a: 3 },
  },
  {
    id: "mesopotamia-firsts",
    title: "Mesopotamia's Firsts",
    passage:
      "Mesopotamia, the land between two rivers, was home to many firsts. " +
      "The first cities appeared around 4000 BCE in Sumer. Writing, called " +
      "cuneiform, was invented around 3400 BCE. The Code of Hammurabi, one of " +
      "the first written law codes, was carved around 1750 BCE. The Hanging " +
      "Gardens of Babylon were built much later, around 600 BCE.",
    events: [
      { id: "a", label: "Hanging Gardens built", year: -600 },
      { id: "b", label: "First cities in Sumer", year: -4000 },
      { id: "c", label: "Cuneiform writing invented", year: -3400 },
      { id: "d", label: "Code of Hammurabi carved", year: -1750 },
    ],
    correctOrder: ["b", "c", "d", "a"],
    evidenceSentenceIndices: [1, 2, 3, 4],
    evidenceMap: { b: 1, c: 2, d: 3, a: 4 },
  },
  {
    id: "bronze-age",
    title: "The Bronze Age",
    passage:
      "Before humans used iron, they made tools and weapons from bronze. " +
      "The Bronze Age began around 3300 BCE in the Middle East. By 2500 BCE, " +
      "bronze had spread to Europe. The Iron Age began around 1200 BCE when " +
      "people discovered how to smelt iron, which was stronger and cheaper. " +
      "The Bronze Age ended at different times in different places.",
    events: [
      { id: "a", label: "Bronze reaches Europe", year: -2500 },
      { id: "b", label: "Bronze Age begins", year: -3300 },
      { id: "c", label: "Iron Age begins", year: -1200 },
    ],
    correctOrder: ["b", "a", "c"],
    evidenceSentenceIndices: [1, 2, 3],
    evidenceMap: { b: 1, a: 2, c: 3 },
  },
  {
    id: "trading-routes",
    title: "Ancient Trade Routes",
    passage:
      "Long ago, traders moved goods across vast distances. The Silk Road " +
      "began around 130 BCE and connected China to the Mediterranean. Even " +
      "earlier, around 2500 BCE, Egyptian ships traded along the Red Sea. " +
      "The Indian Ocean trade started around 800 BCE. By 200 CE, the Romans " +
      "were trading heavily with India and China through these routes.",
    events: [
      { id: "a", label: "Silk Road begins", year: -130 },
      { id: "b", label: "Egyptian Red Sea trade", year: -2500 },
      { id: "c", label: "Indian Ocean trade starts", year: -800 },
      { id: "d", label: "Romans trade with India", year: 200 },
    ],
    correctOrder: ["b", "c", "a", "d"],
    evidenceSentenceIndices: [1, 2, 3, 4],
    evidenceMap: { b: 1, c: 3, a: 1, d: 4 },
  },
  {
    id: "pyramid-evolution",
    title: "Pyramid Evolution",
    passage:
      "The first Egyptian tombs were simple pits in the desert. Around 2700 BCE, " +
      "they began building mastabas — flat, rectangular tombs. The Step Pyramid " +
      "of Djoser was built around 2650 BCE, stacking mastabas on top of each other. " +
      "The first smooth-sided pyramid, the Red Pyramid, was built around 2600 BCE. " +
      "The Great Pyramid at Giza followed shortly after, around 2560 BCE.",
    events: [
      { id: "a", label: "Red Pyramid built", year: -2600 },
      { id: "b", label: "First mastaba tombs", year: -2700 },
      { id: "c", label: "Step Pyramid built", year: -2650 },
      { id: "d", label: "Great Pyramid built", year: -2560 },
    ],
    correctOrder: ["b", "c", "a", "d"],
    evidenceSentenceIndices: [1, 2, 3, 4],
    evidenceMap: { b: 1, c: 2, a: 3, d: 4 },
  },
  {
    id: "river-civilizations",
    title: "River Civilizations",
    passage:
      "The world's first civilizations all grew along great rivers. Egypt grew " +
      "along the Nile starting around 3100 BCE. Mesopotamia developed between the " +
      "Tigris and Euphrates rivers around 3500 BCE. The Indus Valley civilization " +
      "emerged around 2600 BCE along the Indus River. In China, the Yellow River " +
      "gave birth to Chinese civilization around 2000 BCE.",
    events: [
      { id: "a", label: "Egypt along the Nile", year: -3100 },
      { id: "b", label: "Mesopotamia emerges", year: -3500 },
      { id: "c", label: "Indus Valley civilization", year: -2600 },
      { id: "d", label: "Chinese civilization begins", year: -2000 },
    ],
    correctOrder: ["b", "a", "c", "d"],
    evidenceSentenceIndices: [1, 2, 3, 4],
    evidenceMap: { b: 2, a: 1, c: 3, d: 4 },
  },
  {
    id: "pharaohs-timeline",
    title: "Famous Pharaohs",
    passage:
      "Egypt's most famous pharaohs ruled in different periods. Khufu, who " +
      "built the Great Pyramid, ruled around 2550 BCE. Hatshepsut, one of the " +
      "few female pharaohs, expanded trade routes around 1470 BCE. Tutankhamun, " +
      "the boy king, ruled briefly around 1330 BCE. Ramesses II, known as " +
      "Ramesses the Great, reigned for 66 years starting around 1279 BCE.",
    events: [
      { id: "a", label: "Tutankhamun rules", year: -1330 },
      { id: "b", label: "Khufu rules", year: -2550 },
      { id: "c", label: "Hatshepsut rules", year: -1470 },
      { id: "d", label: "Ramesses II begins reign", year: -1279 },
    ],
    correctOrder: ["b", "c", "a", "d"],
    evidenceSentenceIndices: [1, 2, 3, 4],
    evidenceMap: { b: 1, c: 2, a: 3, d: 4 },
  },
  {
    id: "writing-evolution",
    title: "The Story of Writing",
    passage:
      "Writing changed the world in several steps. The Sumerians developed " +
      "cuneiform around 3400 BCE. Egyptians created hieroglyphics around " +
      "3200 BCE. The Phoenicians simplified things with an alphabet around " +
      "1050 BCE. The Greeks added vowels to their alphabet around 800 BCE, " +
      "giving us the foundation of the modern alphabet.",
    events: [
      { id: "a", label: "Cuneiform developed", year: -3400 },
      { id: "b", label: "Greek alphabet with vowels", year: -800 },
      { id: "c", label: "Hieroglyphics created", year: -3200 },
      { id: "d", label: "Phoenician alphabet", year: -1050 },
    ],
    correctOrder: ["a", "c", "d", "b"],
    evidenceSentenceIndices: [1, 2, 3, 4],
    evidenceMap: { a: 1, c: 2, d: 3, b: 4 },
  },
  {
    id: "ancient-wonders",
    title: "Seven Ancient Wonders",
    passage:
      "Of the Seven Wonders of the Ancient World, the Great Pyramid of Giza " +
      "is the only one still standing. It was built around 2560 BCE and was " +
      "the tallest man-made structure for over 3,800 years. The Hanging Gardens " +
      "of Babylon were built around 600 BCE. The Colossus of Rhodes, a giant " +
      "statue, was completed around 280 BCE but destroyed by an earthquake.",
    events: [
      { id: "a", label: "Colossus of Rhodes completed", year: -280 },
      { id: "b", label: "Great Pyramid built", year: -2560 },
      { id: "c", label: "Hanging Gardens built", year: -600 },
    ],
    correctOrder: ["b", "c", "a"],
    evidenceSentenceIndices: [2, 3, 4],
    evidenceMap: { b: 2, c: 3, a: 4 },
  },
];
