/**
 * Local seed lexicons for EN / ES / FR common words.
 * Offline fallback when MW keys are missing and Free Dictionary API misses.
 * Also used as candidates for fuzzy "Did you mean?" suggestions.
 */

import type { DictEntry, DictLang, DictResponse } from "./dict-types";

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

type SeedEntry = { word: string; aliases?: string[]; entries: DictEntry[] };

function e(
  word: string,
  pos: string,
  def: string,
  opts?: {
    pronunciation?: string;
    example?: string;
    exampleTranslation?: string;
    aliases?: string[];
    inflections?: { label: string; form: string }[];
  },
): SeedEntry {
  return {
    word,
    aliases: opts?.aliases,
    entries: [
      {
        headword: word,
        pronunciation: opts?.pronunciation,
        partOfSpeech: pos,
        senses: [
          {
            definition: def,
            example: opts?.example,
            exampleTranslation: opts?.exampleTranslation,
          },
        ],
        inflections: opts?.inflections,
        source: "freedict",
      },
    ],
  };
}

const SPANISH_SEEDS: SeedEntry[] = [
  e("hola", "interjection", "hello, hi", { pronunciation: "/ˈola/", example: "¡Hola! ¿Cómo estás?", exampleTranslation: "Hello! How are you?" }),
  e("gracias", "interjection", "thank you, thanks", { pronunciation: "/ˈɡɾaθjas/", example: "Muchas gracias.", exampleTranslation: "Thank you very much." }),
  e("agua", "noun", "water", { pronunciation: "/ˈaɣwa/", example: "Un vaso de agua.", exampleTranslation: "A glass of water.", inflections: [{ label: "gender", form: "feminine (el agua)" }] }),
  e("casa", "noun", "house, home", { pronunciation: "/ˈkasa/", example: "Vivo en una casa.", exampleTranslation: "I live in a house." }),
  e("amigo", "noun", "friend (male)", { pronunciation: "/aˈmiɣo/", aliases: ["amiga"], example: "Él es mi amigo.", exampleTranslation: "He is my friend.", inflections: [{ label: "feminine", form: "amiga" }] }),
  e("escuela", "noun", "school", { pronunciation: "/esˈkwela/", example: "Voy a la escuela.", exampleTranslation: "I go to school." }),
  e("comer", "verb", "to eat", { pronunciation: "/koˈmeɾ/", example: "Vamos a comer.", exampleTranslation: "Let's eat." }),
  e("beber", "verb", "to drink", { pronunciation: "/beˈbeɾ/", example: "¿Quieres beber algo?", exampleTranslation: "Do you want to drink something?" }),
  e("grande", "adjective", "big, large, great", { pronunciation: "/ˈɡɾande/" }),
  e("pequeño", "adjective", "small, little", { pronunciation: "/peˈkeɲo/", aliases: ["pequeno", "pequeña"] }),
  e("bonito", "adjective", "pretty, beautiful, nice", { pronunciation: "/boˈnito/", aliases: ["bonita"] }),
  e("bueno", "adjective", "good", { pronunciation: "/ˈbweno/", aliases: ["buena", "buen"] }),
  e("por favor", "phrase", "please", { pronunciation: "/poɾ faˈβoɾ/", example: "Agua, por favor.", exampleTranslation: "Water, please." }),
  e("adiós", "interjection", "goodbye", { pronunciation: "/aˈðjos/", aliases: ["adios"] }),
  e("sí", "adverb", "yes", { pronunciation: "/ˈsi/", aliases: ["si"] }),
  e("no", "adverb", "no, not", { pronunciation: "/ˈno/" }),
  e("libro", "noun", "book", { pronunciation: "/ˈliβɾo/" }),
  e("amor", "noun", "love", { pronunciation: "/aˈmoɾ/" }),
  e("feliz", "adjective", "happy", { pronunciation: "/feˈliθ/" }),
  e("hermoso", "adjective", "beautiful", { pronunciation: "/eɾˈmoso/", aliases: ["hermosa"] }),
  e("español", "noun / adjective", "Spanish (language / from Spain)", { pronunciation: "/espaˈɲol/", aliases: ["espanol", "española", "spanish"] }),
  e("inglés", "noun / adjective", "English (language / from England)", { pronunciation: "/iŋˈɡles/", aliases: ["ingles", "inglesa"] }),
  e("francés", "noun / adjective", "French", { pronunciation: "/fɾanˈθes/", aliases: ["frances"] }),
  e("chino", "noun / adjective", "Chinese", { pronunciation: "/ˈtʃino/", aliases: ["china"] }),
  e("estudiante", "noun", "student", { pronunciation: "/estuðˈjante/" }),
  e("profesor", "noun", "teacher (male)", { pronunciation: "/pɾofeˈsoɾ/", aliases: ["profesora", "maestro", "maestra"] }),
  e("tarea", "noun", "homework / task", { pronunciation: "/taˈɾea/" }),
  e("matemáticas", "noun", "mathematics", { pronunciation: "/mateˈmatikas/", aliases: ["matematicas", "mates"] }),
  e("perro", "noun", "dog", { pronunciation: "/ˈpero/" }),
  e("gato", "noun", "cat", { pronunciation: "/ˈɡato/" }),
  e("familia", "noun", "family", { pronunciation: "/faˈmilja/" }),
  e("madre", "noun", "mother", { pronunciation: "/ˈmaðɾe/", aliases: ["mamá", "mama"] }),
  e("padre", "noun", "father", { pronunciation: "/ˈpaðɾe/", aliases: ["papá", "papa"] }),
  e("hermano", "noun", "brother", { pronunciation: "/eɾˈmano/", aliases: ["hermana"] }),
  e("día", "noun", "day", { pronunciation: "/ˈdia/", aliases: ["dia"] }),
  e("noche", "noun", "night", { pronunciation: "/ˈnotʃe/" }),
  e("mañana", "noun / adverb", "morning / tomorrow", { pronunciation: "/maˈɲana/", aliases: ["manana"] }),
  e("hoy", "adverb", "today", { pronunciation: "/ˈoj/" }),
  e("ayer", "adverb", "yesterday", { pronunciation: "/aˈʝeɾ/" }),
  e("siempre", "adverb", "always", { pronunciation: "/ˈsjempɾe/" }),
  e("nunca", "adverb", "never", { pronunciation: "/ˈnuŋka/" }),
  e("mucho", "adverb / adjective", "a lot / much / many", { pronunciation: "/ˈmutʃo/", aliases: ["mucha", "muchos"] }),
  e("poco", "adverb / adjective", "a little / few", { pronunciation: "/ˈpoko/" }),
  e("bien", "adverb", "well / fine", { pronunciation: "/ˈbjen/" }),
  e("mal", "adverb / adjective", "badly / bad", { pronunciation: "/ˈmal/" }),
  e("quiero", "verb form", "I want (querer)", { pronunciation: "/ˈkjeɾo/", aliases: ["querer"] }),
  e("tengo", "verb form", "I have (tener)", { pronunciation: "/ˈteŋɡo/", aliases: ["tener"] }),
  e("soy", "verb form", "I am (ser)", { pronunciation: "/ˈsoj/", aliases: ["ser", "estar", "estoy"] }),
  e("dónde", "adverb", "where", { pronunciation: "/ˈdonde/", aliases: ["donde"] }),
  e("cómo", "adverb", "how", { pronunciation: "/ˈkomo/", aliases: ["como"] }),
  e("qué", "pronoun", "what", { pronunciation: "/ˈke/", aliases: ["que"] }),
  e("quién", "pronoun", "who", { pronunciation: "/ˈkjen/", aliases: ["quien"] }),
  e("por qué", "phrase", "why", { pronunciation: "/poɾ ˈke/", aliases: ["porque", "por que"] }),
  e("también", "adverb", "also / too", { pronunciation: "/tamˈbjen/", aliases: ["tambien"] }),
  e("pero", "conjunction", "but", { pronunciation: "/ˈpeɾo/" }),
  e("y", "conjunction", "and", { pronunciation: "/i/" }),
  e("o", "conjunction", "or", { pronunciation: "/o/" }),
  e("con", "preposition", "with", { pronunciation: "/kon/" }),
  e("sin", "preposition", "without", { pronunciation: "/sin/" }),
  e("para", "preposition", "for / in order to", { pronunciation: "/ˈpaɾa/" }),
  e("de", "preposition", "of / from", { pronunciation: "/de/" }),
  e("en", "preposition", "in / on / at", { pronunciation: "/en/" }),
  e("el", "article", "the (masculine singular)", { pronunciation: "/el/", aliases: ["la", "los", "las"] }),
  e("un", "article", "a / an (masculine)", { pronunciation: "/un/", aliases: ["una"] }),
  e("rojo", "adjective", "red", { pronunciation: "/ˈroxo/", aliases: ["roja"] }),
  e("azul", "adjective", "blue", { pronunciation: "/aˈθul/" }),
  e("verde", "adjective", "green", { pronunciation: "/ˈbeɾðe/" }),
  e("blanco", "adjective", "white", { pronunciation: "/ˈblaŋko/", aliases: ["blanca"] }),
  e("negro", "adjective", "black", { pronunciation: "/ˈneɡɾo/", aliases: ["negra"] }),
  e("número", "noun", "number", { pronunciation: "/ˈnumeɾo/", aliases: ["numero"] }),
  e("palabra", "noun", "word", { pronunciation: "/paˈlabɾa/" }),
  e("diccionario", "noun", "dictionary", { pronunciation: "/dikθjoˈnaɾjo/" }),
];

