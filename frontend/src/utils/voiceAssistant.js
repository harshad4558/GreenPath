/**
 * voiceAssistant.js — Web Speech API wrapper for spoken navigation alerts
 * =========================================================================
 * Provides a priority-aware, deduplicated TTS queue so navigation
 * instructions and AI alerts are spoken aloud without repetition or overlap.
 *
 * Usage:
 *   import { speak, cancelSpeech, isSpeaking, setVoiceEnabled } from "./voiceAssistant.js";
 *   speak("Turn left in 200 meters", { priority: "HIGH" });
 */

const SUPPORTED = typeof window !== "undefined" && "speechSynthesis" in window;

let enabled = localStorage.getItem("greenpath_voice") !== "false"; // default ON
let currentUtterance = null;
const queue = [];
const recentlySpoken = new Map(); // text → timestamp (for dedup)
const DEDUP_WINDOW_MS = 12_000;

/** Enable or disable voice output at runtime. */
export function setVoiceEnabled(value) {
  enabled = value;
  localStorage.setItem("greenpath_voice", value ? "true" : "false");
  if (!value) cancelSpeech();
}

export function isVoiceEnabled() {
  return enabled;
}

export function isSpeaking() {
  return SUPPORTED && window.speechSynthesis.speaking;
}

/** Cancel all pending + current speech. */
export function cancelSpeech() {
  if (!SUPPORTED) return;
  window.speechSynthesis.cancel();
  queue.length = 0;
  currentUtterance = null;
}

/**
 * Enqueue a text utterance for speech.
 * @param {string} text           — what to say
 * @param {object} opts
 * @param {"CRITICAL"|"HIGH"|"MEDIUM"|"LOW"} opts.priority — CRITICAL interrupts current speech
 * @param {number}  opts.rate     — speech rate (0.8–1.4), default 1.0
 * @param {number}  opts.pitch    — pitch (0–2), default 1
 * @param {string}  opts.lang     — BCP-47 lang code, default "en-US"
 */
export function speak(text, { priority = "MEDIUM", rate = 1.05, pitch = 1.0, lang = "en-US" } = {}) {
  if (!SUPPORTED || !enabled || !text) return;

  // Deduplicate: don't repeat the same phrase within the window
  const now = Date.now();
  const lastSpoken = recentlySpoken.get(text);
  if (lastSpoken && now - lastSpoken < DEDUP_WINDOW_MS) return;
  recentlySpoken.set(text, now);

  // Clean up old dedup entries
  for (const [key, ts] of recentlySpoken) {
    if (now - ts > DEDUP_WINDOW_MS * 2) recentlySpoken.delete(key);
  }

  if (priority === "CRITICAL") {
    // Interrupt current speech
    cancelSpeech();
    _sayNow(text, rate, pitch, lang);
    return;
  }

  // Queue non-critical speech
  queue.push({ text, rate, pitch, lang, priority });
  // Sort queue: HIGH before MEDIUM before LOW
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  queue.sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));

  if (!isSpeaking()) {
    _processQueue();
  }
}

function _sayNow(text, rate, pitch, lang) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate  = rate;
  utterance.pitch = pitch;
  utterance.lang  = lang;

  utterance.onend = () => {
    currentUtterance = null;
    _processQueue();
  };
  utterance.onerror = (e) => {
    if (e.error !== "interrupted") {
      console.warn("[VoiceAssistant] Speech error:", e.error);
    }
    currentUtterance = null;
    _processQueue();
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

function _processQueue() {
  if (!enabled || queue.length === 0 || isSpeaking()) return;
  const next = queue.shift();
  if (next) _sayNow(next.text, next.rate, next.pitch, next.lang);
}

/**
 * Speak a navigation banner instruction, stripping HTML tags.
 * @param {string} html  — may contain <b>, <i> etc.
 */
export function speakInstruction(html) {
  if (!html) return;
  const plain = html.replace(/<[^>]*>/g, "").trim();
  if (plain) speak(plain, { priority: "HIGH", rate: 1.0 });
}

/**
 * Speak an AI assistant alert message.
 * @param {object} alert — { type, message }
 */
export function speakAlert(alert) {
  if (!alert?.message) return;
  const priority = alert.type === "ALERT" ? "CRITICAL" :
                   alert.type === "WARNING" ? "HIGH" : "MEDIUM";
  speak(alert.message, { priority });
}
