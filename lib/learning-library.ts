import { SYLLABUS_BY_CLASS } from "@/lib/syllabus";
import type { ContentClass, ContentSubject } from "@/lib/learning-content";

/**
 * Chapter + language organisation for the student notes and videos library.
 *
 * No database migration is needed:
 *  - Videos already store `chapter`; notes do not, so their chapter is read from
 *    a hidden tag the admin form writes into `summary`, or detected from the title.
 *  - Language is read from the same hidden tag (videos keep it in `description`),
 *    or detected from the title: "(English Version)", "(Bangla Version)",
 *    "Bengali", or Bengali script.
 *
 * Hidden tag format (stripped before showing text to students):
 *   [[chapter:Gravitation|lang:English]]
 */

export type LibraryLanguage = "English" | "Bangla";
export const LIBRARY_LANGUAGES: LibraryLanguage[] = ["English", "Bangla"];
export const OTHER_CHAPTER = "Other";
export const UNSPECIFIED_LANGUAGE = "Unspecified";

export type LibraryTag = { chapter?: string; language?: LibraryLanguage };

const TAG_RE = /\[\[([^\]]*)\]\]/;

export function parseLibraryTag(text: string | null | undefined): LibraryTag & { text: string } {
  const raw = text ?? "";
  const match = raw.match(TAG_RE);
  if (!match) return { text: raw };
  const tag: LibraryTag = {};
  for (const part of match[1].split("|")) {
    const index = part.indexOf(":");
    if (index < 0) continue;
    const key = part.slice(0, index).trim().toLowerCase();
    const value = part.slice(index + 1).trim();
    if (!value) continue;
    if (key === "chapter") tag.chapter = value;
    if (key === "lang" || key === "language") {
      const lang = normalizeLanguage(value);
      if (lang) tag.language = lang;
    }
  }
  return { ...tag, text: raw.replace(TAG_RE, "").trim() };
}

export function withLibraryTag(text: string, tag: LibraryTag): string {
  const clean = parseLibraryTag(text).text;
  const parts: string[] = [];
  if (tag.chapter) parts.push("chapter:" + tag.chapter.replace(/[|\]]/g, " ").trim());
  if (tag.language) parts.push("lang:" + tag.language);
  if (parts.length === 0) return clean;
  const marker = "[[" + parts.join("|") + "]]";
  return clean ? marker + " " + clean : marker;
}

function normalizeLanguage(value: string): LibraryLanguage | null {
  const v = value.trim().toLowerCase();
  if (v.startsWith("en")) return "English";
  if (v.startsWith("ban") || v.startsWith("ben") || v === "bn" || v.includes("বাংলা")) return "Bangla";
  return null;
}

const BENGALI_SCRIPT = /[\u0980-\u09FF]/;

/** Language from explicit wording first, then Bengali script. */
export function detectLanguage(...texts: Array<string | null | undefined>): LibraryLanguage | null {
  for (const text of texts) {
    if (!text) continue;
    if (/\b(bangla|bengali)\b/i.test(text) || text.includes("বাংলা")) return "Bangla";
    if (/\benglish\b/i.test(text) || text.includes("ইংরেজি")) return "English";
  }
  for (const text of texts) {
    if (text && BENGALI_SCRIPT.test(text)) return "Bangla";
  }
  return null;
}

