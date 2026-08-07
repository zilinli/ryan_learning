/**
 * Small local seed lexicons for Spanish and French common words.
 * Provides useful results when API keys are not configured and
 * Free Dictionary API (English Wiktionary) has no foreign entries.
 */

import type { DictEntry, DictLang, DictResponse } from "./dict-types";

type SeedEntry = { word: string; entries: DictEntry[] };

const SPANISH_SEEDS: SeedEntry[] = [
  { word: "hola", entries: [{ headword: "hola", pronunciation: "/ˈola/", partOfSpeech: "interjection", senses: [{ definition: "hello, hi", example: "¡Hola! ¿Cómo estás?", exampleTranslation: "Hello! How are you?" }], source: "freedict" }] },
  { word: "gracias", entries: [{ headword: "gracias", pronunciation: "/ˈɡɾaθjas/", partOfSpeech: "interjection", senses: [{ definition: "thank you, thanks", example: "Muchas gracias por tu ayuda.", exampleTranslation: "Thank you very much for your help." }], source: "freedict" }] },
  { word: "agua", entries: [{ headword: "agua", pronunciation: "/ˈaɣwa/", partOfSpeech: "noun", senses: [{ definition: "water", example: "Un vaso de agua, por favor.", exampleTranslation: "A glass of water, please." }], inflections: [{ label: "gender", form: "feminine (el agua)" }], source: "freedict" }] },
  { word: "casa", entries: [{ headword: "casa", pronunciation: "/ˈkasa/", partOfSpeech: "noun", senses: [{ definition: "house, home", example: "Vivo en una casa pequeña.", exampleTranslation: "I live in a small house." }], inflections: [{ label: "gender", form: "feminine" }], source: "freedict" }] },
  { word: "amigo", entries: [{ headword: "amigo", pronunciation: "/aˈmiɣo/", partOfSpeech: "noun", senses: [{ definition: "friend (male)", example: "Él es mi mejor amigo.", exampleTranslation: "He is my best friend." }], inflections: [{ label: "feminine", form: "amiga" }, { label: "plural", form: "amigos" }], source: "freedict" }] },
  { word: "escuela", entries: [{ headword: "escuela", pronunciation: "/esˈkwela/", partOfSpeech: "noun", senses: [{ definition: "school", example: "Voy a la escuela cada día.", exampleTranslation: "I go to school every day." }], inflections: [{ label: "gender", form: "feminine" }], source: "freedict" }] },
  { word: "comer", entries: [{ headword: "comer", pronunciation: "/koˈmeɾ/", partOfSpeech: "verb", senses: [{ definition: "to eat", example: "Vamos a comer ahora.", exampleTranslation: "Let's eat now." }], inflections: [{ label: "present", form: "como, comes, come, comemos, coméis, comen" }], source: "freedict" }] },
  { word: "beber", entries: [{ headword: "beber", pronunciation: "/beˈbeɾ/", partOfSpeech: "verb", senses: [{ definition: "to drink", example: "¿Quieres beber algo?", exampleTranslation: "Do you want to drink something?" }], source: "freedict" }] },
  { word: "grande", entries: [{ headword: "grande", pronunciation: "/ˈɡɾande/", partOfSpeech: "adjective", senses: [{ definition: "big, large, great", example: "Es una ciudad muy grande.", exampleTranslation: "It's a very big city." }], source: "freedict" }] },
  { word: "pequeño", entries: [{ headword: "pequeño", pronunciation: "/peˈkeɲo/", partOfSpeech: "adjective", senses: [{ definition: "small, little", example: "Un perro pequeño.", exampleTranslation: "A small dog." }], inflections: [{ label: "feminine", form: "pequeña" }], source: "freedict" }] },
  { word: "bonito", entries: [{ headword: "bonito", pronunciation: "/boˈnito/", partOfSpeech: "adjective", senses: [{ definition: "pretty, beautiful, nice", example: "¡Qué bonito es este lugar!", exampleTranslation: "How beautiful this place is!" }], source: "freedict" }] },
  { word: "bueno", entries: [{ headword: "bueno", pronunciation: "/ˈbweno/", partOfSpeech: "adjective", senses: [{ definition: "good", example: "Es un buen libro.", exampleTranslation: "It's a good book." }], inflections: [{ label: "before m.sg", form: "buen" }], source: "freedict" }] },
  { word: "por favor", entries: [{ headword: "por favor", pronunciation: "/poɾ faˈβoɾ/", partOfSpeech: "phrase", senses: [{ definition: "please", example: "Agua, por favor.", exampleTranslation: "Water, please." }], source: "freedict" }] },
  { word: "adiós", entries: [{ headword: "adiós", pronunciation: "/aˈðjos/", partOfSpeech: "interjection", senses: [{ definition: "goodbye, farewell", example: "¡Adiós! Nos vemos mañana.", exampleTranslation: "Goodbye! See you tomorrow." }], source: "freedict" }] },
  { word: "sí", entries: [{ headword: "sí", pronunciation: "/ˈsi/", partOfSpeech: "adverb", senses: [{ definition: "yes", example: "Sí, claro que sí.", exampleTranslation: "Yes, of course." }], source: "freedict" }] },
  { word: "no", entries: [{ headword: "no", pronunciation: "/ˈno/", partOfSpeech: "adverb", senses: [{ definition: "no, not", example: "No, gracias.", exampleTranslation: "No, thank you." }], source: "freedict" }] },
  { word: "libro", entries: [{ headword: "libro", pronunciation: "/ˈliβɾo/", partOfSpeech: "noun", senses: [{ definition: "book", example: "Estoy leyendo un libro.", exampleTranslation: "I'm reading a book." }], source: "freedict" }] },
  { word: "amor", entries: [{ headword: "amor", pronunciation: "/aˈmoɾ/", partOfSpeech: "noun", senses: [{ definition: "love", example: "Te quiero con todo mi amor.", exampleTranslation: "I love you with all my heart." }], source: "freedict" }] },
  { word: "feliz", entries: [{ headword: "feliz", pronunciation: "/feˈliθ/", partOfSpeech: "adjective", senses: [{ definition: "happy", example: "¡Feliz cumpleaños!", exampleTranslation: "Happy birthday!" }], source: "freedict" }] },
  { word: "hermoso", entries: [{ headword: "hermoso", pronunciation: "/eɾˈmoso/", partOfSpeech: "adjective", senses: [{ definition: "beautiful, gorgeous", example: "Un día hermoso.", exampleTranslation: "A beautiful day." }], source: "freedict" }] },
];

