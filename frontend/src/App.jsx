import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import { Leaf, LogOut, Navigation, BatteryCharging, LayoutDashboard, UserCheck, KeyRound, Sun, Moon } from "lucide-react";
import { authAPI } from "./utils/api.js";
import { useAssistantSocket } from "./utils/useAssistantSocket.js";
import AssistantAlertPanel from "./components/AssistantAlertPanel.jsx";
import Home from "./pages/Home.jsx";
import PlanTrip from "./pages/PlanTrip.jsx";
import EVCharging from "./pages/EVCharging.jsx";
import ProfileDashboard from "./pages/ProfileDashboard.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

// Auth Gatekeeper Component
function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("USER"); // USER, ADMIN
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        await authAPI.login(email, password);
      } else {
        await authAPI.signup(email, password, role);
      }
      onAuthSuccess();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Authentication failed. Make sure the database and backend are running.");
    } finally {
      setLoading(false);
    }
  };

  const loginDemo = async (demoRole) => {
    setError("");
    setLoading(true);
    const demoEmail = demoRole === "ADMIN" ? "admin@greenpath.com" : "user@greenpath.com";
    const demoPassword = "password123";

    try {
      // Try to log in first
      try {
        await authAPI.login(demoEmail, demoPassword);
      } catch (loginErr) {
        // If login fails, register them first! Seeding pattern on the fly
        await authAPI.signup(demoEmail, demoPassword, demoRole);
      }
      onAuthSuccess();
    } catch (err) {
      console.error("Demo login error:", err);
      setError("Demo login failed. Ensure PostgreSQL database and backend are running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden transition-colors duration-200">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/60 dark:bg-neutral-950/60 backdrop-blur-md border border-neutral-200 dark:border-neutral-900 rounded-2xl p-8 shadow-2xl relative z-10 space-y-6">

        {/* Title branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary mb-2">
            <Leaf className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">GreenPath</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Sustainable Transit Hub & Route Planner</p>
        </div>

        {/* Tab switcher */}
        <div className="grid grid-cols-2 bg-neutral-100 dark:bg-neutral-900/60 p-1 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => { setIsLogin(true); setError(""); }}
            className={`py-1.5 text-xs font-semibold rounded-md transition-all ${isLogin ? "bg-primary text-white" : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(""); }}
            className={`py-1.5 text-xs font-semibold rounded-md transition-all ${!isLogin ? "bg-primary text-white" : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs rounded-lg text-center font-medium">
            {error}
          </div>
        )}

        {/* Form fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-2xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg py-2 px-3 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-2xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg py-2 px-3 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          {!isLogin && (
            <div>
              {/* <label className="block text-2xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 mb-1">Access Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg py-2 px-3 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="USER">Standard User (Profile & Plan)</option>
                <option value="ADMIN">System Administrator (Add Chargers & Analytics)</option>
              </select> */}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary hover:bg-emerald-600 text-white font-semibold rounded-lg text-sm transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loading ? "Authenticating..." : isLogin ? "Access Account" : "Register Credentials"}
          </button>
        </form>

        {/* Quick Demo Access macros */}


      </div>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  // ── Real-Time AI Mobility Assistant WebSocket hook ──────────────────────
  // Initialised here (root level) so it persists across all page navigations.
  // The hook self-connects on mount and auto-reconnects with exponential backoff.
  const { alerts, status: wsStatus, dismissAlert, clearAlerts } = useAssistantSocket();

  // Theme State Configuration
  const [theme, setTheme] = useState(localStorage.getItem("greenpath_theme") || "dark");

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("greenpath_theme", theme);
  }, [theme]);

  const checkAuthStatus = () => {
    const token = localStorage.getItem("greenpath_token");
    const currentUser = authAPI.getCurrentUser();
    if (token && currentUser) {
      setIsAuthenticated(true);
      setUser(currentUser);
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const handleLogout = () => {
    authAPI.logout();
    checkAuthStatus();
  };

  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={checkAuthStatus} />;
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">

        {/* Navigation header bar */}
        <header className="sticky top-0 z-[1001] bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-900 shadow-sm transition-colors">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition-transform">
                <Leaf className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-lg text-neutral-900 dark:text-white font-sans tracking-tight">
                GreenPath
              </span>
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
              <Link to="/profile" className="hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-1.5">
                <LayoutDashboard className="w-4 h-4" />
                Profile
              </Link>
              <Link to="/plan-trip" className="hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-1.5">
                <Navigation className="w-4 h-4" />
                Plan Trip
              </Link>
              <Link to="/charging" className="hover:text-neutral-900 dark:hover:text-white transition-colors flex items-center gap-1.5">
                <BatteryCharging className="w-4 h-4" />
                EV Stations
              </Link>
              {user?.role === "ADMIN" && (
                <Link to="/admin" className="text-red-500 hover:text-red-600 transition-colors flex items-center gap-1.5 font-bold border border-red-500/30 px-2 py-1 rounded bg-red-500/10">
                  System Config
                </Link>
              )}
            </nav>

            {/* Controls panel: Theme, User & Logout */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle Button */}
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all mr-1"
                title="Toggle Theme"
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 text-amber-500" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-500" />
                )}
              </button>

              <div className="text-right hidden sm:block">
                <span className="text-xs text-neutral-900 dark:text-white block font-medium max-w-[150px] truncate">{user?.email}</span>
                <span className={`text-3xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${user?.role === 'ADMIN' ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20'
                  }`}>
                  {user?.role}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Navigation bar for small devices */}
        <div className="md:hidden sticky top-16 z-[1001] bg-white/95 dark:bg-neutral-950/90 border-b border-neutral-200 dark:border-neutral-900 flex justify-around py-3.5 text-2xs font-bold text-neutral-500 dark:text-neutral-400 transition-colors">
          <Link to="/profile" className="flex flex-col items-center gap-1 hover:text-neutral-900 dark:hover:text-white">
            <LayoutDashboard className="w-4.5 h-4.5" />
            Profile
          </Link>
          <Link to="/plan-trip" className="flex flex-col items-center gap-1 hover:text-neutral-900 dark:hover:text-white">
            <Navigation className="w-4.5 h-4.5" />
            Plan Trip
          </Link>
          <Link to="/charging" className="flex flex-col items-center gap-1 hover:text-neutral-900 dark:hover:text-white">
            <BatteryCharging className="w-4.5 h-4.5" />
            EV Chargers
          </Link>
        </div>

        {/* Main View Container */}
        <main className="flex-grow flex flex-col">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<ProfileDashboard />} />
            <Route path="/admin" element={user?.role === "ADMIN" ? <AdminDashboard /> : <Navigate to="/" />} />
            <Route path="/plan-trip" element={<PlanTrip theme={theme} />} />
            <Route path="/charging" element={<EVCharging theme={theme} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-neutral-200 dark:border-neutral-900 bg-neutral-50 dark:bg-neutral-950 py-6 text-center text-3xs text-neutral-500 dark:text-neutral-600 font-medium mt-auto transition-colors">
          &copy; {new Date().getFullYear()} GreenPath Sustainable Transit Hub.
        </footer>

      </div>

      {/* ── Real-Time AI Mobility Assistant Alert Panel ────────────────────
           Fixed overlay rendered outside the main scroll container so it
           floats above the map, nav bar, and all page content at all times. */}
      <AssistantAlertPanel
        alerts={alerts}
        status={wsStatus}
        onDismiss={dismissAlert}
        onClearAll={clearAlerts}
      />

    </Router>
  );
}