/** Extra names (Bengali and common English short forms) mapped to NCERT chapter titles. */
const CHAPTER_ALIASES: Record<ContentClass, Partial<Record<ContentSubject, Record<string, string[]>>>> = {
  "11": {
    Physics: {
      "Units and Measurements": ["একক ও পরিমাপ", "পরিমাপ"],
      "Motion in a Straight Line": ["সরলরেখায় গতি", "সরলরৈখিক গতি"],
      "Motion in a Plane": ["সমতলে গতি", "projectile motion", "প্রাস"],
      "Laws of Motion": ["newton's laws", "গতির নিয়ম", "গতিসূত্র"],
      "Work, Energy and Power": ["work energy", "কার্য শক্তি", "শক্তি ও ক্ষমতা"],
      "System of Particles and Rotational Motion": ["rotational motion", "rotation", "ঘূর্ণন"],
      Gravitation: ["gravity", "মহাকর্ষ", "অভিকর্ষ"],
      "Mechanical Properties of Solids": ["elasticity", "স্থিতিস্থাপকতা"],
      "Mechanical Properties of Fluids": ["fluid mechanics", "fluids", "viscosity", "surface tension", "সান্দ্রতা", "পৃষ্ঠটান", "প্রবাহী"],
      "Thermal Properties of Matter": ["calorimetry", "heat transfer", "তাপের ধর্ম"],
      Thermodynamics: ["তাপগতিবিদ্যা"],
      "Kinetic Theory": ["kinetic theory of gases", "গতীয় তত্ত্ব"],
      Oscillations: ["shm", "simple harmonic", "দোলন", "সরল দোলগতি"],
      Waves: ["sound waves", "তরঙ্গ"],
    },
    Chemistry: {
      "Some Basic Concepts of Chemistry": ["mole concept", "stoichiometry", "মোল"],
      "Structure of Atom": ["atomic structure", "পরমাণুর গঠন"],
      "Classification of Elements and Periodicity in Properties": ["periodic table", "periodicity", "পর্যায় সারণি"],
      "Chemical Bonding and Molecular Structure": ["chemical bonding", "রাসায়নিক বন্ধন"],
      "Chemical Thermodynamics": ["thermodynamics", "তাপগতিবিদ্যা"],
      Equilibrium: ["ionic equilibrium", "chemical equilibrium", "সাম্যাবস্থা"],
      "Redox Reactions": ["redox", "জারণ", "বিজারণ"],
      "Organic Chemistry: Some Basic Principles and Techniques": ["goc", "general organic chemistry", "জৈব রসায়ন"],
      Hydrocarbons: ["হাইড্রোকার্বন"],
    },
    Mathematics: {
      Sets: ["সেট"],
      "Relations and Functions": ["সম্পর্ক ও অপেক্ষক", "অপেক্ষক"],
      "Trigonometric Functions": ["trigonometry", "ত্রিকোণমিতি"],
      "Complex Numbers and Quadratic Equations": ["complex numbers", "quadratic equations", "জটিল সংখ্যা", "দ্বিঘাত"],
      "Linear Inequalities": ["inequalities", "অসমতা"],
      "Permutations and Combinations": ["permutation", "combination", "বিন্যাস", "সমবায়"],
      "Binomial Theorem": ["দ্বিপদ উপপাদ্য"],
      "Sequences and Series": ["progression", "শ্রেণি", "প্রগতি"],
      "Straight Lines": ["straight line", "সরলরেখা"],
      "Conic Sections": ["parabola", "ellipse", "hyperbola", "কনিক", "শঙ্কু"],
      "Introduction to Three Dimensional Geometry": ["3d geometry", "ত্রিমাত্রিক"],
      "Limits and Derivatives": ["limits", "সীমা"],
      Statistics: ["রাশিবিজ্ঞান"],
      Probability: ["সম্ভাবনা"],
    },
    Biology: {
      "The Living World": ["জীবজগৎ"],
      "Biological Classification": ["শ্রেণিবিন্যাস"],
      "Plant Kingdom": ["উদ্ভিদজগৎ"],
      "Animal Kingdom": ["প্রাণীজগৎ"],
      "Morphology of Flowering Plants": ["সপুষ্পক উদ্ভিদের অঙ্গসংস্থান"],
      "Anatomy of Flowering Plants": ["সপুষ্পক উদ্ভিদের শারীরস্থান"],
      "Structural Organisation in Animals": ["প্রাণীদের গঠনগত সংগঠন"],
      "Cell: The Unit of Life": ["cell biology", "কোশ", "কোষ"],
      Biomolecules: ["জৈব অণু"],
      "Cell Cycle and Cell Division": ["cell division", "mitosis", "meiosis", "কোশ বিভাজন", "কোষ বিভাজন"],
      "Photosynthesis in Higher Plants": ["photosynthesis", "সালোকসংশ্লেষ"],
      "Respiration in Plants": ["plant respiration", "শ্বসন"],
      "Plant Growth and Development": ["plant hormones", "বৃদ্ধি ও বিকাশ"],
      "Breathing and Exchange of Gases": ["breathing", "শ্বাসকার্য"],
      "Body Fluids and Circulation": ["circulation", "সংবহন"],
      "Excretory Products and their Elimination": ["excretion", "রেচন"],
      "Locomotion and Movement": ["locomotion", "চলন"],
      "Neural Control and Coordination": ["nervous system", "neural control", "স্নায়ু"],
      "Chemical Coordination and Integration": ["chemical control", "chemical coordination", "endocrine", "hormones", "রাসায়নিক সমন্বয়", "হরমোন"],
    },
  },
  "12": {
    Physics: {
      "Electric Charges and Fields": ["electrostatics", "তড়িৎ আধান", "তড়িৎক্ষেত্র"],
      "Electrostatic Potential and Capacitance": ["capacitance", "capacitor", "তড়িৎ বিভব", "ধারকত্ব"],
      "Current Electricity": ["তড়িৎপ্রবাহ", "চলতড়িৎ"],
      "Moving Charges and Magnetism": ["magnetic effect of current", "তড়িৎপ্রবাহের চৌম্বক ক্রিয়া"],
      "Magnetism and Matter": ["চুম্বকত্ব"],
      "Electromagnetic Induction": ["emi", "তড়িৎচুম্বকীয় আবেশ"],
      "Alternating Current": ["ac circuits", "পরিবর্তী প্রবাহ"],
      "Electromagnetic Waves": ["em waves", "তড়িৎচুম্বকীয় তরঙ্গ"],
      "Ray Optics and Optical Instruments": ["ray optics", "geometrical optics", "জ্যামিতিক আলোকবিজ্ঞান", "প্রতিসরণ", "প্রতিফলন"],
      "Wave Optics": ["interference", "diffraction", "তরঙ্গ আলোকবিজ্ঞান"],
      "Dual Nature of Radiation and Matter": ["photoelectric", "dual nature", "দ্বৈত সত্তা"],
      Atoms: ["atomic physics", "পরমাণু"],
      Nuclei: ["nuclear physics", "নিউক্লিয়াস"],
      "Semiconductor Electronics: Materials, Devices and Simple Circuits": ["semiconductor", "অর্ধপরিবাহী"],
    },
    Chemistry: {
      Solutions: ["দ্রবণ"],
      Electrochemistry: ["তড়িৎ রসায়ন"],
      "Chemical Kinetics": ["রাসায়নিক গতিবিদ্যা"],
      "The d- and f-Block Elements": ["d block", "f block", "d-block", "f-block"],
      "Coordination Compounds": ["সন্নিবেশ যৌগ"],
      "Haloalkanes and Haloarenes": ["হ্যালোঅ্যালকেন"],
      "Alcohols, Phenols and Ethers": ["alcohols", "phenols", "অ্যালকোহল"],
      "Aldehydes, Ketones and Carboxylic Acids": ["aldehydes", "ketones", "carboxylic", "অ্যালডিহাইড"],
      Amines: ["অ্যামিন"],
      Biomolecules: ["জৈব অণু"],
    },
    Mathematics: {
      "Relations and Functions": ["সম্পর্ক ও অপেক্ষক"],
      "Inverse Trigonometric Functions": ["inverse trigonometry", "বিপরীত ত্রিকোণমিতিক"],
      Matrices: ["matrix", "ম্যাট্রিক্স"],
      Determinants: ["determinant", "নির্ণায়ক"],
      "Continuity and Differentiability": ["continuity", "differentiation", "সন্ততা", "অবকলন"],
      "Application of Derivatives": ["maxima", "minima", "অবকলজের প্রয়োগ"],
      Integrals: ["integration", "সমাকলন"],
      "Application of Integrals": ["area under", "সমাকলনের প্রয়োগ"],
      "Differential Equations": ["অবকল সমীকরণ"],
      "Vector Algebra": ["vectors", "ভেক্টর"],
      "Three Dimensional Geometry": ["3d geometry", "ত্রিমাত্রিক জ্যামিতি"],
      "Linear Programming": ["lpp", "রৈখিক প্রোগ্রাম"],
      Probability: ["সম্ভাবনা"],
    },
    Biology: {
      "Sexual Reproduction in Flowering Plants": ["plant reproduction", "সপুষ্পক উদ্ভিদের যৌন জনন"],
      "Human Reproduction": ["মানব জনন"],
      "Reproductive Health": ["জনন স্বাস্থ্য"],
      "Principles of Inheritance and Variation": ["genetics", "mendel", "বংশগতি"],
      "Molecular Basis of Inheritance": ["dna", "বংশগতির আণবিক"],
      Evolution: ["বিবর্তন", "অভিব্যক্তি"],
      "Human Health and Disease": ["diseases", "immunity", "স্বাস্থ্য ও রোগ"],
      "Microbes in Human Welfare": ["microbes", "জীবাণু"],
      "Biotechnology: Principles and Processes": ["জৈবপ্রযুক্তি: নীতি"],
      "Biotechnology and its Applications": ["জৈবপ্রযুক্তির প্রয়োগ"],
      "Organisms and Populations": ["population", "জীব ও জনসংখ্যা"],
      Ecosystem: ["বাস্তুতন্ত্র"],
      "Biodiversity and Conservation": ["biodiversity", "জীববৈচিত্র্য"],
    },
  },
};