const FRENCH_SEEDS: SeedEntry[] = [
  e("bonjour", "interjection", "hello, good morning, good day", { pronunciation: "/bɔ̃ʒuʁ/", example: "Bonjour !", exampleTranslation: "Hello!" }),
  e("merci", "interjection", "thank you, thanks", { pronunciation: "/mɛʁsi/", example: "Merci beaucoup.", exampleTranslation: "Thank you very much." }),
  e("eau", "noun", "water", { pronunciation: "/o/", inflections: [{ label: "gender", form: "feminine" }] }),
  e("maison", "noun", "house, home", { pronunciation: "/mɛzɔ̃/" }),
  e("ami", "noun", "friend (male)", { pronunciation: "/ami/", aliases: ["amie"], inflections: [{ label: "feminine", form: "amie" }] }),
  e("école", "noun", "school", { pronunciation: "/ekɔl/", aliases: ["ecole"] }),
  e("manger", "verb", "to eat", { pronunciation: "/mɑ̃ʒe/" }),
  e("boire", "verb", "to drink", { pronunciation: "/bwaʁ/" }),
  e("grand", "adjective", "big, large, tall, great", { pronunciation: "/ɡʁɑ̃/", aliases: ["grande"] }),
  e("petit", "adjective", "small, little", { pronunciation: "/pəti/", aliases: ["petite"] }),
  e("beau", "adjective", "beautiful, handsome", { pronunciation: "/bo/", aliases: ["belle", "bel"] }),
  e("bon", "adjective", "good", { pronunciation: "/bɔ̃/", aliases: ["bonne"] }),
  e("s'il vous plaît", "phrase", "please (formal)", { pronunciation: "/sil vu plɛ/", aliases: ["sil vous plait", "s'il te plaît", "sil te plait"] }),
  e("au revoir", "interjection", "goodbye", { pronunciation: "/o ʁəvwaʁ/" }),
  e("oui", "adverb", "yes", { pronunciation: "/wi/" }),
  e("non", "adverb", "no", { pronunciation: "/nɔ̃/" }),
  e("livre", "noun", "book", { pronunciation: "/livʁ/" }),
  e("amour", "noun", "love", { pronunciation: "/amuʁ/" }),
  e("heureux", "adjective", "happy", { pronunciation: "/œʁø/", aliases: ["heureuse"] }),
  e("château", "noun", "castle", { pronunciation: "/ʃɑto/", aliases: ["chateau"] }),
  e("français", "noun / adjective", "French (language / from France)", { pronunciation: "/fʁɑ̃sɛ/", aliases: ["francais", "française", "french"] }),
  e("anglais", "noun / adjective", "English", { pronunciation: "/ɑ̃ɡlɛ/", aliases: ["anglaise", "english"] }),
  e("espagnol", "noun / adjective", "Spanish", { pronunciation: "/ɛspaɲɔl/", aliases: ["espagnole", "spanish"] }),
  e("chinois", "noun / adjective", "Chinese", { pronunciation: "/ʃinwa/", aliases: ["chinoise"] }),
  e("étudiant", "noun", "student (male)", { pronunciation: "/etydjɑ̃/", aliases: ["etudiant", "étudiante", "etudiante"] }),
  e("professeur", "noun", "teacher / professor", { pronunciation: "/pʁɔfesœʁ/", aliases: ["prof"] }),
  e("devoirs", "noun", "homework", { pronunciation: "/dəvwaʁ/" }),
  e("mathématiques", "noun", "mathematics", { pronunciation: "/matematik/", aliases: ["mathematiques", "maths"] }),
  e("chien", "noun", "dog", { pronunciation: "/ʃjɛ̃/" }),
  e("chat", "noun", "cat", { pronunciation: "/ʃa/" }),
  e("famille", "noun", "family", { pronunciation: "/famij/" }),
  e("mère", "noun", "mother", { pronunciation: "/mɛʁ/", aliases: ["mere", "maman"] }),
  e("père", "noun", "father", { pronunciation: "/pɛʁ/", aliases: ["pere", "papa"] }),
  e("frère", "noun", "brother", { pronunciation: "/fʁɛʁ/", aliases: ["frere"] }),
  e("sœur", "noun", "sister", { pronunciation: "/sœʁ/", aliases: ["soeur"] }),
  e("jour", "noun", "day", { pronunciation: "/ʒuʁ/" }),
  e("nuit", "noun", "night", { pronunciation: "/nɥi/" }),
  e("matin", "noun", "morning", { pronunciation: "/matɛ̃/" }),
  e("aujourd'hui", "adverb", "today", { pronunciation: "/oʒuʁdɥi/", aliases: ["aujourdhui"] }),
  e("demain", "adverb", "tomorrow", { pronunciation: "/dəmɛ̃/" }),
  e("hier", "adverb", "yesterday", { pronunciation: "/jɛʁ/" }),
  e("toujours", "adverb", "always / still", { pronunciation: "/tuʒuʁ/" }),
  e("jamais", "adverb", "never", { pronunciation: "/ʒamɛ/" }),
  e("beaucoup", "adverb", "a lot / much", { pronunciation: "/boku/" }),
  e("peu", "adverb", "a little / few", { pronunciation: "/pø/" }),
  e("bien", "adverb", "well / fine", { pronunciation: "/bjɛ̃/" }),
  e("mal", "adverb", "badly / wrong", { pronunciation: "/mal/" }),
  e("je", "pronoun", "I", { pronunciation: "/ʒə/" }),
  e("tu", "pronoun", "you (informal)", { pronunciation: "/ty/" }),
  e("il", "pronoun", "he / it", { pronunciation: "/il/", aliases: ["elle"] }),
  e("nous", "pronoun", "we", { pronunciation: "/nu/" }),
  e("vous", "pronoun", "you (formal / plural)", { pronunciation: "/vu/" }),
  e("où", "adverb", "where", { pronunciation: "/u/", aliases: ["ou"] }),
  e("comment", "adverb", "how", { pronunciation: "/kɔmɑ̃/" }),
  e("quoi", "pronoun", "what", { pronunciation: "/kwa/" }),
  e("qui", "pronoun", "who", { pronunciation: "/ki/" }),
  e("pourquoi", "adverb", "why", { pronunciation: "/puʁkwa/" }),
  e("aussi", "adverb", "also / too", { pronunciation: "/osi/" }),
  e("mais", "conjunction", "but", { pronunciation: "/mɛ/" }),
  e("et", "conjunction", "and", { pronunciation: "/e/" }),
  e("ou", "conjunction", "or", { pronunciation: "/u/" }),
  e("avec", "preposition", "with", { pronunciation: "/avɛk/" }),
  e("sans", "preposition", "without", { pronunciation: "/sɑ̃/" }),
  e("pour", "preposition", "for", { pronunciation: "/puʁ/" }),
  e("de", "preposition", "of / from", { pronunciation: "/də/" }),
  e("dans", "preposition", "in", { pronunciation: "/dɑ̃/" }),
  e("le", "article", "the (masculine)", { pronunciation: "/lə/", aliases: ["la", "les", "l'"] }),
  e("un", "article", "a / an (masculine)", { pronunciation: "/œ̃/", aliases: ["une"] }),
  e("rouge", "adjective", "red", { pronunciation: "/ʁuʒ/" }),
  e("bleu", "adjective", "blue", { pronunciation: "/blø/", aliases: ["bleue"] }),
  e("vert", "adjective", "green", { pronunciation: "/vɛʁ/", aliases: ["verte"] }),
  e("blanc", "adjective", "white", { pronunciation: "/blɑ̃/", aliases: ["blanche"] }),
  e("noir", "adjective", "black", { pronunciation: "/nwaʁ/", aliases: ["noire"] }),
  e("nombre", "noun", "number", { pronunciation: "/nɔ̃bʁ/" }),
  e("mot", "noun", "word", { pronunciation: "/mo/" }),
  e("dictionnaire", "noun", "dictionary", { pronunciation: "/diksjɔnɛʁ/" }),
  e("je veux", "phrase", "I want", { pronunciation: "/ʒə vø/", aliases: ["vouloir"] }),
  e("j'ai", "phrase", "I have", { pronunciation: "/ʒe/", aliases: ["avoir", "jai"] }),
  e("je suis", "phrase", "I am", { pronunciation: "/ʒə sɥi/", aliases: ["être", "etre"] }),
];

