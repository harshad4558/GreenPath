/**
 * VoiceNavigator.jsx — In-app voice navigation toggle button + HUD
 * =========================================================================
 * Provides a floating control that lets the user enable/disable voice
 * navigation and shows the currently active navigation instruction as
 * a spoken-aloud banner.
 *
 * Props:
 *   navState      {object|null}  — latest nav_update from useAssistantSocket
 *   enabled       {boolean}      — controlled voice-enabled state
 *   onToggle      {Function}     — () => void — toggles voice on/off
 *   compact       {boolean}      — renders as a minimal icon button
 */

import React, { useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX, Navigation } from "lucide-react";
import { speak, speakInstruction, cancelSpeech, isVoiceEnabled } from "../utils/voiceAssistant.js";

const NAV_STATE_LABELS = {
  IDLE:             { label: "Idle",           color: "text-neutral-400" },
  ACTIVE:           { label: "Navigating",     color: "text-emerald-400" },
  APPROACHING_TURN: { label: "Turn Ahead",     color: "text-amber-400"  },
  OFF_ROUTE:        { label: "Recalculating",  color: "text-red-400"    },
  ARRIVED:          { label: "Arrived!",       color: "text-emerald-400" },
};

export default function VoiceNavigator({ navState, enabled, onToggle, compact = false }) {
  const lastInstructionRef = useRef(null);

  // Speak instruction when navState changes
  useEffect(() => {
    if (!navState || !enabled) return;

    const instruction = navState.bannerInstruction || navState.instruction;
    if (instruction && instruction !== lastInstructionRef.current) {
      lastInstructionRef.current = instruction;
      speakInstruction(instruction);
    }

    // Announce state transitions
    if (navState.state === "OFF_ROUTE") {
      speak("Recalculating route", { priority: "CRITICAL" });
    } else if (navState.state === "ARRIVED") {
      speak("You have arrived at your destination!", { priority: "HIGH" });
    }
  }, [navState, enabled]);

  // Cancel speech when voice is disabled
  useEffect(() => {
    if (!enabled) cancelSpeech();
  }, [enabled]);

  const stateInfo   = NAV_STATE_LABELS[navState?.state] ?? NAV_STATE_LABELS.IDLE;
  const instruction = navState?.bannerInstruction || navState?.instruction || "";

  if (compact) {
    return (
      <button
        id="voice-navigator-toggle"
        onClick={onToggle}
        className={`p-2 rounded-lg border transition-all ${
          enabled
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
            : "bg-neutral-900 border-neutral-700 text-neutral-500 hover:text-neutral-300"
        }`}
        title={enabled ? "Voice navigation ON — click to disable" : "Voice navigation OFF — click to enable"}
      >
        {enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <div
      id="voice-navigator-panel"
      className="rounded-xl border border-neutral-800 bg-neutral-950/80 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
            Voice Navigation
          </span>
          {navState?.state && (
            <span className={`text-2xs font-semibold ${stateInfo.color}`}>
              · {stateInfo.label}
            </span>
          )}
        </div>
        <button
          id="voice-nav-toggle-btn"
          onClick={onToggle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            enabled
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
              : "bg-neutral-900 border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-600"
          }`}
        >
          {enabled ? (
            <><Mic className="w-3.5 h-3.5" /> Voice ON</>
          ) : (
            <><MicOff className="w-3.5 h-3.5" /> Voice OFF</>
          )}
        </button>
      </div>

      {/* Instruction banner */}
      <div className="px-4 py-3 min-h-[52px] flex items-center gap-3">
        {navState?.state && navState.state !== "IDLE" ? (
          <>
            <div className={`flex-shrink-0 p-1.5 rounded-lg ${
              navState.state === "APPROACHING_TURN" ? "bg-amber-500/10" :
              navState.state === "OFF_ROUTE"        ? "bg-red-500/10" :
              navState.state === "ARRIVED"          ? "bg-emerald-500/20" : "bg-emerald-500/10"
            }`}>
              <Navigation className={`w-4 h-4 ${stateInfo.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              {instruction ? (
                <p
                  className="text-sm font-semibold text-white leading-snug"
                  dangerouslySetInnerHTML={{ __html: instruction }}
                />
              ) : (
                <p className={`text-sm font-semibold ${stateInfo.color}`}>
                  {stateInfo.label}
                </p>
              )}
              {navState.distanceToNextStep != null && (
                <p className="text-2xs text-neutral-500 mt-0.5">
                  in {navState.distanceToNextStep < 1000
                    ? `${navState.distanceToNextStep}m`
                    : `${(navState.distanceToNextStep / 1000).toFixed(1)}km`}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-neutral-600 italic">
            Start navigation to hear turn-by-turn guidance
          </p>
        )}
      </div>
    </div>
  );
}