export function syllabusChapters(classLevel: ContentClass, subject: ContentSubject): readonly string[] {
  return SYLLABUS_BY_CLASS[classLevel]?.[subject] ?? [];
}

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9\u0980-\u09FF']+/g, " ")
    .trim();
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const h = " " + norm(haystack) + " ";
  const p = norm(phrase);
  if (!p) return false;
  // Latin phrases must match whole words; Bengali compounds match as substrings.
  if (BENGALI_SCRIPT.test(p)) return h.includes(p);
  return h.includes(" " + p + " ");
}

/** Best syllabus chapter mentioned in any of the texts (longest match wins). */
export function detectChapter(
  classLevel: ContentClass,
  subject: ContentSubject,
  ...texts: Array<string | null | undefined>
): string | null {
  const chapters = syllabusChapters(classLevel, subject);
  const aliases = CHAPTER_ALIASES[classLevel]?.[subject] ?? {};
  for (const text of texts) {
    if (!text) continue;
    let best: { chapter: string; length: number } | null = null;
    for (const chapter of chapters) {
      const candidates = [chapter, ...(aliases[chapter] ?? [])];
      for (const candidate of candidates) {
        if (containsPhrase(text, candidate) && (!best || candidate.length > best.length)) {
          best = { chapter, length: candidate.length };
        }
      }
    }
    if (best) return best.chapter;
  }
  return null;
}

