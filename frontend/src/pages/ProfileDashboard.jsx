import React, { useState, useEffect } from "react";
import { 
  User, Settings, Leaf, Zap, Activity, Clock, ShieldAlert,
  Bike, Award, CheckCircle2, Navigation, AlertTriangle,
  Volume2, VolumeX
} from "lucide-react";
import { userAPI } from "../utils/api.js";
import { useAssistantSocket } from "../utils/useAssistantSocket.js";
import { isVoiceEnabled, setVoiceEnabled } from "../utils/voiceAssistant.js";

export default function ProfileDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [profile, setProfile] = useState(null);
  const [preferences, setPreferences] = useState({
    routingPriority: "BALANCE",
    evChargingPreference: "ANY",
    preferCycling: false,
    avoidUnsafeZones: false
  });
  const [initialActiveSession, setInitialActiveSession] = useState(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [voiceOn, setVoiceOn] = useState(isVoiceEnabled());

  const { navState } = useAssistantSocket();

  // Load dashboard data once on mount
  const fetchDashboard = async () => {
    try {
      const data = await userAPI.getLiveDashboard();
      setProfile(data.user);
      if (!savingPrefs) {
        setPreferences(data.preferences);
      }
      setInitialActiveSession(data.activeSession);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load profile data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [savingPrefs]);

  const activeSession = navState || initialActiveSession;

  const handlePrefChange = async (key, value) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    setSavingPrefs(true);
    try {
      await userAPI.updatePreferences(newPrefs);
    } catch (err) {
      console.error("Failed to save preference", err);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleVoiceToggle = (e) => {
    const val = e.target.checked;
    setVoiceOn(val);
    setVoiceEnabled(val);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 animate-fade-in transition-colors">
      
      {/* ── Section A: Live Status Tracker ──────────────────────────────── */}
      {activeSession && (
        <div className="mb-8 p-1 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 shadow-xl shadow-emerald-500/20 animate-pulse-slow">
          <div className="bg-white dark:bg-neutral-950 rounded-xl p-5 sm:p-6 flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-500">
                <Navigation className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
                  Active Trip: {activeSession.mode}
                  <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse">LIVE</span>
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-medium">
                  {activeSession.origin} → {activeSession.destination}
                </p>
              </div>
            </div>
            
            <div className="bg-neutral-50 dark:bg-neutral-900 px-6 py-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col items-center min-w-[250px]">
              <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                {activeSession.state.replace(/_/g, " ")}
              </span>
              <p className="text-lg font-black text-center text-neutral-900 dark:text-white leading-tight">
                {activeSession.bannerInstruction}
              </p>
              {activeSession.distanceToTurn != null && (
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                  in {activeSession.distanceToTurn < 1000 ? `${Math.round(activeSession.distanceToTurn)}m` : `${(activeSession.distanceToTurn/1000).toFixed(1)}km`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight flex items-center gap-3">
            <User className="w-8 h-8 text-primary" />
            Control Panel
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
            Real-Time Mobility Identity & Preferences
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">User Account</p>
          <p className="text-lg font-bold text-neutral-900 dark:text-white">{profile?.email}</p>
          <p className={`text-xs font-bold inline-block px-2 py-0.5 rounded mt-1 ${profile?.role === 'ADMIN' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
            {profile?.role}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ── Section B: Core Optimization Knobs ──────────────────────────── */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-neutral-900/60 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-neutral-400" />
              Routing Engine Overrides
            </h2>
            
            <div className="space-y-8">
              {/* Routing Priority */}
              <div>
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-3">
                  Core Routing Priority
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {["ECO", "BALANCE", "TIME"].map(opt => (
                    <button
                      key={opt}
                      onClick={() => handlePrefChange("routingPriority", opt)}
                      className={`py-3 px-2 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center justify-center gap-1.5 ${
                        preferences.routingPriority === opt 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-primary/50"
                      }`}
                    >
                      {opt === "ECO" ? <Leaf className="w-4 h-4"/> : opt === "TIME" ? <Clock className="w-4 h-4"/> : <Activity className="w-4 h-4"/>}
                      {opt === "ECO" ? "Max Eco" : opt === "TIME" ? "Fastest" : "Balanced"}
                    </button>
                  ))}
                </div>
              </div>

              {/* EV Charging */}
              <div>
                <label className="block text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-3">
                  EV Charging Node Preference
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {["FAST", "CHEAP", "ANY"].map(opt => (
                    <button
                      key={opt}
                      onClick={() => handlePrefChange("evChargingPreference", opt)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold border-2 transition-all ${
                        preferences.evChargingPreference === opt 
                          ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400" 
                          : "border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:border-blue-500/50"
                      }`}
                    >
                      {opt === "FAST" ? "⚡ DC Fast" : opt === "CHEAP" ? "💰 Low Cost" : "🌐 Any"}
                    </button>
                  ))}
                </div>
              </div>

              <hr className="border-neutral-200 dark:border-neutral-800" />

              {/* Toggles */}
              <div className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-neutral-900 dark:text-white">Prefer Cycling Routes</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Boost cycling mode in comparisons.</p>
                    </div>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="sr-only" 
                      checked={preferences.preferCycling} 
                      onChange={(e) => handlePrefChange("preferCycling", e.target.checked)} 
                    />
                    <div className={`block w-12 h-7 rounded-full transition-colors ${preferences.preferCycling ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${preferences.preferCycling ? 'transform translate-x-5' : ''}`}></div>
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                      <Volume2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-neutral-900 dark:text-white">Voice Navigation (TTS)</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Speak directions and AI alerts aloud.</p>
                    </div>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="sr-only" 
                      checked={voiceOn} 
                      onChange={handleVoiceToggle} 
                    />
                    <div className={`block w-12 h-7 rounded-full transition-colors ${voiceOn ? 'bg-indigo-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${voiceOn ? 'transform translate-x-5' : ''}`}></div>
                  </div>
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-neutral-900 dark:text-white">Avoid Unsafe Zones</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Reroute around reported hazards.</p>
                    </div>
                  </div>
                  <div className="relative">
                    <input type="checkbox" className="sr-only" 
                      checked={preferences.avoidUnsafeZones} 
                      onChange={(e) => handlePrefChange("avoidUnsafeZones", e.target.checked)} 
                    />
                    <div className={`block w-12 h-7 rounded-full transition-colors ${preferences.avoidUnsafeZones ? 'bg-orange-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${preferences.avoidUnsafeZones ? 'transform translate-x-5' : ''}`}></div>
                  </div>
                </label>
              </div>

            </div>
          </div>
        </div>

        {/* ── Section C: Gamification Cards & Trends ──────────────────────── */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="grid grid-cols-2 gap-4">
            {/* CO2 Saved */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20 flex flex-col justify-between">
              <Leaf className="w-6 h-6 text-white/80 mb-4" />
              <div>
                <p className="text-3xl font-black">{profile?.totalCo2Saved.toFixed(1)} <span className="text-lg font-bold text-emerald-100">kg</span></p>
                <p className="text-xs font-bold text-emerald-100 uppercase tracking-wide mt-1">Total CO₂ Saved</p>
              </div>
            </div>

            {/* Streak */}
            <div className="bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 flex flex-col justify-between">
              <Zap className="w-6 h-6 text-amber-500 mb-4" />
              <div>
                <p className="text-3xl font-black text-neutral-900 dark:text-white">{profile?.currentStreak} <span className="text-lg font-bold text-neutral-400">days</span></p>
                <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mt-1">Active Streak</p>
              </div>
            </div>
          </div>

          {/* Eco Points */}
          <div className="bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 flex items-center gap-5">
            <div className="p-4 bg-primary/10 rounded-xl text-primary">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <p className="text-3xl font-black text-neutral-900 dark:text-white">{profile?.ecoPoints}</p>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mt-1">Available Eco-Points</p>
            </div>
          </div>

          {/* Prompt Insight Card */}
          <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-5 flex gap-4">
            <div className="text-indigo-500 dark:text-indigo-400 mt-1">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-1">Mobility Insight</h3>
              {preferences.routingPriority !== "ECO" ? (
                <p className="text-xs text-indigo-800 dark:text-indigo-400 font-medium leading-relaxed">
                  Tip: Switching your Core Priority to "Max Eco" could increase your daily CO₂ savings by up to 25% based on your usual routes.
                </p>
              ) : !preferences.preferCycling ? (
                <p className="text-xs text-indigo-800 dark:text-indigo-400 font-medium leading-relaxed">
                  Tip: Enabling "Prefer Cycling" could boost your eco-score accumulation by 40% this week.
                </p>
              ) : (
                <p className="text-xs text-indigo-800 dark:text-indigo-400 font-medium leading-relaxed flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> You're fully optimized for maximum sustainability. Keep it up!
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
