import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Leaf, Navigation, BatteryCharging, Trophy, ArrowRight, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import { authAPI, assistantAPI, userAPI } from "../utils/api.js";
import WeatherWidget from "../components/WeatherWidget.jsx";
import TrafficHeatLayer from "../components/TrafficHeatLayer.jsx";
import LandingPage from "./LandingPage.jsx";

function PredictiveSuggestionCard() {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSuggestion = async () => {
    setLoading(true);
    try {
      const res = await assistantAPI.sendEvent("PREDICTIVE_SUGGESTION");
      if (res?.assistantResponse) {
        setSuggestion(res.assistantResponse);
      } else {
        setSuggestion({
          message: "Based on commute history, we suggest using public transit today to save emissions."
        });
      }
    } catch (err) {
      console.warn("Predictive suggest error:", err);
      setSuggestion({
        message: "Combine EV charging stops with public transit options today for maximum efficiency."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestion();
  }, []);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 backdrop-blur-sm p-4 flex flex-col justify-between h-[230px]">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Predictive Assistant
            </span>
          </div>
          <button
            onClick={fetchSuggestion}
            disabled={loading}
            className="text-neutral-600 hover:text-neutral-300 transition-colors disabled:opacity-50"
            title="Refresh suggestion"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2 py-4">
            <div className="h-4 bg-neutral-900 rounded w-5/6 animate-pulse" />
            <div className="h-4 bg-neutral-900 rounded w-4/6 animate-pulse" />
            <div className="h-3 bg-neutral-900 rounded w-3/6 animate-pulse" />
          </div>
        ) : suggestion ? (
          <div className="space-y-2 py-2">
            <p className="text-sm font-semibold text-white leading-relaxed">
              "{suggestion.message}"
            </p>
            <p className="text-3xs text-emerald-500 font-medium">
              💡 Sparked by your travel history patterns
            </p>
          </div>
        ) : (
          <p className="text-xs text-neutral-500 italic py-4">No suggestions generated yet</p>
        )}
      </div>

      <div className="border-t border-neutral-900 pt-3 flex items-center justify-between text-3xs text-neutral-500">
        <span>AI Engine: Active</span>
        <span>Relevance: 95%</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [landingConfig, setLandingConfig] = useState(null);
  const [showLanding, setShowLanding] = useState(false);
  const [checkingLanding, setCheckingLanding] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const currentUser = authAPI.getCurrentUser();
        const isStandardUser = currentUser?.role === "USER";

        const promises = [
          authAPI.getProfile().then(data => setUserData(data)).catch(err => {
            console.error("Error loading profile details:", err);
            setError("Please login to see your ecological progress stats.");
          })
        ];

        if (isStandardUser) {
          promises.push(
            userAPI.getLandingConfig().then(config => {
              setLandingConfig(config);
              const hasEntered = sessionStorage.getItem("greenpath_entered_hub") === "true";
              if (config?.landingPageActive && !hasEntered) {
                setShowLanding(true);
              }
            }).catch(err => {
              console.warn("Error loading landing config:", err);
            })
          );
        }

        await Promise.all(promises);
      } finally {
        setLoading(false);
        setCheckingLanding(false);
      }
    }
    loadData();
  }, []);

  if (loading || checkingLanding) {
    return (
      <div className="flex-grow flex justify-center items-center h-64 text-primary">
        <RefreshCw className="animate-spin w-8 h-8" />
      </div>
    );
  }

  if (showLanding && landingConfig) {
    return (
      <LandingPage
        config={landingConfig}
        onEnter={() => {
          sessionStorage.setItem("greenpath_entered_hub", "true");
          setShowLanding(false);
        }}
        userEcoPoints={userData?.ecoScore?.totalPoints}
      />
    );
  }

  const stats = [
    {
      title: "Eco Points Earned",
      value: userData?.ecoScore?.totalPoints ?? 0,
      suffix: " pts",
      description: "Earned from walking, transit, & EV charging",
      icon: <Trophy className="w-5 h-5 text-amber-400" />,
      bg: "from-amber-500/10 to-yellow-600/10",
      border: "border-amber-500/20"
    },
    {
      title: "CO₂ Saved",
      value: userData?.ecoScore?.co2Saved ?? 0.0,
      suffix: " kg",
      description: "Relative to a single occupant gasoline car",
      icon: <Leaf className="w-5 h-5 text-emerald-400" />,
      bg: "from-emerald-500/10 to-teal-600/10",
      border: "border-emerald-500/20"
    },
    {
      title: "Sustainable Trips",
      value: userData?.ecoScore?.totalTrips ?? 0,
      suffix: " trips",
      description: "Completed routes using smart green paths",
      icon: <Navigation className="w-5 h-5 text-indigo-400" />,
      bg: "from-indigo-500/10 to-purple-600/10",
      border: "border-indigo-500/20"
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 md:py-16 space-y-12 animate-fade-in">
      {/* Hero Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 p-8 md:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="max-w-2xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary">
            <Leaf className="w-3.5 h-3.5" />
            Ecological Transit Management
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent leading-none">
            Empower Your Journey <br />
            With GreenPath
          </h1>
          <p className="text-neutral-400 text-base md:text-lg max-w-xl">
            Compare carbon footprints across transportation modes, plan energy-efficient trips, and log eco-friendly miles to earn impact points.
          </p>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold tracking-tight text-neutral-200">
          Your Ecological Progress
        </h2>

        {error ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400/90 text-sm">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
            <Link to="/login" className="underline font-semibold ml-auto hover:text-white transition-colors">
              Login Now
            </Link>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-neutral-900/50 border border-neutral-800 animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-xl border ${stat.border} bg-gradient-to-br ${stat.bg} shadow-lg relative overflow-hidden transition-all duration-300 hover:scale-[1.02]`}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                      {stat.title}
                    </p>
                    <h3 className="text-3xl font-extrabold text-white">
                      {stat.value}
                      <span className="text-lg font-semibold text-neutral-300">{stat.suffix}</span>
                    </h3>
                  </div>
                  <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800">
                    {stat.icon}
                  </div>
                </div>
                <p className="mt-4 text-xs text-neutral-500">{stat.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real-Time OS Intelligence Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {/* Weather card */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">
            Local Weather
          </h3>
          <WeatherWidget />
        </div>

        {/* Live Traffic */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">
            Live Traffic
          </h3>
          <TrafficHeatLayer origin="51.505,-0.09" destination="51.51,-0.08" travelMode="EV" />
        </div>

        {/* Predictive AI Co-pilot suggestion */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">
            Mobility Co-pilot Suggestion
          </h3>
          <PredictiveSuggestionCard />
        </div>
      </div>

      {/* Quick Action Links Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        {/* Plan Trip Card link */}
        <Link
          to="/plan-trip"
          className="group relative flex flex-col justify-between p-8 rounded-xl border border-neutral-800 bg-neutral-950/50 hover:bg-neutral-900/40 transition-all duration-300 shadow-xl overflow-hidden hover:border-emerald-500/30"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-all"></div>
          <div>
            <div className="p-3 w-fit rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
              <Navigation className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
              Plan Eco-Route
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed mb-8">
              Compare options for EV profiles, public transit, and cycling. Discover optimal eco-scores using dynamic coordinates and spatial mapping.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mt-auto">
            Open Planning Tool
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
          </span>
        </Link>

        {/* Charger Map Card link */}
        <Link
          to="/charging"
          className="group relative flex flex-col justify-between p-8 rounded-xl border border-neutral-800 bg-neutral-950/50 hover:bg-neutral-900/40 transition-all duration-300 shadow-xl overflow-hidden hover:border-blue-500/30"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/10 transition-all"></div>
          <div>
            <div className="p-3 w-fit rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-6 group-hover:scale-110 transition-transform">
              <BatteryCharging className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
              EV Charging Stations
            </h3>
            <p className="text-neutral-400 text-sm leading-relaxed mb-8">
              Locate charging points, verify availability, and toggle status. View coordinates and active statuses on the interactive map grid.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 mt-auto">
            Open Charger Map
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
          </span>
        </Link>
      </div>
    </div>
  );
}
