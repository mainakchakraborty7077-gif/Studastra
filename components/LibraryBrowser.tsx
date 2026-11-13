"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ContentClass, ContentSubject } from "@/lib/learning-content";
import {
  chapterSortIndex,
  LIBRARY_LANGUAGES,
  OTHER_CHAPTER,
  syllabusChapters,
  UNSPECIFIED_LANGUAGE,
  type LibraryPlacement,
} from "@/lib/learning-library";

export type LibraryItem<T> = LibraryPlacement & {
  item: T;
  subject: ContentSubject;
  classLevel: ContentClass;
};

type FolderLanguage = LibraryPlacement["language"];

type ChapterFolder<T> = {
  key: string;
  subject: ContentSubject;
  classLevel: ContentClass;
  chapter: string;
  items: LibraryItem<T>[];
};

const SUBJECTS: ContentSubject[] = ["Physics", "Chemistry", "Mathematics", "Biology"];
const CLASSES: ContentClass[] = ["11", "12"];
const LANGUAGE_LABEL: Record<FolderLanguage, string> = {
  English: "English version",
  Bangla: "Bangla version",
  [UNSPECIFIED_LANGUAGE]: "Other / unspecified",
};
const LANGUAGE_NATIVE: Record<FolderLanguage, string> = {
  English: "English",
  Bangla: "বাংলা",
  [UNSPECIFIED_LANGUAGE]: "Language not marked",
};

