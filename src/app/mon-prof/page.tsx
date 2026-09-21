"use client";

/* ══════════════════════════════════════════════════════════════
   MON PROF — Interface
   Trois écrans : accueil (mes cours), import (analyse d'un cours),
   classe (tableau + conversation + progression).
   Le comportement pédagogique vient entièrement de lib/monprof.
   ══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BoardFrame, Course, CourseProgress, Dimension, LearnerProfile, Message, TutorState, TutorTurn,
} from "@/types/monprof";
import { DIMENSION_LABEL, DIMENSIONS, STATUS_ICON, STATUS_LABEL } from "@/types/monprof";
import { begin, handle, initialState, progressionLines, type TutorContext } from "@/lib/monprof/tutor";
import { courseMastery, emptyMemory, getMemory, globalMastery, stepPosition } from "@/lib/monprof/mastery";
import { canParse, parseCourse } from "@/lib/monprof/parser";
import {
  deleteImportedCourse, emptyProfile, loadAllProgress, loadCourses, loadProfile, loadProgress,
  newProgress, resetCourseProgress, saveImportedCourse, saveProfile, saveProgress,
} from "@/lib/monprof/storage";
import { canListen, canSpeak, listen, speak, stopSpeaking } from "@/lib/monprof/voice";

/* ── Palette ────────────────────────────────────────────────── */

const C = {
  bg: "#0B1120",
  panel: "#131E33",
  panel2: "#1B2942",
  border: "#27364F",
  text: "#E7ECF5",
  dim: "#93A3BD",
  accent: "#6366F1",
  accent2: "#818CF8",
  board: "#12322A",
  boardLine: "#1E4A3D",
  chalk: "#EAF6EF",
  chalkDim: "#9FC9B5",
  yellow: "#F4CE6A",
  green: "#34D399",
  orange: "#FB923C",
  red: "#F87171",
};

const CSS = String.raw`
  .mp-shell { min-height: 100vh; background: ${C.bg}; color: ${C.text}; font-family: 'Sora', sans-serif; }
  .mp-class { display: grid; grid-template-columns: 1.15fr 1fr; gap: 16px; align-items: stretch; }
  .mp-side { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .mp-home-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .mp-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .mp-chalk { animation: mp-fade .45s ease both; }
  @keyframes mp-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes mp-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
  .mp-rec { animation: mp-pulse 1.1s infinite; }
  .mp-scroll::-webkit-scrollbar { width: 8px; }
  .mp-scroll::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 8px; }
  @media (max-width: 900px) {
    .mp-class { grid-template-columns: 1fr !important; }
    .mp-side { grid-template-columns: 1fr !important; }
    .mp-home-grid { grid-template-columns: 1fr !important; }
    .mp-actions { grid-template-columns: 1fr !important; }
  }
`;

/* ── Petits composants ──────────────────────────────────────── */

function Bar({ value, color = C.accent, height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <div style={{ background: "#0A1526", borderRadius: 99, height, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: color, borderRadius: 99, transition: "width .5s ease" }} />
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, ...style }}>
      {children}
    </div>
  );
}