/** Map a stored chapter string onto the matching NCERT title (case-insensitive). */
export function canonicalChapter(
  classLevel: ContentClass,
  subject: ContentSubject,
  chapter: string | null | undefined,
): string | null {
  const value = (chapter ?? "").trim();
  if (!value || /^(uncategori[sz]ed|other)$/i.test(value)) return null;
  const exact = syllabusChapters(classLevel, subject).find((item) => norm(item) === norm(value));
  return exact ?? value;
}

export function chapterSortIndex(classLevel: ContentClass, subject: ContentSubject, chapter: string): number {
  if (chapter === OTHER_CHAPTER) return 10_000;
  const index = syllabusChapters(classLevel, subject).indexOf(chapter);
  return index < 0 ? 5_000 : index;
}

export type LibraryPlacement = { chapter: string; language: LibraryLanguage | typeof UNSPECIFIED_LANGUAGE };

export function placeNote(note: {
  title: string;
  summary: string;
  content: string;
  subject: ContentSubject;
  class_level: ContentClass;
}): LibraryPlacement & { cleanSummary: string } {
  const tag = parseLibraryTag(note.summary);
  const chapter =
    canonicalChapter(note.class_level, note.subject, tag.chapter) ??
    detectChapter(note.class_level, note.subject, note.title, tag.text, note.content.slice(0, 400)) ??
    OTHER_CHAPTER;
  const language = tag.language ?? detectLanguage(note.title, tag.text) ?? UNSPECIFIED_LANGUAGE;
  return { chapter, language, cleanSummary: tag.text };
}

export function placeVideo(video: {
  title: string;
  description: string;
  subject: ContentSubject;
  class_level: ContentClass;
  chapter: string;
}): LibraryPlacement & { cleanDescription: string } {
  const tag = parseLibraryTag(video.description);
  const chapter =
    canonicalChapter(video.class_level, video.subject, video.chapter) ??
    canonicalChapter(video.class_level, video.subject, tag.chapter) ??
    detectChapter(video.class_level, video.subject, video.title, tag.text) ??
    OTHER_CHAPTER;
  const language = tag.language ?? detectLanguage(video.title, tag.text) ?? UNSPECIFIED_LANGUAGE;
  return { chapter, language, cleanDescription: tag.text };
}