export default function LibraryBrowser<T>({
  items,
  noun,
  renderItems,
}: {
  items: LibraryItem<T>[];
  /** plural word for the content, e.g. "notes" or "videos" */
  noun: string;
  renderItems: (items: LibraryItem<T>[], folder: { chapter: string; language: FolderLanguage }) => ReactNode;
}) {
  const [subjectFilter, setSubjectFilter] = useState<ContentSubject | "all">("all");
  const [classFilter, setClassFilter] = useState<ContentClass | "all">("all");
  const [showEmpty, setShowEmpty] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openLanguage, setOpenLanguage] = useState<FolderLanguage | null>(null);

  const folders = useMemo(() => {
    const map = new Map<string, ChapterFolder<T>>();
    const keyOf = (c: ContentClass, s: ContentSubject, ch: string) => [c, s, ch].join("|");

    if (showEmpty) {
      for (const classLevel of CLASSES) {
        for (const subject of SUBJECTS) {
          for (const chapter of syllabusChapters(classLevel, subject)) {
            const key = keyOf(classLevel, subject, chapter);
            map.set(key, { key, subject, classLevel, chapter, items: [] });
          }
        }
      }
    }
    for (const entry of items) {
      const key = keyOf(entry.classLevel, entry.subject, entry.chapter);
      const existing = map.get(key);
      if (existing) existing.items.push(entry);
      else map.set(key, { key, subject: entry.subject, classLevel: entry.classLevel, chapter: entry.chapter, items: [entry] });
    }
    return Array.from(map.values());
  }, [items, showEmpty]);

  const groups = useMemo(() => {
    const visible = folders.filter(
      (folder) =>
        (subjectFilter === "all" || folder.subject === subjectFilter) &&
        (classFilter === "all" || folder.classLevel === classFilter),
    );
    const result: Array<{ key: string; classLevel: ContentClass; subject: ContentSubject; folders: ChapterFolder<T>[] }> = [];
    for (const classLevel of CLASSES) {
      for (const subject of SUBJECTS) {
        const inGroup = visible
          .filter((folder) => folder.classLevel === classLevel && folder.subject === subject)
          .sort(
            (a, b) =>
              chapterSortIndex(classLevel, subject, a.chapter) - chapterSortIndex(classLevel, subject, b.chapter) ||
              a.chapter.localeCompare(b.chapter),
          );
        if (inGroup.length > 0) result.push({ key: classLevel + "|" + subject, classLevel, subject, folders: inGroup });
      }
    }
    return result;
  }, [folders, subjectFilter, classFilter]);

  const openFolder = folders.find((folder) => folder.key === openKey) ?? null;

  useEffect(() => {
    if (openKey && !openFolder) {
      setOpenKey(null);
      setOpenLanguage(null);
    }
  }, [openKey, openFolder]);

  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [openKey, openLanguage]);

  const languageFolders: FolderLanguage[] = openFolder
    ? [
        ...LIBRARY_LANGUAGES,
        ...(openFolder.items.some((entry) => entry.language === UNSPECIFIED_LANGUAGE) ? [UNSPECIFIED_LANGUAGE as FolderLanguage] : []),
      ]
    : [];
  const languageItems = openFolder && openLanguage ? openFolder.items.filter((entry) => entry.language === openLanguage) : [];

  function closeAll() {
    setOpenKey(null);
    setOpenLanguage(null);
  }

  return (
    <div className="lb">
      <style>{styles}</style>

      {openFolder && (
        <nav className="lb-crumbs" aria-label="Folder path">
          <button type="button" onClick={closeAll}>All chapters</button>
          <span aria-hidden>›</span>
          {openLanguage ? (
            <button type="button" onClick={() => setOpenLanguage(null)}>{openFolder.chapter}</button>
          ) : (
            <strong>{openFolder.chapter}</strong>
          )}
          {openLanguage && (
            <>
              <span aria-hidden>›</span>
              <strong>{LANGUAGE_LABEL[openLanguage]}</strong>
            </>
          )}
        </nav>
      )}

      {!openFolder && (
        <>
          <section className="lb-filters" aria-label={"Filter " + noun}>
            <label>Subject
              <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value as ContentSubject | "all")}>
                <option value="all">All subjects</option>
                {SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
              </select>
            </label>
            <label>Class
              <select value={classFilter} onChange={(event) => setClassFilter(event.target.value as ContentClass | "all")}>
                <option value="all">All classes</option>
                {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </label>
            <label className="lb-toggle">
              <input type="checkbox" checked={showEmpty} onChange={(event) => setShowEmpty(event.target.checked)} />
              Show all syllabus chapters
            </label>
          </section>

          {groups.length === 0 && <section className="lb-empty">No {noun} match these filters yet.</section>}

          {groups.map((group) => (
            <section className="lb-group" key={group.key}>
              <h2 className="lb-group-title">
                <span>CLASS {group.classLevel}</span> · {group.subject}
              </h2>
              <div className="lb-grid">
                {group.folders.map((folder) => {
                  const count = folder.items.length;
                  const en = folder.items.filter((e) => e.language === "English").length;
                  const bn = folder.items.filter((e) => e.language === "Bangla").length;
                  return (
                    <button
                      type="button"
                      key={folder.key}
                      className={count === 0 ? "lb-folder is-empty" : "lb-folder"}
                      onClick={() => { setOpenKey(folder.key); setOpenLanguage(null); }}
                    >
                      <span className="lb-icon" aria-hidden>📁</span>
                      <span className="lb-folder-copy">
                        <strong>{folder.chapter === OTHER_CHAPTER ? "Other / uncategorised" : folder.chapter}</strong>
                        <small>
                          {count === 0 ? "Coming soon" : `${count} ${count === 1 ? noun.replace(/s$/, "") : noun}`}
                          {count > 0 && (en > 0 || bn > 0) ? ` · EN ${en} · বাং ${bn}` : ""}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}

      {openFolder && !openLanguage && (
        <section className="lb-group">
          <p className="lb-meta">CLASS {openFolder.classLevel} · {openFolder.subject.toUpperCase()}</p>
          <h2 className="lb-chapter-title">{openFolder.chapter === OTHER_CHAPTER ? "Other / uncategorised" : openFolder.chapter}</h2>
          <div className="lb-grid lb-grid-lang">
            {languageFolders.map((language) => {
              const count = openFolder.items.filter((entry) => entry.language === language).length;
              return (
                <button
                  type="button"
                  key={language}
                  className={count === 0 ? "lb-folder lb-lang is-empty" : "lb-folder lb-lang"}
                  onClick={() => setOpenLanguage(language)}
                >
                  <span className="lb-icon" aria-hidden>📂</span>
                  <span className="lb-folder-copy">
                    <strong>{LANGUAGE_LABEL[language]}</strong>
                    <small>{LANGUAGE_NATIVE[language]} · {count === 0 ? "Nothing here yet" : `${count} ${count === 1 ? noun.replace(/s$/, "") : noun}`}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" className="lb-back" onClick={closeAll}>← All chapters</button>
        </section>
      )}

      {openFolder && openLanguage && (
        <section className="lb-group">
          <p className="lb-meta">CLASS {openFolder.classLevel} · {openFolder.subject.toUpperCase()} · {LANGUAGE_LABEL[openLanguage].toUpperCase()}</p>
          <h2 className="lb-chapter-title">{openFolder.chapter === OTHER_CHAPTER ? "Other / uncategorised" : openFolder.chapter}</h2>
          {languageItems.length === 0 ? (
            <section className="lb-empty">No {noun} in this folder yet.</section>
          ) : (
            renderItems(languageItems, { chapter: openFolder.chapter, language: openLanguage })
          )}
          <button type="button" className="lb-back" onClick={() => setOpenLanguage(null)}>← Back to {openFolder.chapter === OTHER_CHAPTER ? "folder" : openFolder.chapter}</button>
        </section>
      )}
    </div>
  );
}

const styles = `
.lb{display:block}
.lb-filters{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px;margin:8px 0 24px}
.lb-filters label{display:grid;gap:6px;min-width:180px;color:rgba(232,241,245,.75);font-size:13px}
.lb-filters select{padding:11px 13px;border:1px solid rgba(255,255,255,.13);border-radius:10px;background:#121c25;color:#e8f1f5}
.lb-filters .lb-toggle{display:flex;align-items:center;gap:8px;min-width:0;padding:11px 0}
.lb-group{margin:0 0 28px}
.lb-group-title{font-size:18px;margin:0 0 12px;color:#e8f1f5}
.lb-group-title span{font-size:12px;letter-spacing:.14em;color:#7fe7f2}
.lb-chapter-title{font-size:26px;margin:6px 0 18px}
.lb-meta{font-size:12px;letter-spacing:.08em;color:#7fe7f2;margin:0}
.lb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.lb-grid-lang{grid-template-columns:repeat(auto-fill,minmax(260px,1fr));margin-bottom:18px}
.lb-folder{display:flex;align-items:center;gap:14px;padding:16px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(18,28,37,.88);color:#e8f1f5;text-align:left;cursor:pointer;transition:border-color .15s,transform .15s,background .15s}
.lb-folder:hover{border-color:rgba(127,231,242,.55);background:rgba(20,40,50,.92);transform:translateY(-1px)}
.lb-folder.is-empty{opacity:.55}
.lb-lang{padding:22px 18px}
.lb-icon{font-size:26px;line-height:1;filter:drop-shadow(0 0 8px rgba(127,231,242,.35))}
.lb-folder-copy{display:grid;gap:4px;min-width:0}
.lb-folder-copy strong{font-size:15px;line-height:1.35}
.lb-folder-copy small{font-size:12px;color:rgba(232,241,245,.6)}
.lb-crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 18px;font-size:14px;color:rgba(232,241,245,.55)}
.lb-crumbs button{padding:0;border:0;background:none;color:#7fe7f2;cursor:pointer;font-size:14px}
.lb-crumbs strong{color:#e8f1f5;font-weight:600}
.lb-back{margin-top:18px;padding:9px 14px;border:1px solid rgba(127,231,242,.35);border-radius:9px;background:#122b34;color:#dffbff;cursor:pointer}
.lb-empty{padding:20px;border:1px solid rgba(255,255,255,.09);border-radius:18px;background:rgba(18,28,37,.88)}
`;