const FRENCH_SEEDS: SeedEntry[] = [
  { word: "bonjour", entries: [{ headword: "bonjour", pronunciation: "/bɔ̃ʒuʁ/", partOfSpeech: "interjection", senses: [{ definition: "hello, good morning, good day", example: "Bonjour, comment allez-vous ?", exampleTranslation: "Hello, how are you?" }], source: "freedict" }] },
  { word: "merci", entries: [{ headword: "merci", pronunciation: "/mɛʁsi/", partOfSpeech: "interjection", senses: [{ definition: "thank you, thanks", example: "Merci beaucoup pour votre aide.", exampleTranslation: "Thank you very much for your help." }], source: "freedict" }] },
  { word: "eau", entries: [{ headword: "eau", pronunciation: "/o/", partOfSpeech: "noun", senses: [{ definition: "water", example: "Un verre d'eau, s'il vous plaît.", exampleTranslation: "A glass of water, please." }], inflections: [{ label: "gender", form: "feminine" }], source: "freedict" }] },
  { word: "maison", entries: [{ headword: "maison", pronunciation: "/mɛzɔ̃/", partOfSpeech: "noun", senses: [{ definition: "house, home", example: "J'habite dans une grande maison.", exampleTranslation: "I live in a big house." }], inflections: [{ label: "gender", form: "feminine" }], source: "freedict" }] },
  { word: "ami", entries: [{ headword: "ami", pronunciation: "/ami/", partOfSpeech: "noun", senses: [{ definition: "friend (male)", example: "C'est mon meilleur ami.", exampleTranslation: "He's my best friend." }], inflections: [{ label: "feminine", form: "amie" }, { label: "plural", form: "amis" }], source: "freedict" }] },
  { word: "école", entries: [{ headword: "école", pronunciation: "/ekɔl/", partOfSpeech: "noun", senses: [{ definition: "school", example: "Je vais à l'école.", exampleTranslation: "I go to school." }], inflections: [{ label: "gender", form: "feminine" }], source: "freedict" }] },
  { word: "manger", entries: [{ headword: "manger", pronunciation: "/mɑ̃ʒe/", partOfSpeech: "verb", senses: [{ definition: "to eat", example: "Je veux manger maintenant.", exampleTranslation: "I want to eat now." }], source: "freedict" }] },
  { word: "boire", entries: [{ headword: "boire", pronunciation: "/bwaʁ/", partOfSpeech: "verb", senses: [{ definition: "to drink", example: "Tu veux boire quelque chose ?", exampleTranslation: "Do you want something to drink?" }], source: "freedict" }] },
  { word: "grand", entries: [{ headword: "grand", pronunciation: "/ɡʁɑ̃/", partOfSpeech: "adjective", senses: [{ definition: "big, large, tall, great", example: "C'est une grande ville.", exampleTranslation: "It's a big city." }], inflections: [{ label: "feminine", form: "grande" }], source: "freedict" }] },
  { word: "petit", entries: [{ headword: "petit", pronunciation: "/pəti/", partOfSpeech: "adjective", senses: [{ definition: "small, little", example: "Un petit chien.", exampleTranslation: "A small dog." }], inflections: [{ label: "feminine", form: "petite" }], source: "freedict" }] },
  { word: "beau", entries: [{ headword: "beau", pronunciation: "/bo/", partOfSpeech: "adjective", senses: [{ definition: "beautiful, handsome", example: "Quel beau paysage !", exampleTranslation: "What a beautiful landscape!" }], inflections: [{ label: "before vowel", form: "bel" }, { label: "feminine", form: "belle" }], source: "freedict" }] },
  { word: "bon", entries: [{ headword: "bon", pronunciation: "/bɔ̃/", partOfSpeech: "adjective", senses: [{ definition: "good", example: "C'est un bon livre.", exampleTranslation: "It's a good book." }], inflections: [{ label: "feminine", form: "bonne" }], source: "freedict" }] },
  { word: "s'il vous plaît", entries: [{ headword: "s'il vous plaît", pronunciation: "/sil vu plɛ/", partOfSpeech: "phrase", senses: [{ definition: "please (formal)", example: "Un café, s'il vous plaît.", exampleTranslation: "A coffee, please." }], source: "freedict" }] },
  { word: "au revoir", entries: [{ headword: "au revoir", pronunciation: "/o ʁəvwaʁ/", partOfSpeech: "interjection", senses: [{ definition: "goodbye", example: "Au revoir et bonne journée !", exampleTranslation: "Goodbye and have a nice day!" }], source: "freedict" }] },
  { word: "oui", entries: [{ headword: "oui", pronunciation: "/wi/", partOfSpeech: "adverb", senses: [{ definition: "yes", example: "Oui, bien sûr.", exampleTranslation: "Yes, of course." }], source: "freedict" }] },
  { word: "non", entries: [{ headword: "non", pronunciation: "/nɔ̃/", partOfSpeech: "adverb", senses: [{ definition: "no", example: "Non, merci.", exampleTranslation: "No, thank you." }], source: "freedict" }] },
  { word: "livre", entries: [{ headword: "livre", pronunciation: "/livʁ/", partOfSpeech: "noun", senses: [{ definition: "book", example: "Je lis un livre.", exampleTranslation: "I'm reading a book." }], source: "freedict" }] },
  { word: "amour", entries: [{ headword: "amour", pronunciation: "/amuʁ/", partOfSpeech: "noun", senses: [{ definition: "love", example: "L'amour est magnifique.", exampleTranslation: "Love is beautiful." }], source: "freedict" }] },
  { word: "heureux", entries: [{ headword: "heureux", pronunciation: "/œʁø/", partOfSpeech: "adjective", senses: [{ definition: "happy", example: "Je suis très heureux.", exampleTranslation: "I am very happy." }], inflections: [{ label: "feminine", form: "heureuse" }], source: "freedict" }] },
  { word: "château", entries: [{ headword: "château", pronunciation: "/ʃɑto/", partOfSpeech: "noun", senses: [{ definition: "castle", example: "Le château est très ancien.", exampleTranslation: "The castle is very old." }], source: "freedict" }] },
];

