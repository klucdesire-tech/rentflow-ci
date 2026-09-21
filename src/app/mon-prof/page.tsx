"use client";

/* ══════════════════════════════════════════════════════════════
   MON PROF — Interface
   Trois écrans : accueil (catalogue), import (analyse d'un cours),
   classe (tableau + transcription + instruments de mesure).

   Direction : l'appareillage d'une planche d'observation. Le tableau
   est le sujet, pas une carte parmi d'autres ; la conversation est une
   transcription, pas une messagerie ; les quatre dimensions de maîtrise
   sont des registres d'étalonnage. L'ocre ne sert qu'à une chose :
   désigner ce qui reste à démontrer.

   Tout le comportement pédagogique vient de lib/monprof.
   ══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BoardFrame, Course, CourseProgress, Dimension, LearnerProfile, Message, Status,
  TutorState, TutorTurn,
} from "@/types/monprof";
import { DIMENSION_LABEL, DIMENSIONS, STATUS_LABEL } from "@/types/monprof";
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
  ardoise: "#080F0D",
  encre: "#0D1613",
  encre2: "#111D19",
  filet: "#1E2C26",
  craie: "#E9F0EA",
  demi: "#74877E",
  faible: "#4E5C55",
  ocre: "#C89340",       // accent unique : ce qui reste à prouver
  acquis: "#7FBFA0",
  manque: "#BE6B5C",
};

const STATUS_COLOR: Record<Status, string> = {
  "non-etudie": C.filet,
  "non-acquis": C.manque,
  "en-cours": C.ocre,
  acquis: C.acquis,
};

const CSS = String.raw`
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Jura:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap');

  .mp-shell {
    min-height: 100vh;
    background: ${C.ardoise};
    color: ${C.craie};
    font-family: 'Jura', 'Avenir Next', system-ui, sans-serif;
    font-weight: 400;
    -webkit-font-smoothing: antialiased;
  }
  .mp-shell *::selection { background: ${C.ocre}; color: ${C.ardoise}; }

  /* Le liseré indigo hérité du layout global ne doit pas ressortir ici. */
  .mp-shell input:focus, .mp-shell textarea:focus {
    border-color: ${C.ocre} !important;
    outline: none;
  }
  .mp-shell button:focus-visible, .mp-shell input:focus-visible, .mp-shell textarea:focus-visible {
    outline: 1px solid ${C.ocre};
    outline-offset: 2px;
  }

  .mp-eyebrow {
    font-size: 10px; font-weight: 500; letter-spacing: .3em;
    text-transform: uppercase; color: ${C.faible};
  }
  .mp-num {
    font-family: 'DM Mono', ui-monospace, Menlo, monospace;
    font-weight: 300; font-variant-numeric: tabular-nums;
  }
  .mp-voice {
    font-family: 'Crimson Pro', Georgia, serif;
    font-size: 16.5px; line-height: 1.68;
  }

  .mp-rule { height: 1px; background: ${C.filet}; border: 0; }

  .mp-btn {
    background: transparent; color: ${C.craie};
    border: 1px solid ${C.filet}; border-radius: 2px;
    padding: 10px 16px; font-family: inherit; font-size: 11px;
    font-weight: 500; letter-spacing: .16em; text-transform: uppercase;
    cursor: pointer; transition: border-color .18s, background .18s;
  }
  .mp-btn:hover:not(:disabled) { border-color: ${C.demi}; background: ${C.encre2}; opacity: 1; }
  .mp-btn:disabled { opacity: .35; cursor: not-allowed; }
  .mp-btn--solid { background: ${C.craie}; color: ${C.ardoise}; border-color: ${C.craie}; }
  .mp-btn--solid:hover:not(:disabled) { background: #fff; border-color: #fff; }
  .mp-btn--quiet { border-color: transparent; color: ${C.demi}; padding: 8px 10px; }
  .mp-btn--quiet:hover:not(:disabled) { color: ${C.craie}; background: transparent; }

  .mp-field {
    background: transparent; color: ${C.craie};
    border: 0; border-bottom: 1px solid ${C.filet}; border-radius: 0;
    padding: 9px 2px; font-family: inherit; font-size: 14px; width: 100%;
  }
  .mp-field::placeholder { color: ${C.faible}; }

  .mp-chip {
    background: transparent; border: 1px solid ${C.filet}; color: ${C.demi};
    border-radius: 99px; padding: 5px 12px; font-family: inherit;
    font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
    cursor: pointer; transition: color .18s, border-color .18s;
  }
  .mp-chip:hover { color: ${C.craie}; border-color: ${C.demi}; opacity: 1; }

  /* ── Catalogue ── */
  .mp-row {
    display: grid; grid-template-columns: 44px 1fr 150px 30px;
    gap: 18px; align-items: center;
    padding: 18px 10px 18px 2px;
    border-top: 1px solid ${C.filet};
    cursor: pointer; transition: background .18s;
  }
  .mp-row:hover { background: ${C.encre}; }
  .mp-row:last-of-type { border-bottom: 1px solid ${C.filet}; }

  /* ── Classe ── */
  .mp-class { display: grid; grid-template-columns: 1.32fr 1fr; gap: 26px; align-items: stretch; }
  .mp-strip { display: grid; grid-template-columns: 1fr 1fr 1fr; }
  .mp-strip > * { padding: 22px 24px; border-left: 1px solid ${C.filet}; }
  .mp-strip > *:first-child { border-left: 0; padding-left: 2px; }

  .mp-chalk { animation: mp-in .5s ease both; }
  @keyframes mp-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
  @keyframes mp-blink { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
  .mp-rec { animation: mp-blink 1.2s infinite; }
  @media (prefers-reduced-motion: reduce) {
    .mp-chalk, .mp-rec { animation: none; }
  }

  .mp-scroll::-webkit-scrollbar { width: 6px; }
  .mp-scroll::-webkit-scrollbar-thumb { background: ${C.filet}; }

  @media (max-width: 900px) {
    .mp-class { grid-template-columns: 1fr !important; gap: 18px; }
    .mp-strip { grid-template-columns: 1fr !important; }
    .mp-strip > * { border-left: 0 !important; border-top: 1px solid ${C.filet}; padding: 20px 2px !important; }
    .mp-strip > *:first-child { border-top: 0; }
    .mp-row { grid-template-columns: 34px 1fr 74px; gap: 12px; }
    .mp-row > :nth-child(4) { display: none; }
  }
  @media (max-width: 560px) {
    /* La jauge d'en-tête se cognait aux boutons : la bande d'instruments
       plus bas porte déjà la même mesure. */
    .mp-hdr-gauge { display: none !important; }
  }
`;

/* ── Éléments ───────────────────────────────────────────────── */

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="mp-eyebrow" style={style}>{children}</div>;
}

/**
 * Filet de mesure : piste graduée, remplissage à la craie.
 * Les graduations n'apparaissent qu'une fois franchies — sur une piste
 * vide elles se liraient comme un trait pointillé, pas comme une mesure.
 */
function Register({ value, incomplete = false, height = 3 }: { value: number; incomplete?: boolean; height?: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div style={{ position: "relative", height, background: C.filet }}>
      <div style={{ position: "absolute", inset: 0, width: `${v}%`, background: incomplete ? C.ocre : C.craie, transition: "width .55s ease" }} />
      {height >= 3 && [25, 50, 75].filter((q) => v > q).map((q) => (
        <div key={q} style={{ position: "absolute", left: `${q}%`, top: -2, width: 1, height: height + 4, background: C.ardoise }} />
      ))}
    </div>
  );
}

function Dot({ status, locked }: { status: Status; locked?: boolean }) {
  if (locked && status === "non-etudie") {
    return <span style={{ display: "inline-block", width: 7, height: 7, border: `1px solid ${C.filet}`, borderRadius: "50%" }} />;
  }
  const c = STATUS_COLOR[status];
  const empty = status === "non-etudie";
  return (
    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: empty ? "transparent" : c, border: `1px solid ${empty ? C.filet : c}` }} />
  );
}

/* ── Le tableau ─────────────────────────────────────────────── */

function Board({ frame }: { frame: BoardFrame | null }) {
  return (
    <div style={{ background: C.encre, border: `1px solid ${C.filet}`, padding: "26px 28px 30px", minHeight: 440, height: "100%", position: "relative", overflow: "auto" }} className="mp-scroll">
      <Eyebrow style={{ position: "absolute", top: 14, right: 18 }}>Tableau</Eyebrow>
      {!frame ? (
        <div style={{ color: C.faible, fontSize: 13, marginTop: 60, textAlign: "center" }}>
          Le tableau se remplit au fur et à mesure du cours.
        </div>
      ) : (
        <div key={frame.title} className="mp-chalk">
          <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: ".22em", textTransform: "uppercase", color: C.craie }}>
            {frame.title}
          </div>
          <div style={{ height: 1, background: C.demi, opacity: 0.4, margin: "14px 0 20px" }} />
          <div className="mp-num" style={{ fontSize: 13.5, lineHeight: 2.05 }}>
            {frame.lines.map((l, i) => {
              if (l.kind === "rule")
                return <div key={i} style={{ height: 1, background: C.filet, margin: "14px 0" }} />;
              if (l.kind === "label")
                return <div key={i} className="mp-eyebrow" style={{ marginTop: 14, marginBottom: 2, color: C.ocre }}>{l.text}</div>;
              if (l.kind === "formula")
                return (
                  <div key={i} style={{ color: C.craie, fontSize: 16, padding: "8px 0 8px 14px", borderLeft: `1px solid ${C.ocre}`, margin: "8px 0" }}>
                    {l.text}
                  </div>
                );
              if (l.kind === "step")
                return (
                  <div key={i} style={{ color: C.craie, paddingLeft: 14, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: C.faible }}>—</span>{l.text}
                  </div>
                );
              if (l.kind === "highlight")
                return (
                  <div key={i} style={{ color: C.craie, borderTop: `1px solid ${C.filet}`, borderBottom: `1px solid ${C.filet}`, padding: "9px 0", margin: "10px 0", fontSize: 14 }}>
                    {l.text}
                  </div>
                );
              return <div key={i} style={{ color: C.demi, whiteSpace: "pre-wrap" }}>{l.text}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Transcription ──────────────────────────────────────────── */

const TONE: Record<string, { color: string; tag: string }> = {
  neutre: { color: C.filet, tag: "" },
  succes: { color: C.acquis, tag: "Juste" },
  erreur: { color: C.manque, tag: "À reprendre" },
  indice: { color: C.ocre, tag: "Indice" },
  validation: { color: C.craie, tag: "Étape" },
};

function Turn({ m, showSpeaker }: { m: Message; showSpeaker: boolean }) {
  if (m.from === "eleve") {
    return (
      <div style={{ margin: "18px 0 18px auto", maxWidth: "80%", textAlign: "right" }}>
        {showSpeaker && <Eyebrow style={{ marginBottom: 6 }}>Toi</Eyebrow>}
        <div style={{ borderRight: `1px solid ${C.demi}`, paddingRight: 14, color: C.demi, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {m.text}
        </div>
      </div>
    );
  }
  const tone = TONE[m.tone ?? "neutre"] ?? TONE.neutre;
  return (
    <div style={{ margin: "18px 0" }}>
      {showSpeaker && <Eyebrow style={{ marginBottom: 7 }}>Mon Prof</Eyebrow>}
      <div style={{ borderLeft: `1px solid ${tone.color}`, paddingLeft: 16 }}>
        {tone.tag && (
          <div className="mp-eyebrow" style={{ color: tone.color, marginBottom: 5 }}>{tone.tag}</div>
        )}
        <div className="mp-voice" style={{ color: C.craie, whiteSpace: "pre-wrap" }}>{m.text}</div>
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
      <div className="mp-shell" style={{ padding: "0 20px 80px" }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ maxWidth: 940, margin: "0 auto" }}>

          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "30px 0 12px", borderBottom: `1px solid ${C.filet}` }}>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".34em", textTransform: "uppercase" }}>Mon Prof</div>
            <div className="mp-num mp-eyebrow" style={{ letterSpacing: ".2em" }}>
              {courses.length} cours
            </div>
          </header>

          <section style={{ padding: "58px 0 46px" }}>
            <h1 className="mp-voice" style={{ fontSize: "clamp(28px, 5.2vw, 44px)", lineHeight: 1.25, fontWeight: 400, margin: 0, maxWidth: "19ch", textWrap: "balance" }}>
              {profile.name ? `Bonjour ${profile.name}.` : "Bonjour."}<br />
              <span style={{ fontStyle: "italic", color: C.demi }}>Que veux-tu apprendre aujourd&apos;hui ?</span>
            </h1>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 34 }}>
              <button className="mp-btn mp-btn--solid" onClick={() => setView("import")}>Donner un cours</button>
              <button className="mp-btn" onClick={() => courses[0] && openCourse(courses[0])}>Essayer un cours prêt</button>
            </div>

            <div style={{ marginTop: 40, maxWidth: 260 }}>
              <Eyebrow>Ton prénom (facultatif)</Eyebrow>
              <input
                id="mp-name"
                className="mp-field"
                value={profile.name}
                onChange={(e) => { const p = { ...profile, name: e.target.value.slice(0, 30) }; setProfile(p); saveProfile(p); }}
                placeholder="Awa"
                style={{ marginTop: 4 }}
              />
            </div>
          </section>

          <Eyebrow style={{ marginBottom: 14 }}>Mes cours</Eyebrow>
          <div>
            {courses.map((c, i) => {
              const p = allProgress[c.id];
              const pct = p ? courseMastery(c, p.memory) : 0;
              const total = c.chapters.flatMap((ch) => ch.conceptIds).length;
              const pos = p ? stepPosition(c, p.memory) : { step: 1, total };
              return (
                <div
                  key={c.id}
                  className="mp-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => openCourse(c)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCourse(c); } }}
                >
                  <span className="mp-num" style={{ color: C.faible, fontSize: 12 }}>{String(i + 1).padStart(2, "0")}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="mp-voice" style={{ fontSize: 19, lineHeight: 1.3 }}>{c.title}</div>
                    <div style={{ color: C.faible, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", marginTop: 4 }}>
                      {c.subject} · étape {pos.step} sur {pos.total} · {c.origin === "seed" ? "intégré" : "importé"}
                    </div>
                  </div>
                  <div>
                    <Register value={pct} incomplete={pct > 0 && pct < 78} />
                    <div className="mp-num" style={{ color: C.demi, fontSize: 11, marginTop: 7, textAlign: "right" }}>{pct} %</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {c.origin === "import" ? (
                      <button
                        className="mp-btn mp-btn--quiet"
                        title="Supprimer ce cours"
                        onClick={(e) => { e.stopPropagation(); deleteImportedCourse(c.id); setCourses(loadCourses()); setAllProgress(loadAllProgress()); }}
                        style={{ fontSize: 14, letterSpacing: 0 }}
                      >
                        ×
                      </button>
                    ) : (
                      <span style={{ color: C.faible, fontSize: 14 }}>→</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {Object.keys(profile.frequentErrors).length > 0 && (
            <section style={{ marginTop: 56 }}>
              <Eyebrow style={{ marginBottom: 6 }}>Ce que Mon Prof a retenu de toi</Eyebrow>
              <p style={{ color: C.demi, fontSize: 13, lineHeight: 1.7, margin: "0 0 16px", maxWidth: "58ch" }}>
                Les confusions revenues plusieurs fois. Elles orientent les prochains exercices.
              </p>
              <div style={{ maxWidth: 460 }}>
                {Object.entries(profile.frequentErrors)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([label, n]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 13, padding: "10px 0", borderTop: `1px solid ${C.filet}` }}>
                      <span style={{ color: C.craie }}>{label}</span>
                      <span className="mp-num" style={{ color: C.ocre }}>×{n}</span>
                    </div>
                  ))}
              </div>
              {profile.preferredStrategy && (
                <p style={{ color: C.faible, fontSize: 12.5, marginTop: 16 }}>
                  Style d&apos;apprentissage observé : tu comprends mieux avec « {profile.preferredStrategy} ».
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    );
  }

  /* ════════════════ IMPORT ════════════════ */
  if (view === "import") {
    return (
      <div className="mp-shell" style={{ padding: "0 20px 80px" }}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "30px 0 12px", borderBottom: `1px solid ${C.filet}` }}>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: ".34em", textTransform: "uppercase" }}>Mon Prof</div>
            <button className="mp-btn mp-btn--quiet" onClick={() => setView("accueil")}>← Retour</button>
          </header>

          <h1 className="mp-voice" style={{ fontSize: "clamp(25px, 4.6vw, 36px)", fontWeight: 400, margin: "50px 0 14px" }}>
            Donne-moi ton cours.
          </h1>
          <p style={{ color: C.demi, fontSize: 14, lineHeight: 1.8, maxWidth: "62ch", margin: "0 0 34px" }}>
            Colle le texte, ou importe un fichier .txt / .md. Je le découpe en notions, je détecte les prérequis
            et je prépare les exercices. Les calculs reconnus dans tes exemples deviennent de vrais exercices chiffrés.
          </p>

          <div style={{ marginBottom: 22 }}>
            <Eyebrow>Titre du cours</Eyebrow>
            <input
              id="mp-import-title"
              className="mp-field"
              value={importTitle}
              onChange={(e) => setImportTitle(e.target.value)}
              placeholder="Statistiques — chapitre 2"
              style={{ marginTop: 4 }}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <Eyebrow style={{ marginBottom: 8 }}>Fichier</Eyebrow>
            <input
              id="mp-import-file"
              type="file"
              accept=".txt,.md,.markdown,.csv,text/plain"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              style={{ color: C.demi, fontSize: 12, fontFamily: "inherit" }}
            />
          </div>

          <Eyebrow style={{ marginBottom: 8 }}>Texte du cours</Eyebrow>
          <textarea
            id="mp-import-text"
            value={rawCourse}
            onChange={(e) => setRawCourse(e.target.value)}
            placeholder={"# Les pourcentages\nDéfinition : un pourcentage est une proportion ramenée sur 100.\nFormule : p = partie / total x 100\nExemple : 20 / 50 x 100 = 40"}
            rows={15}
            className="mp-num mp-scroll"
            style={{ width: "100%", background: C.encre, border: `1px solid ${C.filet}`, color: C.craie, padding: 18, fontSize: 13, lineHeight: 1.85, resize: "vertical" }}
          />

          {importError && (
            <p style={{ color: C.ocre, fontSize: 13, lineHeight: 1.7, marginTop: 14, maxWidth: "62ch" }}>{importError}</p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
            <button className="mp-btn" onClick={analyse} disabled={rawCourse.trim().length < 20}>Analyser le cours</button>
            {parsed && <button className="mp-btn mp-btn--solid" onClick={startParsed}>Commencer →</button>}
          </div>

          {report && parsed && (
            <section style={{ marginTop: 44, borderTop: `1px solid ${C.filet}`, paddingTop: 26 }}>
              <Eyebrow style={{ marginBottom: 16 }}>Ce que j&apos;ai compris de ton cours</Eyebrow>
              <div style={{ display: "grid", gap: 0, maxWidth: 520, marginBottom: 30 }}>
                {report.map((r) => (
                  <div key={r} style={{ fontSize: 13, color: C.demi, padding: "9px 0", borderTop: `1px solid ${C.filet}` }}>{r}</div>
                ))}
              </div>
              {parsed.chapters.map((ch) => (
                <div key={ch.id} style={{ marginBottom: 20 }}>
                  <Eyebrow style={{ color: C.ocre, marginBottom: 8 }}>{ch.title}</Eyebrow>
                  {ch.conceptIds.map((id, i) => (
                    <div key={id} style={{ display: "flex", gap: 14, fontSize: 14, padding: "5px 0" }}>
                      <span className="mp-num" style={{ color: C.faible, fontSize: 11 }}>{String(i + 1).padStart(2, "0")}</span>
                      <span className="mp-voice" style={{ fontSize: 15.5 }}>{parsed.concepts[id].title}</span>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          )}
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
    <div className="mp-shell" style={{ padding: "0 20px 40px" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>

        {/* ── Bandeau ── */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "20px 0 14px", borderBottom: `1px solid ${C.filet}`, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
            <button className="mp-btn mp-btn--quiet" onClick={() => { stopSpeaking(); setView("accueil"); }} title="Revenir aux cours">←</button>
            <div style={{ minWidth: 0 }}>
              <div className="mp-voice" style={{ fontSize: 17, lineHeight: 1.2 }}>{course?.title}</div>
              <div className="mp-eyebrow" style={{ marginTop: 5 }}>
                {concept ? (
                  <>
                    <span className="mp-num">{String(currentStep).padStart(2, "0")}</span>
                    {" / "}
                    <span className="mp-num">{String(position.total).padStart(2, "0")}</span>
                    {" — "}{concept.title}
                  </>
                ) : "Séance"}
                {state?.mode ? ` · ${state.mode.toLowerCase()}` : ""}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div className="mp-hdr-gauge" style={{ width: 92, marginRight: 8 }}>
              <Register value={mastery} height={2} />
              <div className="mp-num" style={{ color: C.demi, fontSize: 10.5, marginTop: 6, textAlign: "right" }}>{mastery} %</div>
            </div>
            <button
              className="mp-btn"
              title={canSpeak() ? "Voix du professeur" : "Synthèse vocale indisponible sur ce navigateur"}
              onClick={() => { const v = !voiceOn; setVoiceOn(v); if (!v) { stopSpeaking(); setSpeaking(false); } }}
              disabled={!canSpeak()}
              style={{ borderColor: voiceOn ? C.ocre : C.filet, color: voiceOn ? C.ocre : C.craie, padding: "9px 13px" }}
            >
              {voiceOn ? (speaking ? "Parle" : "Voix") : "Muet"}
            </button>
            <button
              className="mp-btn mp-btn--quiet"
              title="Tout recommencer depuis le diagnostic"
              onClick={() => { if (course) { resetCourseProgress(course.id); setAllProgress(loadAllProgress()); const p = newProgress(course.id); setProgress(p); setMessages([]); setBoard(null); const ctx: TutorContext = { course, state: initialState(course.id), memory: {}, profile, diagnostic: p.diagnostic }; applyTurn(begin(ctx, profile.name || undefined), p, voiceOn); } }}
            >
              ↺
            </button>
          </div>
        </header>

        {/* ── Tableau + transcription ── */}
        <div className="mp-class" style={{ paddingTop: 26 }}>
          <Board frame={board} />

          <div style={{ display: "flex", flexDirection: "column", minHeight: 440 }}>
            <Eyebrow style={{ display: "flex", justifyContent: "space-between", paddingBottom: 12, borderBottom: `1px solid ${C.filet}` }}>
              <span>Transcription</span>
              {recording && <span className="mp-rec" style={{ color: C.manque }}>● j&apos;écoute</span>}
            </Eyebrow>

            <div ref={feed} className="mp-scroll" style={{ flex: 1, overflowY: "auto", maxHeight: 470, paddingRight: 6 }}>
              {messages.map((m, i) => (
                <Turn key={m.id} m={m} showSpeaker={i === 0 || messages[i - 1].from !== m.from} />
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${C.filet}`, paddingTop: 14, marginTop: 8 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <button
                  className="mp-btn"
                  onClick={toggleMic}
                  disabled={!canListen()}
                  title={canListen() ? "Répondre à la voix" : "Reconnaissance vocale indisponible sur ce navigateur"}
                  style={{ borderColor: recording ? C.manque : C.filet, padding: "9px 12px" }}
                >
                  Micro
                </button>
                <input
                  id="mp-answer"
                  className="mp-field"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
                  placeholder="Ta réponse…"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button className="mp-btn mp-btn--solid" onClick={() => send(input)} disabled={!input.trim()} style={{ padding: "10px 14px" }}>
                  Envoyer
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {["Je ne comprends pas", "Un indice", "Explique autrement", "Examen", "Révision", "Plus dur"].map((q) => (
                  <button key={q} className="mp-chip" onClick={() => send(q)}>{q}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bande d'instruments ── */}
        <div className="mp-strip" style={{ marginTop: 30, borderTop: `1px solid ${C.filet}` }}>

          <section>
            <Eyebrow style={{ marginBottom: 14 }}>Les étapes</Eyebrow>
            {lines.map((l) => {
              const here = l.id === state?.conceptId;
              return (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "7px 0", opacity: l.locked && l.status === "non-etudie" ? 0.45 : 1 }}>
                  <span style={{ width: 2, height: 14, background: here ? C.ocre : "transparent" }} />
                  <Dot status={l.status} locked={l.locked} />
                  <span className="mp-num" style={{ color: C.faible, fontSize: 11 }}>{String(l.step).padStart(2, "0")}</span>
                  <span style={{ flex: 1, fontSize: 13, color: here ? C.craie : C.demi }}>{l.title}</span>
                  <span className="mp-num" style={{ color: C.faible, fontSize: 11 }}>{l.mastery}</span>
                </div>
              );
            })}
          </section>

          <section>
            <Eyebrow style={{ marginBottom: 4 }}>Maîtrise de l&apos;étape</Eyebrow>
            <div style={{ color: C.demi, fontSize: 12, marginBottom: 18 }}>
              {concept ? concept.title : "—"} · {STATUS_LABEL[currentMemory.validated ? "acquis" : currentMemory.status].toLowerCase()}
            </div>
            {DIMENSIONS.map((d: Dimension, i) => (
              <div key={d} style={{ marginBottom: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: C.demi }}>
                    <span className="mp-num" style={{ color: C.faible, fontSize: 10, marginRight: 8 }}>
                      {["I", "II", "III", "IV"][i]}
                    </span>
                    {DIMENSION_LABEL[d]}
                  </span>
                  <span className="mp-num" style={{ fontSize: 11, color: C.demi }}>{currentMemory.scores[d]}</span>
                </div>
                <Register value={currentMemory.scores[d]} incomplete={currentMemory.scores[d] < 70} />
              </div>
            ))}
            <p style={{ fontSize: 11.5, color: C.faible, lineHeight: 1.75, marginTop: 16, marginBottom: 0 }}>
              Maîtrise globale {globalMastery(currentMemory)} %. L&apos;étape n&apos;est validée que si les quatre
              registres sont remplis <em>et</em> qu&apos;un exercice différent de l&apos;exemple a été réussi.
            </p>
          </section>

          <section>
            <Eyebrow style={{ marginBottom: 14 }}>Ce que je retiens de toi</Eyebrow>
            {currentMemory.errors.length === 0 && Object.keys(profile.frequentErrors).length === 0 ? (
              <p style={{ color: C.faible, fontSize: 12.5, lineHeight: 1.8, margin: 0 }}>
                Aucune erreur récurrente pour l&apos;instant. Je note ici tes confusions pour y revenir plus tard.
              </p>
            ) : (
              <>
                {currentMemory.errors.map((e) => (
                  <div key={e} style={{ fontSize: 12.5, color: C.ocre, padding: "8px 0", borderTop: `1px solid ${C.filet}` }}>{e}</div>
                ))}
                {Object.entries(profile.frequentErrors).slice(0, 3).map(([e, n]) => (
                  <div key={e} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: C.faible, padding: "8px 0", borderTop: `1px solid ${C.filet}` }}>
                    <span>{e}</span><span className="mp-num">×{n}</span>
                  </div>
                ))}
              </>
            )}
            {progress?.diagnostic.done && (
              <dl style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${C.filet}`, display: "grid", gap: 8, fontSize: 11.5 }}>
                {[
                  ["Niveau", progress.diagnostic.level || "—"],
                  ["Objectif", progress.diagnostic.goal || "—"],
                  ["Confiance", `${progress.diagnostic.confidence} / 10`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
                    <dt className="mp-eyebrow">{k}</dt>
                    <dd style={{ margin: 0, color: C.demi, textAlign: "right" }}>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