const EN_SEEDS: SeedEntry[] = [
  e("the", "definite article", "Used before a noun to refer to a specific person or thing.", { pronunciation: "/ðə, ði/" }),
  e("a", "indefinite article", "Used before a singular noun when it is not specific.", { aliases: ["an"] }),
  e("hello", "interjection", "Used as a greeting or to begin a conversation.", { pronunciation: "/həˈloʊ/" }),
  e("dictionary", "noun", "A book or electronic resource that lists words and their meanings.", { pronunciation: "/ˈdɪkʃəˌnɛri/" }),
  e("spanish", "noun / adjective", "The language of Spain and much of Latin America; of or relating to Spain.", { pronunciation: "/ˈspænɪʃ/", aliases: ["spainish", "spanis"] }),
  e("english", "noun / adjective", "The language of England and many other countries; of England.", { pronunciation: "/ˈɪŋɡlɪʃ/" }),
  e("french", "noun / adjective", "The language of France; of or relating to France.", { pronunciation: "/frɛntʃ/" }),
  e("chinese", "noun / adjective", "The languages of China; of or relating to China.", { pronunciation: "/tʃaɪˈniːz/" }),
  e("cantonese", "noun / adjective", "A Chinese language spoken in Guangdong and Hong Kong.", { pronunciation: "/ˌkæntəˈniːz/" }),
  e("water", "noun", "A clear liquid that forms the seas, lakes, and rivers.", { pronunciation: "/ˈwɔːtər/" }),
  e("beautiful", "adjective", "Pleasing to the senses or mind; attractive.", { pronunciation: "/ˈbjuːtɪfəl/", aliases: ["beautifull", "beautyful"] }),
  e("imagination", "noun", "The ability to form new ideas or images in the mind.", { pronunciation: "/ɪˌmædʒɪˈneɪʃən/" }),
  e("school", "noun", "A place where children go to learn.", { pronunciation: "/skuːl/" }),
  e("student", "noun", "A person who is studying at a school or university.", { pronunciation: "/ˈstuːdənt/" }),
  e("teacher", "noun", "A person who teaches, especially in a school.", { pronunciation: "/ˈtiːtʃər/" }),
  e("homework", "noun", "School work that a student is given to do at home.", { pronunciation: "/ˈhoʊmwɜːrk/" }),
  e("math", "noun", "Mathematics (especially US).", { pronunciation: "/mæθ/", aliases: ["maths", "mathematics"] }),
  e("book", "noun", "A set of printed pages bound together.", { pronunciation: "/bʊk/" }),
  e("friend", "noun", "A person you know and like.", { pronunciation: "/frɛnd/" }),
  e("family", "noun", "A group of people related to each other.", { pronunciation: "/ˈfæməli/" }),
  e("mother", "noun", "A female parent.", { pronunciation: "/ˈmʌðər/", aliases: ["mom", "mum"] }),
  e("father", "noun", "A male parent.", { pronunciation: "/ˈfɑːðər/", aliases: ["dad"] }),
  e("brother", "noun", "A male sibling.", { pronunciation: "/ˈbrʌðər/" }),
  e("sister", "noun", "A female sibling.", { pronunciation: "/ˈsɪstər/" }),
  e("dog", "noun", "A common four-legged pet animal.", { pronunciation: "/dɔːɡ/" }),
  e("cat", "noun", "A small furry pet animal.", { pronunciation: "/kæt/" }),
  e("house", "noun", "A building where people live.", { pronunciation: "/haʊs/", aliases: ["home"] }),
  e("day", "noun", "A period of 24 hours; daytime.", { pronunciation: "/deɪ/" }),
  e("night", "noun", "The time of darkness between sunset and sunrise.", { pronunciation: "/naɪt/" }),
  e("morning", "noun", "The early part of the day.", { pronunciation: "/ˈmɔːrnɪŋ/" }),
  e("today", "adverb / noun", "On this day.", { pronunciation: "/təˈdeɪ/" }),
  e("tomorrow", "adverb / noun", "On the day after today.", { pronunciation: "/təˈmɔːroʊ/" }),
  e("yesterday", "adverb / noun", "On the day before today.", { pronunciation: "/ˈjɛstərdeɪ/" }),
  e("always", "adverb", "At all times; every time.", { pronunciation: "/ˈɔːlweɪz/" }),
  e("never", "adverb", "Not at any time.", { pronunciation: "/ˈnɛvər/" }),
  e("please", "adverb / interjection", "Used to make a request polite.", { pronunciation: "/pliːz/" }),
  e("thank you", "phrase", "Used to express gratitude.", { pronunciation: "/ˈθæŋk juː/", aliases: ["thanks"] }),
  e("goodbye", "interjection", "Used when leaving.", { pronunciation: "/ɡʊdˈbaɪ/", aliases: ["bye", "good bye"] }),
  e("yes", "adverb", "Used to agree or say something is true.", { pronunciation: "/jɛs/" }),
  e("no", "adverb", "Used to refuse or say something is not true.", { pronunciation: "/noʊ/" }),
  e("good", "adjective", "Of high quality; pleasant; kind.", { pronunciation: "/ɡʊd/" }),
  e("bad", "adjective", "Of low quality; unpleasant; wrong.", { pronunciation: "/bæd/" }),
  e("big", "adjective", "Large in size.", { pronunciation: "/bɪɡ/", aliases: ["large"] }),
  e("small", "adjective", "Little in size.", { pronunciation: "/smɔːl/", aliases: ["little"] }),
  e("happy", "adjective", "Feeling or showing pleasure.", { pronunciation: "/ˈhæpi/" }),
  e("sad", "adjective", "Feeling unhappy.", { pronunciation: "/sæd/" }),
  e("red", "adjective / noun", "The color of blood or fire.", { pronunciation: "/rɛd/" }),
  e("blue", "adjective / noun", "The color of a clear sky.", { pronunciation: "/bluː/" }),
  e("green", "adjective / noun", "The color of grass.", { pronunciation: "/ɡriːn/" }),
  e("white", "adjective / noun", "The color of snow or milk.", { pronunciation: "/waɪt/" }),
  e("black", "adjective / noun", "The darkest color.", { pronunciation: "/blæk/" }),
  e("word", "noun", "A single unit of language.", { pronunciation: "/wɜːrd/" }),
  e("number", "noun", "A symbol or word that represents an amount.", { pronunciation: "/ˈnʌmbər/" }),
  e("where", "adverb", "In or to what place.", { pronunciation: "/wɛr/" }),
  e("how", "adverb", "In what way.", { pronunciation: "/haʊ/" }),
  e("what", "pronoun", "Asking for information.", { pronunciation: "/wɒt/" }),
  e("who", "pronoun", "Asking which person.", { pronunciation: "/huː/" }),
  e("why", "adverb", "For what reason.", { pronunciation: "/waɪ/" }),
  e("because", "conjunction", "For the reason that.", { pronunciation: "/bɪˈkɒz/" }),
  e("and", "conjunction", "Used to connect words or clauses.", { pronunciation: "/ænd/" }),
  e("or", "conjunction", "Used to show a choice.", { pronunciation: "/ɔːr/" }),
  e("but", "conjunction", "Used to introduce a contrast.", { pronunciation: "/bʌt/" }),
  e("with", "preposition", "Together; having.", { pronunciation: "/wɪð/" }),
  e("without", "preposition", "Not having.", { pronunciation: "/wɪˈðaʊt/" }),
  e("for", "preposition", "Intended to belong to; because of.", { pronunciation: "/fɔːr/" }),
  e("from", "preposition", "Indicating origin.", { pronunciation: "/frɒm/" }),
  e("in", "preposition", "Inside; during.", { pronunciation: "/ɪn/" }),
  e("on", "preposition", "Supported by; about a topic.", { pronunciation: "/ɒn/" }),
  e("to", "preposition", "In the direction of; used with verbs.", { pronunciation: "/tuː/" }),
  e("want", "verb", "To wish for something.", { pronunciation: "/wɒnt/" }),
  e("have", "verb", "To own or possess.", { pronunciation: "/hæv/" }),
  e("be", "verb", "To exist; linking verb (am/is/are).", { pronunciation: "/biː/", aliases: ["am", "is", "are", "was", "were"] }),
  e("eat", "verb", "To put food in your mouth and swallow it.", { pronunciation: "/iːt/" }),
  e("drink", "verb", "To take liquid into your mouth and swallow it.", { pronunciation: "/drɪŋk/" }),
  e("go", "verb", "To move or travel somewhere.", { pronunciation: "/ɡoʊ/" }),
  e("come", "verb", "To move toward the speaker.", { pronunciation: "/kʌm/" }),
  e("see", "verb", "To notice with your eyes.", { pronunciation: "/siː/" }),
  e("look", "verb", "To direct your eyes; to appear.", { pronunciation: "/lʊk/" }),
  e("learn", "verb", "To get knowledge or skill.", { pronunciation: "/lɜːrn/" }),
  e("read", "verb", "To look at and understand written words.", { pronunciation: "/riːd/" }),
  e("write", "verb", "To form letters or words on a surface.", { pronunciation: "/raɪt/" }),
  e("speak", "verb", "To say words; to talk.", { pronunciation: "/spiːk/", aliases: ["talk"] }),
  e("listen", "verb", "To pay attention to sound.", { pronunciation: "/ˈlɪsən/" }),
  e("love", "noun / verb", "A strong feeling of affection; to care deeply.", { pronunciation: "/lʌv/" }),
  e("multilingual", "adjective", "Using or able to use several languages.", { pronunciation: "/ˌmʌltiˈlɪŋɡwəl/" }),
];

