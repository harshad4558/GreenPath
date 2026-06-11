import React from "react";
import { Leaf, Navigation, BatteryCharging, Trophy, ArrowRight, Sparkles } from "lucide-react";

// Theme map to Tailwind background classes
const themeStyles = {
  "Emerald Glow": {
    bg: "from-emerald-950 via-neutral-900 to-emerald-950",
    glow1: "bg-emerald-500/10",
    glow2: "bg-teal-500/5",
    accent: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
    button: "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20",
    borderHover: "hover:border-emerald-500/30"
  },
  "Midnight Purple": {
    bg: "from-indigo-950 via-neutral-900 to-purple-950",
    glow1: "bg-indigo-500/10",
    glow2: "bg-purple-500/5",
    accent: "text-indigo-400 border-indigo-500/20 bg-indigo-500/10",
    button: "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20",
    borderHover: "hover:border-indigo-500/30"
  },
  "Ocean Breeze": {
    bg: "from-blue-950 via-neutral-900 to-cyan-950",
    glow1: "bg-blue-500/10",
    glow2: "bg-cyan-500/5",
    accent: "text-blue-400 border-blue-500/20 bg-blue-500/10",
    button: "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20",
    borderHover: "hover:border-blue-500/30"
  },
  "Cosmic Rose": {
    bg: "from-rose-950 via-neutral-900 to-pink-950",
    glow1: "bg-rose-500/10",
    glow2: "bg-pink-500/5",
    accent: "text-rose-400 border-rose-500/20 bg-rose-500/10",
    button: "bg-rose-600 hover:bg-rose-500 shadow-rose-500/20",
    borderHover: "hover:border-rose-500/30"
  },
  "Dark Obsidian": {
    bg: "from-neutral-950 via-neutral-900 to-neutral-950",
    glow1: "bg-neutral-500/5",
    glow2: "bg-neutral-800/10",
    accent: "text-neutral-400 border-neutral-800 bg-neutral-900/30",
    button: "bg-neutral-800 hover:bg-neutral-700 shadow-neutral-800/20",
    borderHover: "hover:border-neutral-700"
  }
};

export default function LandingPage({ config, onEnter, userEcoPoints }) {
  const {
    landingPageTitle = "Empower Your Journey With GreenPath",
    landingPageSubtitle = "Compare carbon footprints across transportation modes, plan energy-efficient trips, and log eco-friendly miles to earn impact points.",
    landingPageBgColor = "Emerald Glow",
    landingPageButtonText = "Enter Hub"
  } = config || {};

  const activeTheme = themeStyles[landingPageBgColor] || themeStyles["Emerald Glow"];

  return (
    <div className={`min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-gradient-to-b ${activeTheme.bg} relative overflow-hidden px-4 py-12 transition-colors duration-500`}>
      {/* Background ambient glow circles */}
      <div className={`absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full blur-[150px] pointer-events-none ${activeTheme.glow1} animate-pulse duration-[6000ms]`} />
      <div className={`absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[150px] pointer-events-none ${activeTheme.glow2} animate-pulse duration-[8000ms]`} />

      {/* Floating decorative icons (micro-animations) */}
      <div className="absolute top-[15%] left-[10%] opacity-20 animate-bounce duration-[5000ms] hidden lg:block">
        <Leaf className="w-12 h-12 text-emerald-400" />
      </div>
      <div className="absolute top-[20%] right-[12%] opacity-15 animate-bounce duration-[4000ms] hidden lg:block">
        <BatteryCharging className="w-14 h-14 text-blue-400" />
      </div>
      <div className="absolute bottom-[20%] left-[15%] opacity-15 animate-bounce duration-[6000ms] hidden lg:block">
        <Navigation className="w-10 h-10 text-indigo-400" />
      </div>

      {/* Main content container */}
      <div className="w-full max-w-4xl text-center space-y-10 relative z-10 animate-fade-in">
        
        {/* Dynamic header badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-neutral-800 bg-neutral-950/40 backdrop-blur-md text-xs font-semibold text-neutral-300">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-spin duration-[4000ms]" />
          <span>Active Environmental Portal</span>
          {userEcoPoints !== undefined && (
            <>
              <span className="text-neutral-600">|</span>
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                {userEcoPoints} Points Saved
              </span>
            </>
          )}
        </div>

        {/* Dynamic Main Title */}
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-100 to-neutral-500 bg-clip-text text-transparent leading-none drop-shadow">
          {landingPageTitle}
        </h1>

        {/* Dynamic Subtitle */}
        <p className="max-w-2xl mx-auto text-neutral-400 text-base md:text-xl leading-relaxed">
          {landingPageSubtitle}
        </p>

        {/* Dynamic Action CTA Button */}
        <div className="pt-4">
          <button
            onClick={onEnter}
            className={`group inline-flex items-center gap-2 px-8 py-4 text-sm font-bold text-white rounded-xl transition-all duration-300 transform hover:scale-[1.03] shadow-lg ${activeTheme.button}`}
          >
            {landingPageButtonText}
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Dynamic feature highlight grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
          {/* Card 1 */}
          <div className={`p-6 rounded-xl border border-neutral-950/50 bg-neutral-950/30 backdrop-blur-sm transition-all duration-300 ${activeTheme.borderHover} text-left group hover:bg-neutral-950/40`}>
            <div className="p-3 w-fit rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 group-hover:scale-105 transition-transform">
              <Navigation className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Plan Green Routes</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Compare CO₂ profiles, bike paths, and traffic flows. Avoid restricted and unsafe zones in real-time.
            </p>
          </div>

          {/* Card 2 */}
          <div className={`p-6 rounded-xl border border-neutral-950/50 bg-neutral-950/30 backdrop-blur-sm transition-all duration-300 ${activeTheme.borderHover} text-left group hover:bg-neutral-950/40`}>
            <div className="p-3 w-fit rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4 group-hover:scale-105 transition-transform">
              <BatteryCharging className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Smart EV Grid</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Locate high-capacity charging points instantly. Monitor occupancy, connector power, and active stations.
            </p>
          </div>

          {/* Card 3 */}
          <div className={`p-6 rounded-xl border border-neutral-950/50 bg-neutral-950/30 backdrop-blur-sm transition-all duration-300 ${activeTheme.borderHover} text-left group hover:bg-neutral-950/40`}>
            <div className="p-3 w-fit rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4 group-hover:scale-105 transition-transform">
              <Trophy className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Eco Points & Streak</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Earn impact points for sustainable travel. Form eco-friendly habits and climb the mobility leaderboards.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