function Btn({
  children, onClick, kind = "primary", disabled, title, style,
}: {
  children: React.ReactNode; onClick?: () => void; kind?: "primary" | "ghost" | "danger";
  disabled?: boolean; title?: string; style?: React.CSSProperties;
}) {
  const palette =
    kind === "primary"
      ? { bg: C.accent, fg: "#fff", bd: C.accent }
      : kind === "danger"
      ? { bg: "transparent", fg: C.red, bd: "#4A2230" }
      : { bg: "transparent", fg: C.text, bd: C.border };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: palette.bg, color: palette.fg, border: `1px solid ${palette.bd}`,
        borderRadius: 11, padding: "11px 16px", fontSize: 13, fontWeight: 600,
        fontFamily: "inherit", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1, ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ── Le tableau ─────────────────────────────────────────────── */

function Board({ frame }: { frame: BoardFrame | null }) {
  return (
    <div
      style={{
        background: C.board, border: `1px solid ${C.boardLine}`, borderRadius: 16,
        padding: "20px 22px", minHeight: 330, height: "100%",
        boxShadow: "inset 0 0 90px rgba(0,0,0,.35)", position: "relative", overflow: "auto",
      }}
      className="mp-scroll"
    >
      <div style={{ position: "absolute", top: 12, right: 16, fontSize: 10, letterSpacing: 2, color: C.chalkDim }}>
        TABLEAU
      </div>
      {!frame ? (
        <div style={{ color: C.chalkDim, fontSize: 13, marginTop: 40, textAlign: "center", lineHeight: 1.9 }}>
          Le tableau se remplira au fur et à mesure du cours.
        </div>
      ) : (
        <div key={frame.title} className="mp-chalk">
          <div style={{ color: C.chalk, fontWeight: 800, fontSize: 17, letterSpacing: 1.4, marginBottom: 6 }}>
            {frame.title}
          </div>
          <div style={{ height: 2, background: C.chalkDim, opacity: 0.45, marginBottom: 14, borderRadius: 2 }} />
          <div style={{ fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 13.5, lineHeight: 1.95 }}>
            {frame.lines.map((l, i) => {
              if (l.kind === "rule")
                return <div key={i} style={{ height: 1, background: C.chalkDim, opacity: 0.28, margin: "10px 0" }} />;
              if (l.kind === "label")
                return <div key={i} style={{ color: C.yellow, fontWeight: 700, marginTop: 8, letterSpacing: 0.6 }}>{l.text}</div>;
              if (l.kind === "formula")
                return (
                  <div key={i} style={{ color: C.chalk, fontSize: 16, fontWeight: 700, padding: "6px 0 6px 12px", borderLeft: `3px solid ${C.yellow}`, margin: "6px 0" }}>
                    {l.text}
                  </div>
                );
              if (l.kind === "step")
                return <div key={i} style={{ color: C.chalk, paddingLeft: 10 }}>↳ {l.text}</div>;
              if (l.kind === "highlight")
                return (
                  <div key={i} style={{ color: "#0C2019", background: C.chalk, borderRadius: 6, padding: "3px 9px", display: "inline-block", margin: "6px 0", fontWeight: 700 }}>
                    {l.text}
                  </div>
                );
              return <div key={i} style={{ color: C.chalkDim, whiteSpace: "pre-wrap" }}>{l.text}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Conversation ───────────────────────────────────────────── */

const TONE: Record<string, { bd: string; icon: string }> = {
  neutre: { bd: C.border, icon: "" },
  succes: { bd: C.green, icon: "✅ " },
  erreur: { bd: C.red, icon: "❌ " },
  indice: { bd: C.yellow, icon: "💡 " },
  validation: { bd: C.accent2, icon: "🎯 " },
};

function Bubble({ m }: { m: Message }) {
  if (m.from === "eleve") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <div style={{ background: C.accent, color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "10px 14px", maxWidth: "82%", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {m.text}
        </div>
      </div>
    );
  }
  const tone = TONE[m.tone ?? "neutre"] ?? TONE.neutre;
  return (
    <div style={{ display: "flex", gap: 9, marginBottom: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 9, background: C.panel2, display: "grid", placeItems: "center", fontSize: 14, flexShrink: 0 }}>👨‍🏫</div>
      <div style={{ background: C.panel2, borderLeft: `3px solid ${tone.bd}`, borderRadius: "4px 14px 14px 14px", padding: "10px 14px", maxWidth: "88%", fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
        {tone.icon}{m.text}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE
   ══════════════════════════════════════════════════════════════ */

type View = "accueil" | "import" | "classe";

export default function MonProfPage() {
  const [view, setView] = useState<View>("accueil");
  const [courses, setCourses] = useState<Course[]>([]);
  const [allProgress, setAllProgress] = useState<Record<string, CourseProgress>>({});
  const [profile, setProfile] = useState<LearnerProfile>(emptyProfile());

  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [state, setState] = useState<TutorState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [board, setBoard] = useState<BoardFrame | null>(null);

  const [input, setInput] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const stopRec = useRef<(() => void) | null>(null);
  const feed = useRef<HTMLDivElement | null>(null);

  /* Import */
  const [rawCourse, setRawCourse] = useState("");
  const [importTitle, setImportTitle] = useState("");
  const [report, setReport] = useState<string[] | null>(null);
  const [parsed, setParsed] = useState<Course | null>(null);
  const [importError, setImportError] = useState("");

  /* ── Chargement initial ── */
  useEffect(() => {
    setCourses(loadCourses());
    setAllProgress(loadAllProgress());
    setProfile(loadProfile());
  }, []);

  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => { stopSpeaking(); stopRec.current?.(); }, []);

  /* ── Application d'un tour du moteur ── */
  const applyTurn = useCallback(
    (turn: TutorTurn, base: CourseProgress, speakIt: boolean) => {
      const nextProgress: CourseProgress = {
        ...base,
        memory: { ...base.memory, ...turn.memoryPatch },
        diagnostic: { ...base.diagnostic, ...(turn.diagnosticPatch ?? {}) },
        currentConceptId: turn.state.conceptId,
        turn: turn.state.turn,
        lastPosition: turn.state.conceptId ?? base.lastPosition,
      };
      setProgress(nextProgress);
      saveProgress(nextProgress);
      setAllProgress((p) => ({ ...p, [nextProgress.courseId]: nextProgress }));
      setState(turn.state);
      setMessages((prev) => [...prev, ...turn.messages]);
      if (turn.board) setBoard(turn.board);

      if (turn.errorLabel || turn.strategyThatWorked) {
        setProfile((prev) => {
          const next: LearnerProfile = {
            ...prev,
            preferredStrategy: turn.strategyThatWorked ?? prev.preferredStrategy,
            frequentErrors: turn.errorLabel
              ? { ...prev.frequentErrors, [turn.errorLabel]: (prev.frequentErrors[turn.errorLabel] ?? 0) + 1 }
              : prev.frequentErrors,
          };
          saveProfile(next);
          return next;
        });
      }

      if (speakIt && turn.speech) {
        setSpeaking(true);
        speak(turn.speech, () => setSpeaking(false));
      }
    },
    []
  );

  /* ── Démarrer / reprendre un cours ── */
  const openCourse = useCallback(
    (c: Course) => {
      const p = loadProgress(c.id);
      const ctx: TutorContext = {
        course: c,
        state: { ...initialState(c.id), turn: p.turn, phase: p.diagnostic.done ? "cartographie" : "diagnostic" },
        memory: p.memory,
        profile,
        diagnostic: p.diagnostic,
      };
      setCourse(c);
      setProgress(p);
      setMessages([]);
      setBoard(null);
      setView("classe");
      applyTurn(begin(ctx, profile.name || undefined), p, voiceOn);
    },
    [applyTurn, profile, voiceOn]
  );

  /* ── Envoi d'une réponse ── */
  const send = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || !course || !progress || !state) return;
      stopSpeaking();
      setSpeaking(false);
      setInput("");
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}`, from: "eleve", text: value, tone: "neutre", at: Date.now() },
      ]);
      const ctx: TutorContext = { course, state, memory: progress.memory, profile, diagnostic: progress.diagnostic };
      applyTurn(handle(value, ctx), progress, voiceOn);
    },
    [applyTurn, course, profile, progress, state, voiceOn]
  );

  /* ── Micro ── */
  const toggleMic = useCallback(() => {
    if (recording) { stopRec.current?.(); stopRec.current = null; setRecording(false); return; }
    stopSpeaking();
    const stop = listen(
      (text) => { setRecording(false); stopRec.current = null; send(text); },
      () => { setRecording(false); stopRec.current = null; }
    );
    if (stop) { stopRec.current = stop; setRecording(true); }
  }, [recording, send]);

  /* ── Import d'un cours ── */
  const analyse = useCallback(() => {
    const check = canParse(rawCourse);
    if (!check.ok) { setImportError(check.reason ?? "Texte inexploitable."); setReport(null); setParsed(null); return; }
    setImportError("");
    const { course: c, report: r } = parseCourse(rawCourse, importTitle);
    setParsed(c);
    setReport(r);
  }, [rawCourse, importTitle]);

  const startParsed = useCallback(() => {
    if (!parsed) return;
    saveImportedCourse(parsed);
    setCourses(loadCourses());
    setRawCourse(""); setImportTitle(""); setReport(null); setParsed(null);
    openCourse(parsed);
  }, [parsed, openCourse]);

  const onFile = useCallback((file: File | null) => {
    if (!file) return;
    if (/\.pdf$/i.test(file.name)) {
      setImportError("Je ne sais pas lire un PDF directement : ouvre-le, copie le texte, et colle-le ci-dessous. L'analyse sera identique.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setRawCourse(String(reader.result ?? ""));
      setImportTitle((t) => t || file.name.replace(/\.[a-z0-9]+$/i, ""));
      setImportError("");
    };
    reader.readAsText(file);
  }, []);

  /* ── Données dérivées ── */
  const lines = useMemo(
    () => (course && progress ? progressionLines(course, progress.memory) : []),
    [course, progress]
  );
  const mastery = useMemo(
    () => (course && progress ? courseMastery(course, progress.memory) : 0),
    [course, progress]
  );
  const position = useMemo(
    () => (course && progress ? stepPosition(course, progress.memory) : { step: 0, total: 0 }),
    [course, progress]
  );
  const currentMemory = useMemo(
    () => (progress && state?.conceptId ? getMemory(progress.memory, state.conceptId) : emptyMemory()),
    [progress, state?.conceptId]
  );

  /* ════════════════ ACCUEIL ════════════════ */
  if (view === "accueil") {
    return (
      <div className="mp-shell" style={{ padding: "26px 20px 60px" }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ fontSize: 30 }}>🎓</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Mon Prof</div>
              <div style={{ color: C.dim, fontSize: 12.5 }}>Professeur particulier — explique, questionne, corrige, et ne valide que sur preuve</div>
            </div>
          </div>

          <Card style={{ marginTop: 22, marginBottom: 18 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
              Bonjour{profile.name ? ` ${profile.name}` : ""} 👋
            </div>
            <div style={{ color: C.dim, fontSize: 13.5, marginBottom: 16 }}>Que veux-tu apprendre aujourd&apos;hui ?</div>
            <div className="mp-actions">
              <Btn onClick={() => setView("import")}>📝 Coller mon cours</Btn>
              <Btn kind="ghost" onClick={() => setView("import")}>📄 Importer un fichier</Btn>
              <Btn kind="ghost" onClick={() => courses[0] && openCourse(courses[0])}>🚀 Essayer un cours prêt</Btn>
            </div>
            <div style={{ marginTop: 14 }}>
              <label style={{ color: C.dim, fontSize: 12 }}>Ton prénom (facultatif)</label>
              <input
                value={profile.name}
                onChange={(e) => { const p = { ...profile, name: e.target.value.slice(0, 30) }; setProfile(p); saveProfile(p); }}
                placeholder="Awa"
                style={{ marginTop: 6, width: 220, display: "block", background: C.panel2, border: `1px solid ${C.border}`, color: C.text, borderRadius: 10, padding: "9px 12px", fontSize: 13, fontFamily: "inherit" }}
              />
            </div>
          </Card>

          <div style={{ fontSize: 13, fontWeight: 700, color: C.dim, letterSpacing: 1, margin: "24px 0 12px" }}>MES COURS</div>
          <div className="mp-home-grid">
            {courses.map((c) => {
              const p = allProgress[c.id];
              const pct = p ? courseMastery(c, p.memory) : 0;
              const pos = p ? stepPosition(c, p.memory) : { step: 1, total: c.chapters.flatMap((ch) => ch.conceptIds).length };
              return (
                <Card key={c.id} style={{ cursor: "pointer" }}>
                  <div onClick={() => openCourse(c)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{c.title}</div>
                      <span style={{ fontSize: 10, color: C.dim, border: `1px solid ${C.border}`, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>
                        {c.origin === "seed" ? "intégré" : "importé"}
                      </span>
                    </div>
                    <div style={{ color: C.dim, fontSize: 12, margin: "6px 0 14px" }}>
                      {c.subject} · étape {pos.step}/{pos.total}
                    </div>
                    <Bar value={pct} color={pct >= 70 ? C.green : pct > 0 ? C.orange : C.border} />
                    <div style={{ color: C.dim, fontSize: 11.5, marginTop: 7 }}>{pct} % de maîtrise</div>
                  </div>
                  {c.origin === "import" && (
                    <Btn
                      kind="danger"
                      style={{ marginTop: 12, padding: "6px 10px", fontSize: 11 }}
                      onClick={() => { deleteImportedCourse(c.id); setCourses(loadCourses()); setAllProgress(loadAllProgress()); }}
                    >
                      Supprimer
                    </Btn>
                  )}
                </Card>
              );
            })}
          </div>

          {Object.keys(profile.frequentErrors).length > 0 && (
            <Card style={{ marginTop: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Ce que Mon Prof a retenu de toi</div>
              <div style={{ color: C.dim, fontSize: 12.5, marginBottom: 10 }}>Erreurs revenues le plus souvent — elles orientent les prochains exercices.</div>
              {Object.entries(profile.frequentErrors)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([label, n]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "7px 0", borderTop: `1px solid ${C.border}` }}>
                    <span>{label}</span>
                    <span style={{ color: C.orange }}>×{n}</span>
                  </div>
                ))}
              {profile.preferredStrategy && (
                <div style={{ color: C.dim, fontSize: 12.5, marginTop: 12 }}>
                  Style d&apos;apprentissage observé : tu comprends mieux avec « {profile.preferredStrategy} ».
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    );
  }

  /* ════════════════ IMPORT ════════════════ */
  if (view === "import") {
    return (
      <div className="mp-shell" style={{ padding: "26px 20px 60px" }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <Btn kind="ghost" onClick={() => setView("accueil")} style={{ marginBottom: 18 }}>← Retour</Btn>
          <Card>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Donne-moi ton cours</div>
            <div style={{ color: C.dim, fontSize: 13, marginBottom: 18, lineHeight: 1.7 }}>
              Colle le texte, ou importe un fichier .txt / .md. Je le découpe en notions, je détecte les prérequis,
              et je prépare les exercices. Les calculs que je reconnais dans tes exemples deviennent de vrais
              exercices chiffrés.
            </div>

            <input
              value={importTitle}
              onChange={(e) => setImportTitle(e.target.value)}
              placeholder="Titre du cours (ex. Statistiques — chapitre 2)"
              style={{ width: "100%", background: C.panel2, border: `1px solid ${C.border}`, color: C.text, borderRadius: 10, padding: "11px 13px", fontSize: 13, fontFamily: "inherit", marginBottom: 12 }}
            />

            <input
              type="file"
              accept=".txt,.md,.markdown,.csv,text/plain"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              style={{ color: C.dim, fontSize: 12.5, marginBottom: 12, display: "block" }}
            />

            <textarea
              value={rawCourse}
              onChange={(e) => setRawCourse(e.target.value)}
              placeholder={"Colle ici ton cours…\n\nExemple :\n# Les pourcentages\nDéfinition : un pourcentage est une proportion ramenée sur 100.\nFormule : p = partie / total x 100\nExemple : 20 / 50 x 100 = 40"}
              rows={14}
              style={{ width: "100%", background: C.panel2, border: `1px solid ${C.border}`, color: C.text, borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.7, fontFamily: "ui-monospace, Menlo, monospace", resize: "vertical" }}
            />

            {importError && (
              <div style={{ color: C.orange, fontSize: 12.5, marginTop: 12, lineHeight: 1.6 }}>{importError}</div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <Btn onClick={analyse} disabled={rawCourse.trim().length < 20}>Analyser le cours</Btn>
              {parsed && <Btn kind="ghost" onClick={startParsed}>Commencer →</Btn>}
            </div>

            {report && parsed && (
              <div style={{ marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Ce que j&apos;ai compris de ton cours</div>
                {report.map((r) => (
                  <div key={r} style={{ fontSize: 13, color: C.dim, padding: "4px 0" }}>• {r}</div>
                ))}
                <div style={{ marginTop: 14 }}>
                  {parsed.chapters.map((ch) => (
                    <div key={ch.id} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.accent2 }}>{ch.title}</div>
                      {ch.conceptIds.map((id, i) => (
                        <div key={id} style={{ fontSize: 13, color: C.text, padding: "3px 0 3px 12px" }}>
                          {String(i + 1).padStart(2, "0")} ─ {parsed.concepts[id].title}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  /* ════════════════ CLASSE ════════════════ */
  const concept = course && state?.conceptId ? course.concepts[state.conceptId] : null;
  // Le numéro affiché est celui de la notion ouverte, pas le nombre d'étapes
  // franchies : juste après une validation, les deux diffèrent d'une unité.
  const currentStep = lines.find((l) => l.id === state?.conceptId)?.step ?? position.step;

  return (
    <div className="mp-shell" style={{ padding: "16px 16px 28px" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* En-tête */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Btn kind="ghost" onClick={() => { stopSpeaking(); setView("accueil"); }} style={{ padding: "8px 12px" }}>←</Btn>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{course?.title}</div>
              <div style={{ color: C.dim, fontSize: 11.5 }}>
                {concept ? `Étape ${currentStep}/${position.total} — ${concept.title}` : "Mon Prof"}
                {state?.mode ? ` · mode ${state.mode.toLowerCase()}` : ""}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn
              kind="ghost"
              title={canSpeak() ? "Voix du professeur" : "Synthèse vocale non disponible sur ce navigateur"}
              onClick={() => { const v = !voiceOn; setVoiceOn(v); if (!v) { stopSpeaking(); setSpeaking(false); } }}
              disabled={!canSpeak()}
              style={{ padding: "8px 12px", borderColor: voiceOn ? C.accent : C.border, color: voiceOn ? C.accent2 : C.text }}
            >
              {voiceOn ? (speaking ? "🔊 parle…" : "🔊 voix active") : "🔈 voix coupée"}
            </Btn>
            <Btn
              kind="ghost"
              onClick={() => { if (course) { resetCourseProgress(course.id); setAllProgress(loadAllProgress()); const p = newProgress(course.id); setProgress(p); setMessages([]); setBoard(null); const ctx: TutorContext = { course, state: initialState(course.id), memory: {}, profile, diagnostic: p.diagnostic }; applyTurn(begin(ctx, profile.name || undefined), p, voiceOn); } }}
              style={{ padding: "8px 12px" }}
              title="Tout recommencer depuis le diagnostic"
            >
              ↺
            </Btn>
          </div>
        </div>

        {/* Progression globale */}
        <Card style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
            <span style={{ color: C.dim }}>Progression du cours</span>
            <span style={{ fontWeight: 700 }}>{mastery} %</span>
          </div>
          <Bar value={mastery} color={mastery >= 70 ? C.green : C.accent} height={10} />
        </Card>

        {/* Tableau + conversation */}
        <div className="mp-class">
          <Board frame={board} />

          <Card style={{ display: "flex", flexDirection: "column", padding: 0, minHeight: 330 }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 12.5, color: C.dim, display: "flex", justifyContent: "space-between" }}>
              <span>👨‍🏫 Mon Prof</span>
              {recording && <span className="mp-rec" style={{ color: C.red }}>● j&apos;écoute…</span>}
            </div>

            <div ref={feed} className="mp-scroll" style={{ flex: 1, overflowY: "auto", padding: 16, maxHeight: 460 }}>
              {messages.map((m) => <Bubble key={m.id} m={m} />)}
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, padding: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn
                  kind="ghost"
                  onClick={toggleMic}
                  disabled={!canListen()}
                  title={canListen() ? "Répondre à la voix" : "Reconnaissance vocale non disponible sur ce navigateur"}
                  style={{ padding: "10px 13px", borderColor: recording ? C.red : C.border }}
                >
                  🎤
                </Btn>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
                  placeholder="Écris ta réponse… (ou « je ne comprends pas », « indice », « examen »)"
                  style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, color: C.text, borderRadius: 11, padding: "11px 13px", fontSize: 13, fontFamily: "inherit", minWidth: 0 }}
                />
                <Btn onClick={() => send(input)} disabled={!input.trim()} style={{ padding: "10px 16px" }}>Envoyer</Btn>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                {["Je ne comprends pas", "Un indice", "Explique autrement", "Examen", "Révision", "Plus dur"].map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 99, padding: "5px 11px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Étapes · maîtrise · mémoire */}
        <div className="mp-side" style={{ marginTop: 14 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Les étapes</div>
            {lines.map((l) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0", fontSize: 12.5, opacity: l.locked && l.status === "non-etudie" ? 0.5 : 1 }}>
                <span>{l.locked && l.status === "non-etudie" ? "🔒" : STATUS_ICON[l.status]}</span>
                <span style={{ flex: 1, color: l.id === state?.conceptId ? C.accent2 : C.text, fontWeight: l.id === state?.conceptId ? 700 : 400 }}>
                  {String(l.step).padStart(2, "0")} {l.title}
                </span>
                <span style={{ color: C.dim, fontSize: 11 }}>{l.mastery}%</span>
              </div>
            ))}
          </Card>

          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Maîtrise de l&apos;étape</div>
            <div style={{ color: C.dim, fontSize: 11.5, marginBottom: 12 }}>
              {concept ? concept.title : "—"} · {STATUS_LABEL[currentMemory.validated ? "acquis" : currentMemory.status]}
            </div>
            {DIMENSIONS.map((d: Dimension) => (
              <div key={d} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}>
                  <span style={{ color: C.dim }}>{DIMENSION_LABEL[d]}</span>
                  <span>{currentMemory.scores[d]} %</span>
                </div>
                <Bar value={currentMemory.scores[d]} color={currentMemory.scores[d] >= 70 ? C.green : currentMemory.scores[d] > 0 ? C.orange : C.border} height={6} />
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 10, fontSize: 11.5, color: C.dim }}>
              Maîtrise globale : {globalMastery(currentMemory)} % — une étape n&apos;est validée que si les quatre
              lignes sont démontrées et qu&apos;un exercice différent de l&apos;exemple a été réussi.
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Ce que je retiens de toi</div>
            {currentMemory.errors.length === 0 && Object.keys(profile.frequentErrors).length === 0 ? (
              <div style={{ color: C.dim, fontSize: 12.5, lineHeight: 1.7 }}>
                Aucune erreur récurrente pour l&apos;instant. Je note ici tes confusions pour y revenir plus tard.
              </div>
            ) : (
              <>
                {currentMemory.errors.map((e) => (
                  <div key={e} style={{ fontSize: 12.5, padding: "6px 0", borderTop: `1px solid ${C.border}`, color: C.orange }}>⚠ {e}</div>
                ))}
                {Object.entries(profile.frequentErrors).slice(0, 3).map(([e, n]) => (
                  <div key={e} style={{ fontSize: 12, padding: "6px 0", borderTop: `1px solid ${C.border}`, color: C.dim }}>
                    {e} — revenu {n} fois
                  </div>
                ))}
              </>
            )}
            {progress?.diagnostic.done && (
              <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 12, paddingTop: 10, fontSize: 11.5, color: C.dim, lineHeight: 1.7 }}>
                Niveau : {progress.diagnostic.level || "—"}<br />
                Objectif : {progress.diagnostic.goal || "—"}<br />
                Confiance déclarée : {progress.diagnostic.confidence}/10
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