const ZH_SEEDS: SeedEntry[] = [
  e("你好", "interjection", "hello / hi", { pronunciation: "nǐ hǎo", aliases: ["您好"] }),
  e("谢谢", "interjection", "thank you", { pronunciation: "xièxie", aliases: ["多谢", "感謝"] }),
  e("水", "noun", "water", { pronunciation: "shuǐ" }),
  e("学习", "verb / noun", "to study / learning", { pronunciation: "xuéxí", aliases: ["學習"] }),
  e("字典", "noun", "dictionary", { pronunciation: "zìdiǎn", aliases: ["詞典", "词典"] }),
  e("美丽", "adjective", "beautiful", { pronunciation: "měilì", aliases: ["美麗", "漂亮"] }),
  e("学校", "noun", "school", { pronunciation: "xuéxiào", aliases: ["學校"] }),
  e("老师", "noun", "teacher", { pronunciation: "lǎoshī", aliases: ["老師"] }),
  e("学生", "noun", "student", { pronunciation: "xuésheng", aliases: ["學生"] }),
  e("朋友", "noun", "friend", { pronunciation: "péngyou" }),
  e("家", "noun", "home / family", { pronunciation: "jiā" }),
  e("书", "noun", "book", { pronunciation: "shū", aliases: ["書"] }),
  e("吃饭", "verb", "to eat a meal", { pronunciation: "chī fàn", aliases: ["吃飯"] }),
  e("喝", "verb", "to drink", { pronunciation: "hē" }),
  e("好", "adjective", "good / well", { pronunciation: "hǎo" }),
  e("大", "adjective", "big", { pronunciation: "dà" }),
  e("小", "adjective", "small", { pronunciation: "xiǎo" }),
  e("是", "verb", "to be", { pronunciation: "shì" }),
  e("不", "adverb", "not", { pronunciation: "bù" }),
  e("我", "pronoun", "I / me", { pronunciation: "wǒ" }),
  e("你", "pronoun", "you", { pronunciation: "nǐ" }),
  e("他", "pronoun", "he / him", { pronunciation: "tā", aliases: ["她", "它"] }),
];