const EN_SEEDS: SeedEntry[] = [
  { word: "the", entries: [{ headword: "the", pronunciation: "/ðə, ði/", partOfSpeech: "definite article", senses: [{ definition: "Used before a noun to refer to a specific person or thing.", example: "The book on the table is mine." }], source: "freedict" }] },
  { word: "hello", entries: [{ headword: "hello", pronunciation: "/həˈloʊ/", partOfSpeech: "interjection", senses: [{ definition: "Used as a greeting or to begin a conversation.", example: "Hello, how are you?" }], source: "freedict" }] },
  { word: "dictionary", entries: [{ headword: "dictionary", pronunciation: "/ˈdɪkʃəˌnɛri/", partOfSpeech: "noun", senses: [{ definition: "A book or electronic resource that lists words and their meanings.", example: "Look it up in the dictionary." }], source: "freedict" }] },
];

const SEEDS: Record<string, SeedEntry[]> = {
  en: EN_SEEDS,
  es: SPANISH_SEEDS,
  fr: FRENCH_SEEDS,
};

const SEED_INDEX: Record<string, Map<string, DictResponse>> = {};

function getSeedIndex(lang: string): Map<string, DictResponse> {
  if (!SEED_INDEX[lang]) {
    SEED_INDEX[lang] = new Map();
    const seeds = SEEDS[lang] || [];
    for (const s of seeds) {
      SEED_INDEX[lang]!.set(s.word.toLowerCase().trim(), {
        word: s.word,
        lang: lang as DictLang,
        entries: s.entries,
      });
    }
  }
  return SEED_INDEX[lang]!;
}

/** Look up a word in the local seed lexicon (offline fallback). */
export function localSeedLookup(word: string, lang: DictLang): DictResponse | null {
  const key = word.toLowerCase().trim();
  return getSeedIndex(lang).get(key) ?? null;
}

/** Search seed entries by partial match (for suggestions). */
export function searchLocalSeeds(word: string, lang: DictLang, limit = 10): DictResponse[] {
  const key = word.toLowerCase().trim();
  const results: DictResponse[] = [];
  const index = getSeedIndex(lang);
  for (const [w, resp] of index) {
    if (w.startsWith(key) || w.includes(key)) {
      results.push(resp);
      if (results.length >= limit) break;
    }
  }
  return results;
}
