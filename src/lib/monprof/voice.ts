"use client";

/* Voix du professeur : synthèse vocale pour parler, reconnaissance
   vocale pour écouter. Tout est optionnel — si le navigateur ne sait
   pas faire, l'application fonctionne exactement pareil à l'écrit. */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => SpeechRecognitionLike;

const win = () =>
  typeof window === "undefined"
    ? null
    : (window as unknown as {
        speechSynthesis?: SpeechSynthesis;
        SpeechRecognition?: RecognitionCtor;
        webkitSpeechRecognition?: RecognitionCtor;
      });

export const canSpeak = () => Boolean(win()?.speechSynthesis);
export const canListen = () => Boolean(win()?.SpeechRecognition || win()?.webkitSpeechRecognition);

function frenchVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith("fr") && /google|natural|enhanced/i.test(v.name)) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith("fr")) ??
    null
  );
}

/**
 * Lit un texte à voix haute. Le débit est volontairement un peu lent :
 * un professeur qui explique ne récite pas, il laisse le temps de suivre.
 */
export function speak(text: string, onEnd?: () => void) {
  const w = win();
  if (!w?.speechSynthesis || !text.trim()) { onEnd?.(); return; }
  const synth = w.speechSynthesis;
  synth.cancel();

  // Phrase par phrase : la voix respire, et on peut couper à tout moment.
  const chunks = text.split(/(?<=[.!?…:])\s+/).filter((c) => c.trim().length > 1);
  let index = 0;

  const next = () => {
    if (index >= chunks.length) { onEnd?.(); return; }
    const u = new SpeechSynthesisUtterance(chunks[index++]);
    u.lang = "fr-FR";
    u.rate = 0.96;
    u.pitch = 1.02;
    const v = frenchVoice(synth);
    if (v) u.voice = v;
    u.onend = next;
    u.onerror = () => onEnd?.();
    synth.speak(u);
  };

  // Sur certains navigateurs la liste des voix arrive en différé.
  if (!synth.getVoices().length) {
    synth.onvoiceschanged = () => { synth.onvoiceschanged = null; next(); };
    setTimeout(next, 250);
  } else next();
}

export function stopSpeaking() {
  win()?.speechSynthesis?.cancel();
}

/** Micro : renvoie une fonction d'arrêt, ou null si non supporté. */
export function listen(onText: (text: string) => void, onEnd?: () => void): (() => void) | null {
  const w = win();
  const Ctor = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = "fr-FR";
  rec.continuous = false;
  rec.interimResults = false;
  rec.onresult = (e) => {
    const last = e.results[e.results.length - 1];
    const text = last?.[0]?.transcript ?? "";
    if (text.trim()) onText(text.trim());
  };
  rec.onerror = () => onEnd?.();
  rec.onend = () => onEnd?.();
  try { rec.start(); } catch { onEnd?.(); return null; }
  return () => { try { rec.abort(); } catch { /* déjà arrêté */ } };
}