const SEEDS: Record<string, SeedEntry[]> = {
  en: EN_SEEDS,
  es: SPANISH_SEEDS,
  fr: FRENCH_SEEDS,
  zh: ZH_SEEDS,
};

const SEED_INDEX: Record<string, Map<string, DictResponse>> = {};
const SEED_WORD_LIST: Record<string, string[]> = {};

function indexKey(s: string): string {
  return s.toLowerCase().trim();
}

function getSeedIndex(lang: string): Map<string, DictResponse> {
  if (!SEED_INDEX[lang]) {
    SEED_INDEX[lang] = new Map();
    const words: string[] = [];
    const seeds = SEEDS[lang] || [];
    for (const s of seeds) {
      const resp: DictResponse = {
        word: s.word,
        lang: lang as DictLang,
        entries: s.entries,
      };
      const keys = new Set<string>([
        indexKey(s.word),
        stripAccents(indexKey(s.word)),
        ...(s.aliases ?? []).flatMap((a) => [indexKey(a), stripAccents(indexKey(a))]),
      ]);
      for (const k of keys) {
        if (!k) continue;
        if (!SEED_INDEX[lang]!.has(k)) SEED_INDEX[lang]!.set(k, resp);
      }
      words.push(s.word);
      if (s.aliases) words.push(...s.aliases);
    }
    SEED_WORD_LIST[lang] = [...new Set(words)];
  }
  return SEED_INDEX[lang]!;
}

/** All seed headwords + aliases for fuzzy suggestion. */
export function listSeedWords(lang: DictLang): string[] {
  getSeedIndex(lang);
  return SEED_WORD_LIST[lang] ?? [];
}

/** Look up a word in the local seed lexicon (offline fallback). */
export function localSeedLookup(word: string, lang: DictLang): DictResponse | null {
  const key = indexKey(word);
  const index = getSeedIndex(lang);
  return index.get(key) ?? index.get(stripAccents(key)) ?? null;
}

/** Search seed entries by partial match (for suggestions). */
export function searchLocalSeeds(word: string, lang: DictLang, limit = 10): DictResponse[] {
  const key = indexKey(word);
  const bare = stripAccents(key);
  const results: DictResponse[] = [];
  const seen = new Set<string>();
  const index = getSeedIndex(lang);
  for (const [w, resp] of index) {
    if (w.startsWith(key) || w.includes(key) || w.startsWith(bare) || w.includes(bare)) {
      if (seen.has(resp.word)) continue;
      seen.add(resp.word);
      results.push(resp);
      if (results.length >= limit) break;
    }
  }
  return results;
}
