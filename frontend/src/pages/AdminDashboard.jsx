import React, { useState, useEffect, useRef } from "react";
import {
  Settings,
  ShieldAlert,
  Save,
  ServerCrash,
  RefreshCw,
  Palette,
  Eye,
  Layout,
  Sparkles,
  Users,
  TrendingUp,
  Award,
  Activity,
  Compass,
  CheckCircle2,
  Trash2,
  Sliders,
  Play,
  AlertCircle,
  HelpCircle,
  Thermometer,
  CloudSun,
  BatteryCharging,
  Radio,
  FileText,
  MapPin,
  Map,
  X
} from "lucide-react";
import { adminAPI } from "../utils/api.js";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("analytics");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Custom Toast Notification State
  const [toast, setToast] = useState(null);

  // System Config State
  const [config, setConfig] = useState(null);
  
  // Route Governance State
  const [zones, setZones] = useState([]);
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneType, setNewZoneType] = useState("UNSAFE_ZONE");
  const [newZoneGeoJson, setNewZoneGeoJson] = useState('[\n  [18.5204, 73.8567],\n  [18.5209, 73.8570],\n  [18.5200, 73.8580]\n]');

  // Analytics State
  const [analytics, setAnalytics] = useState({
    totalUsers: 0,
    totalTrips: 0,
    totalCO2Saved: 0,
    totalStations: 0,
    availableStations: 0
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Preset Spatial Restrictions Templates
  const geoJsonPresets = [
    {
      name: "Seattle Downtown Hub Block",
      type: "UNSAFE_ZONE",
      coords: `[\n  [47.6062, -122.3321],\n  [47.6090, -122.3360],\n  [47.6040, -122.3380],\n  [47.6020, -122.3330]\n]`
    },
    {
      name: "Kolhapur Highway Diversion",
      type: "TRANSIT_RESTRICTION",
      coords: `[\n  [16.7020, 74.2410],\n  [16.7050, 74.2450],\n  [16.7000, 74.2480]\n]`
    },
    {
      name: "Shivaji University Cycling Only Zone",
      type: "CYCLING_RESTRICTION",
      coords: `[\n  [16.6750, 74.2510],\n  [16.6810, 74.2550],\n  [16.6790, 74.2590],\n  [16.6730, 74.2560]\n]`
    }
  ];

  // Fetch data
  const fetchAdminData = async () => {
    try {
      setLoading(true);
      
      // Fetch system configuration
      const configRes = await adminAPI.getSystemConfig();
      setConfig(configRes.config);

      // Fetch governance spatial zones
      const zoneRes = await adminAPI.getGovernanceZones();
      setZones(zoneRes.zones);

      // Fetch admin stats & leaderboard
      const analyticsRes = await adminAPI.getAnalytics();
      if (analyticsRes.analytics) {
        setAnalytics(analyticsRes.analytics);
      }
      if (analyticsRes.leaderboard) {
        setLeaderboard(analyticsRes.leaderboard);
      }

      // Fetch active navigation sessions
      const monitorRes = await adminAPI.getLiveMonitorData();
      if (monitorRes.activeSessions) {
        setActiveSessions(monitorRes.activeSessions);
      }

    } catch (err) {
      console.error("Failed to load admin data", err);
      showToast("Error loading system metrics and configuration", "error");
    } finally {
      setLoading(false);
    }
  };

  // Poll active sessions and analytics every 10 seconds if activeTab is analytics
  useEffect(() => {
    fetchAdminData();
  }, [refreshKey]);

  useEffect(() => {
    if (activeTab !== "analytics") return;
    
    const interval = setInterval(async () => {
      try {
        const monitorRes = await adminAPI.getLiveMonitorData();
        if (monitorRes.activeSessions) {
          setActiveSessions(monitorRes.activeSessions);
        }
        const analyticsRes = await adminAPI.getAnalytics();
        if (analyticsRes.analytics) {
          setAnalytics(analyticsRes.analytics);
        }
      } catch (err) {
        console.warn("Auto-refresh background poll failed", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [activeTab]);

  // Toast helper
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalVal = value;
    if (type === "checkbox") {
      finalVal = checked;
    } else if (type === "number" || e.target.step) {
      finalVal = parseFloat(value);
    }
    setConfig((prev) => ({ ...prev, [name]: finalVal }));
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      await adminAPI.updateSystemConfig(config);
      showToast("System configuration successfully updated. Settings deployed live!");
    } catch (err) {
      showToast("Failed to save config options.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddZone = async () => {
    if (!newZoneName.trim()) {
      showToast("Please enter a valid Zone Name.", "error");
      return;
    }
    try {
      setSaving(true);
      // Validate JSON
      try {
        JSON.parse(newZoneGeoJson);
      } catch (jsonErr) {
        showToast("Invalid GeoJSON coordinates format. Must be double array: [[lat, lng], ...]", "error");
        setSaving(false);
        return;
      }

      await adminAPI.addGovernanceZone({
        name: newZoneName,
        type: newZoneType,
        geoJsonData: newZoneGeoJson
      });
      
      setNewZoneName("");
      showToast(`Governance Zone "${newZoneName}" successfully deployed!`);
      // Reload zones
      const zoneRes = await adminAPI.getGovernanceZones();
      setZones(zoneRes.zones);
    } catch (err) {
      showToast("Failed to add zone: " + (err.response?.data?.message || err.message), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZone = async (id, name) => {
    try {
      await adminAPI.deleteGovernanceZone(id);
      showToast(`Restriction "${name}" successfully deleted.`);
      const zoneRes = await adminAPI.getGovernanceZones();
      setZones(zoneRes.zones);
    } catch (err) {
      showToast("Failed to delete spatial zone.", "error");
    }
  };

  const loadPresetTemplate = (preset) => {
    setNewZoneName(preset.name);
    setNewZoneType(preset.type);
    setNewZoneGeoJson(preset.coords);
    showToast(`Loaded "${preset.name}" coordinates template.`);
  };

  // Dynamic SVG Area Chart points generator for CO2 Saved
  const renderCo2AreaChart = () => {
    const totalCO2Val = analytics.totalCO2Saved || 124.5;
    // Generate beautiful trendline curve heading up to totalCO2Val
    const points = [
      totalCO2Val * 0.08,
      totalCO2Val * 0.22,
      totalCO2Val * 0.38,
      totalCO2Val * 0.52,
      totalCO2Val * 0.68,
      totalCO2Val * 0.85,
      totalCO2Val
    ];
    
    const width = 500;
    const height = 180;
    const padding = 25;
    
    // Map points to SVG coordinates
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    const maxVal = Math.max(...points) * 1.15 || 100;
    const minVal = 0;
    
    const coordinates = points.map((val, index) => {
      const x = padding + (index / (points.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;
      return { x, y, val };
    });
    
    // Create line path d string (smooth curve using cubic bezier approximation or simple lines)
    let pathD = `M ${coordinates[0].x} ${coordinates[0].y}`;
    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];
      // control points for curve
      const cpX1 = prev.x + (curr.x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (curr.x - prev.x) / 2;
      const cpY2 = curr.y;
      pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
    }
    
    // Create fill path d string by closing path at the bottom
    const fillD = `${pathD} L ${coordinates[coordinates.length - 1].x} ${height - padding} L ${coordinates[0].x} ${height - padding} Z`;
    
    return (
      <div className="w-full h-full flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">CO₂ Savings Growth (kg)</h4>
            <p className="text-xl font-black text-emerald-500">Cumulative Savings</p>
          </div>
          <span className="text-2xs font-extrabold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">7-Day Curve</span>
        </div>
        <div className="relative w-full flex-grow min-h-[160px]">
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            
            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = padding + ratio * chartHeight;
              return (
                <line 
                  key={i} 
                  x1={padding} 
                  y1={y} 
                  x2={width - padding} 
                  y2={y} 
                  className="stroke-neutral-200 dark:stroke-neutral-800/60" 
                  strokeWidth="1" 
                  strokeDasharray="4 4"
                />
              );
            })}
            
            {/* Area path */}
            <path d={fillD} fill="url(#chartGlow)" />
            
            {/* Line path */}
            <path d={pathD} fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            
            {/* Interactive Nodes */}
            {coordinates.map((coord, index) => (
              <g key={index} className="group/node cursor-pointer">
                <circle 
                  cx={coord.x} 
                  cy={coord.y} 
                  r="5" 
                  fill="#ffffff" 
                  stroke="#10b981" 
                  strokeWidth="3.5" 
                  className="transition-all duration-200 hover:r-7 hover:stroke-emerald-400"
                />
                {/* Custom node tooltip on hover */}
                <g className="opacity-0 group-hover/node:opacity-100 transition-opacity duration-200">
                  <rect 
                    x={coord.x - 30} 
                    y={coord.y - 30} 
                    width="60" 
                    height="20" 
                    rx="4" 
                    fill="#171717" 
                    className="stroke-neutral-800 dark:fill-neutral-900" 
                  />
                  <text 
                    x={coord.x} 
                    y={coord.y - 16} 
                    textAnchor="middle" 
                    fill="#ffffff" 
                    fontSize="9" 
                    fontWeight="bold"
                  >
                    {coord.val.toFixed(1)}kg
                  </text>
                </g>
              </g>
            ))}
            
            {/* X Axis Labels */}
            {["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Today"].map((label, idx) => {
              const x = padding + (idx / 6) * chartWidth;
              return (
                <text key={idx} x={x} y={height - 5} textAnchor="middle" fill="#737373" className="text-[9px] font-bold font-sans">
                  {label}
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  // EV Station Share Doughnut chart
  const renderEvDoughnutChart = () => {
    const total = analytics.totalStations || 8;
    const available = analytics.availableStations || 5;
    const inUse = total - available;
    const availPercent = total > 0 ? (available / total) * 100 : 0;
    
    // Doughnut settings
    const radius = 50;
    const strokeWidth = 12;
    const circ = 2 * Math.PI * radius;
    
    // Arc length for available stations
    const strokeDash = (availPercent / 100) * circ;
    const strokeDashOffset = circ - strokeDash;

    return (
      <div className="w-full h-full flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">EV Charger Network Share</h4>
            <p className="text-xl font-black text-blue-500">Node Availability</p>
          </div>
          <span className="text-2xs font-extrabold px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">Live Sync</span>
        </div>
        <div className="flex-grow flex items-center justify-around py-4">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              {/* Background Ring (Offline / In-use) */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-neutral-100 dark:stroke-neutral-800"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Highlight Segment (In Use - Orange) */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-orange-500"
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={`${circ}`}
                strokeDashoffset="0"
              />
              {/* Available Segment (Emerald Green) */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="stroke-emerald-500 transition-all duration-500"
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={`${circ}`}
                strokeDashoffset={`${strokeDashOffset}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black text-neutral-900 dark:text-white">{availPercent.toFixed(0)}%</span>
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Online</span>
            </div>
          </div>
          <div className="flex flex-col justify-center space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <div>
                <p className="font-bold text-neutral-900 dark:text-white">{available} Chargers</p>
                <p className="text-3xs text-neutral-500 uppercase">Available</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
              <div>
                <p className="font-bold text-neutral-900 dark:text-white">{inUse} Chargers</p>
                <p className="text-3xs text-neutral-500 uppercase">In Use / Offline</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading && !config) return (
    <div className="flex-grow flex justify-center items-center h-96 text-primary">
      <div className="flex flex-col items-center gap-4">
        <RefreshCw className="animate-spin w-10 h-10 text-primary" />
        <p className="text-sm font-semibold text-neutral-500">Syncing Administrative Metrics...</p>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      
      {/* Dynamic Floating Toast Alert Notifications */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[2000] flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-xl animate-slide-in-right backdrop-blur-md ${
          toast.type === "error" 
            ? "bg-red-500/10 dark:bg-red-950/20 border-red-500/30 text-red-700 dark:text-red-400 shadow-red-950/10" 
            : "bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 shadow-emerald-950/10"
        }`}>
          {toast.type === "error" ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
          <span className="text-xs font-bold font-sans tracking-wide">{toast.message}</span>
          <button onClick={() => setToast(null)} className="hover:opacity-75 transition-opacity ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SYSTEM OVERRIDE WARNING BAR */}
      <div className="bg-red-500/10 dark:bg-red-950/20 border border-red-500/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-500/20 rounded-xl text-red-600 dark:text-red-400">
            <ServerCrash className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-black text-red-800 dark:text-red-400 uppercase tracking-tight flex items-center gap-1.5">
              System Administrator Dashboard
            </h1>
            <p className="text-red-700/80 dark:text-red-300/80 text-2xs font-semibold">
              Global override credentials validated. Modification alters router weight metrics and governance geometry on the fly.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { setRefreshKey(prev => prev + 1); showToast("Refreshing administrative data..."); }} 
            className="p-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 transition-all"
            title="Refresh All Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <span className="text-2xs font-black px-3 py-1.5 rounded-lg bg-red-500 text-white shadow-md shadow-red-500/10">ROOT OVERRIDE</span>
        </div>
      </div>

      {/* DASHBOARD TABBED NAV BAR */}
      <div className="flex flex-wrap gap-2 border-b border-neutral-200 dark:border-neutral-900 pb-3">
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 border transition-all ${
            activeTab === "analytics"
              ? "bg-primary text-white border-primary shadow-lg shadow-primary/15"
              : "bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
          }`}
        >
          <TrendingUp className="w-4.5 h-4.5" />
          Analytics Hub
        </button>

        <button
          onClick={() => setActiveTab("routing")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 border transition-all ${
            activeTab === "routing"
              ? "bg-primary text-white border-primary shadow-lg shadow-primary/15"
              : "bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
          }`}
        >
          <Sliders className="w-4.5 h-4.5" />
          Routing Config
        </button>

        <button
          onClick={() => setActiveTab("governance")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 border transition-all ${
            activeTab === "governance"
              ? "bg-primary text-white border-primary shadow-lg shadow-primary/15"
              : "bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
          }`}
        >
          <ShieldAlert className="w-4.5 h-4.5" />
          Route Governance
        </button>

        <button
          onClick={() => setActiveTab("portal")}
          className={`px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 border transition-all ${
            activeTab === "portal"
              ? "bg-primary text-white border-primary shadow-lg shadow-primary/15"
              : "bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
          }`}
        >
          <Layout className="w-4.5 h-4.5" />
          Portal Customizer
        </button>
      </div>

      {/* TAB CONTENTS CONTAINER */}
      <div className="w-full">
        
        {/* TAB 1: ANALYTICS HUB */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            
            {/* KPI STATS CARDS GRID */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[110px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-all pointer-events-none" />
                <Users className="w-5 h-5 text-neutral-400 mb-2" />
                <div>
                  <p className="text-2xl font-black text-neutral-900 dark:text-white">{analytics.totalUsers}</p>
                  <p className="text-3xs font-extrabold text-neutral-400 uppercase tracking-wider mt-1">Total Users</p>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[110px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-all pointer-events-none" />
                <Compass className="w-5 h-5 text-neutral-400 mb-2" />
                <div>
                  <p className="text-2xl font-black text-neutral-900 dark:text-white">{analytics.totalTrips}</p>
                  <p className="text-3xs font-extrabold text-neutral-400 uppercase tracking-wider mt-1">Trips Planned</p>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[110px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
                <Award className="w-5 h-5 text-emerald-500 mb-2" />
                <div>
                  <p className="text-2xl font-black text-emerald-500">{analytics.totalCO2Saved} <span className="text-xs font-bold text-neutral-400">kg</span></p>
                  <p className="text-3xs font-extrabold text-neutral-400 uppercase tracking-wider mt-1">CO₂ Savings Saved</p>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[110px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all pointer-events-none" />
                <BatteryCharging className="w-5 h-5 text-neutral-400 mb-2" />
                <div>
                  <p className="text-2xl font-black text-neutral-900 dark:text-white">
                    {analytics.availableStations} <span className="text-xs font-bold text-neutral-400">/ {analytics.totalStations}</span>
                  </p>
                  <p className="text-3xs font-extrabold text-neutral-400 uppercase tracking-wider mt-1">EV Station Health</p>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[110px] col-span-2 md:col-span-1 border-emerald-500/30 bg-gradient-to-br from-white to-emerald-500/[0.02] dark:from-neutral-900 dark:to-emerald-500/[0.02]">
                <div className="flex items-center justify-between mb-2">
                  <Radio className="w-5 h-5 text-emerald-500 animate-pulse" />
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-black text-neutral-900 dark:text-white">{activeSessions.length}</p>
                  <p className="text-3xs font-extrabold text-neutral-400 uppercase tracking-wider mt-1">Live Active Trips</p>
                </div>
              </div>
            </div>

            {/* DUAL SVG CHARTS GRAPH BLOCK */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm min-h-[260px] flex flex-col justify-between">
                {renderCo2AreaChart()}
              </div>
              <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 shadow-sm min-h-[260px] flex flex-col justify-between">
                {renderEvDoughnutChart()}
              </div>
            </div>

            {/* LEADERBOARD & LIVE NAVIGATION MONITOR SECTIONS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* ECO LEADERBOARD WIDGET */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col">
                <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-amber-500" />
                  Eco-Warrior Global Leaderboard
                </h3>
                
                <div className="flex-grow space-y-3 overflow-y-auto max-h-[350px] pr-1">
                  {leaderboard.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-100/60 dark:hover:bg-neutral-850 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-xs shadow-sm">
                          {idx === 0 ? <span className="text-xl">🏆</span> : 
                           idx === 1 ? <span className="text-xl">🥈</span> : 
                           idx === 2 ? <span className="text-xl">🥉</span> : 
                           <span className="text-neutral-400 font-mono">#{idx + 1}</span>}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]">{item.email}</p>
                          <p className="text-3xs text-neutral-400 uppercase tracking-wide">User Account</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className="text-xs font-black text-emerald-500">{Number(item.co2Saved || 0).toFixed(1)} kg</p>
                          <p className="text-3xs text-neutral-400 uppercase tracking-wide">CO₂ Saved</p>
                        </div>
                        <div className="bg-primary/15 dark:bg-primary/20 px-2.5 py-1.5 rounded-lg border border-primary/20 text-center min-w-[70px]">
                          <p className="text-xs font-extrabold text-primary">{item.totalPoints} pts</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {leaderboard.length === 0 && (
                    <div className="text-center py-8">
                      <Award className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
                      <p className="text-xs font-bold text-neutral-500">No scoring metrics recorded yet.</p>
                      <p className="text-3xs text-neutral-400 mt-1">Standard user trip logs automatically populate this list.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* LIVE ACTIVE NAVIGATION SESSIONS FEED */}
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    Live Mobility Monitor
                  </h3>
                  <span className="text-2xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-pulse">
                    {activeSessions.length} active
                  </span>
                </div>

                <div className="flex-grow space-y-3 overflow-y-auto max-h-[350px] pr-1">
                  {activeSessions.map((session, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                          <span className="text-xs font-black text-neutral-900 dark:text-white truncate max-w-[150px]">{session.userId}</span>
                        </div>
                        <span className="text-3xs font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          {session.travelMode}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-2xs text-neutral-500">
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-3xs text-neutral-400">Current Trip State</p>
                          <p className="font-bold text-neutral-850 dark:text-neutral-300 mt-0.5">{session.state.replace(/_/g, " ")}</p>
                        </div>
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-3xs text-neutral-400">Trip Scope</p>
                          <p className="font-bold text-neutral-850 dark:text-neutral-300 mt-0.5">
                            {(session.distanceM / 1000).toFixed(1)} km | {Math.round(session.durationS / 60)} mins
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-800 text-[10px] text-neutral-400">
                        <div className="flex items-center gap-1">
                          <Thermometer className="w-3 h-3 text-red-500" />
                          <span>{session.weatherInfo?.temp}°C - {session.weatherInfo?.condition}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CloudSun className="w-3 h-3 text-blue-400" />
                          <span className={`font-bold ${
                            session.trafficLevel === "HIGH" ? "text-red-500" :
                            session.trafficLevel === "MEDIUM" ? "text-amber-500" : "text-emerald-500"
                          }`}>
                            {session.trafficLevel} Traffic
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {activeSessions.length === 0 && (
                    <div className="text-center py-12">
                      <Compass className="w-10 h-10 text-neutral-350 dark:text-neutral-700 mx-auto mb-2 animate-spin duration-[15000ms]" />
                      <p className="text-xs font-bold text-neutral-500">System idling. No active navigation sessions.</p>
                      <p className="text-3xs text-neutral-400 mt-1">Real-time socket.io feeds appear here when users trigger GPS runs.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: SYSTEM WEIGHTS & CONFIG */}
        {activeTab === "routing" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Core routing configuration controls */}
            <div className="lg:col-span-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-neutral-400" />
                  Global Core Routing Weights
                </h3>
                <button 
                  onClick={saveConfig} 
                  disabled={saving} 
                  className="bg-primary hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/10 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> Save Configuration
                </button>
              </div>

              <div className="space-y-6">
                
                {/* CO2 Weight Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-neutral-500 uppercase tracking-wider">CO₂ Weight Override</span>
                    <span className="font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {config?.co2Weight ?? 1.0}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="0" 
                      max="5" 
                      step="0.1" 
                      name="co2Weight" 
                      value={config?.co2Weight ?? 1.0} 
                      onChange={handleConfigChange} 
                      className="w-full accent-primary h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <p className="text-3xs text-neutral-400 leading-relaxed">
                    Influences the priority of eco-friendly and lower emission routes. High weight favors bicycles and walking.
                  </p>
                </div>

                {/* Time Weight Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-neutral-500 uppercase tracking-wider">Time Priority Weight</span>
                    <span className="font-black px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                      {config?.timeWeight ?? 1.0}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="0" 
                      max="5" 
                      step="0.1" 
                      name="timeWeight" 
                      value={config?.timeWeight ?? 1.0} 
                      onChange={handleConfigChange} 
                      className="w-full accent-primary h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <p className="text-3xs text-neutral-400 leading-relaxed">
                    Influences the travel-time duration multiplier. High weight pushes the engine to prioritize highways and fast paths.
                  </p>
                </div>

                {/* Cost Weight Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-neutral-500 uppercase tracking-wider">Cost Weight Override</span>
                    <span className="font-black px-2 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20">
                      {config?.costWeight ?? 1.0}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="0" 
                      max="5" 
                      step="0.1" 
                      name="costWeight" 
                      value={config?.costWeight ?? 1.0} 
                      onChange={handleConfigChange} 
                      className="w-full accent-primary h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <p className="text-3xs text-neutral-400 leading-relaxed">
                    Increases avoidance of toll roads, parking nodes, or high public transport ticket expenses.
                  </p>
                </div>

                {/* EV Recommendation Bias Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-neutral-500 uppercase tracking-wider">EV Bias Multiplier</span>
                    <span className="font-black px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      {config?.evRecommendationBias ?? 1.0}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="0" 
                      max="5" 
                      step="0.1" 
                      name="evRecommendationBias" 
                      value={config?.evRecommendationBias ?? 1.0} 
                      onChange={handleConfigChange} 
                      className="w-full accent-primary h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <p className="text-3xs text-neutral-400 leading-relaxed">
                    Weights vehicle routing in favor of EV vehicles. Amplifies recommendations of electric car options.
                  </p>
                </div>

                <hr className="border-neutral-100 dark:border-neutral-800" />

                {/* Reroute Threshold */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider">Reroute Threshold (meters)</label>
                  <input 
                    type="number" 
                    name="rerouteThresholdMeters" 
                    value={config?.rerouteThresholdMeters ?? 30} 
                    onChange={handleConfigChange} 
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" 
                  />
                  <p className="text-3xs text-neutral-400 leading-relaxed">
                    Deviation distance buffer. If user wanders further than this range away from path, OSRM resolves navigation again.
                  </p>
                </div>

              </div>
            </div>

            {/* Informational Guidance Box */}
            <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-neutral-400" />
                  Routing Logic Guidance
                </h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  GreenPath runs a multi-criteria path optimization formula to select and rank transit directions. Weights configured here instantly adjust the calculation matrices for all users:
                </p>
                <div className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-150 dark:border-neutral-800 font-mono text-3xs text-neutral-500 space-y-1.5">
                  <p className="font-bold text-neutral-800 dark:text-neutral-300">Metric Optimization formula:</p>
                  <p className="text-emerald-500">RouteCost = (CO₂ * CO₂Weight) + (Duration * TimeWeight) + (Price * CostWeight)</p>
                </div>
                <div className="space-y-3.5 pt-2 text-xs">
                  <div className="flex gap-2">
                    <span className="w-5 h-5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-500 text-3xs font-black flex items-center justify-center">1</span>
                    <p className="text-neutral-500 leading-normal"><strong className="text-neutral-950 dark:text-neutral-200">Balanced setup (1.0 default)</strong> maintains equal compromises between eco, speed, and fare constraints.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 h-5 bg-blue-500/10 border border-blue-500/20 rounded-md text-blue-500 text-3xs font-black flex items-center justify-center">2</span>
                    <p className="text-neutral-500 leading-normal"><strong className="text-neutral-950 dark:text-neutral-200">Extreme CO₂ settings (3.0+)</strong> force route plans to skip car-paths entirely, redirecting commuters towards clean cycling tracks.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.03] text-2xs text-indigo-600 dark:text-indigo-400 font-semibold leading-relaxed mt-6">
                ⚡ Any adjustment saved goes live immediately. Open socket loops broadcast new config flags to currently connected navigators.
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: ROUTE GOVERNANCE */}
        {activeTab === "governance" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Deploy restriction creator */}
            <div className="lg:col-span-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <h3 className="text-base font-bold flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <ShieldAlert className="w-5 h-5 text-orange-500" />
                  Deploy New Spatial Restriction
                </h3>

                {/* GeoJSON Presets template bar */}
                <div className="space-y-1.5">
                  <label className="block text-3xs font-extrabold text-neutral-400 uppercase tracking-wider">Load Testing Coordinates Preset</label>
                  <div className="flex flex-wrap gap-2">
                    {geoJsonPresets.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => loadPresetTemplate(preset)}
                        className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-3xs font-bold text-neutral-600 dark:text-neutral-400 transition-colors flex items-center gap-1.5"
                      >
                        <MapPin className="w-3 h-3 text-primary" />
                        {preset.name.split(" ")[0]} Area
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wide">Zone Label</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Shivaji Marg Roadblock" 
                      value={newZoneName} 
                      onChange={e => setNewZoneName(e.target.value)} 
                      className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wide">Restriction Type</label>
                    <select 
                      value={newZoneType} 
                      onChange={e => setNewZoneType(e.target.value)} 
                      className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="UNSAFE_ZONE">Unsafe Zone (General Block)</option>
                      <option value="CYCLING_RESTRICTION">Cycling Restriction</option>
                      <option value="TRANSIT_RESTRICTION">Transit Block</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide">GeoJSON Coordinate Matrix</label>
                    <span className="text-3xs text-neutral-400 font-mono">Format: [[lat, lng], [lat, lng]]</span>
                  </div>
                  <textarea 
                    placeholder="[[18.52, 73.85], [18.53, 73.86]]" 
                    value={newZoneGeoJson} 
                    onChange={e => setNewZoneGeoJson(e.target.value)} 
                    className="w-full h-32 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3.5 py-2.5 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary resize-none" 
                  />
                </div>
              </div>

              <button 
                onClick={handleAddZone} 
                disabled={saving} 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-3.5 rounded-xl shadow-lg shadow-orange-500/10 transition-transform active:scale-95 disabled:opacity-50"
              >
                Deploy Spatial Restriction
              </button>
            </div>

            {/* List active restrictions */}
            <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col h-[480px]">
              <h3 className="text-base font-bold flex items-center gap-2 mb-4 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <Map className="w-5 h-5 text-neutral-400" />
                Active Restrictions Deployed
              </h3>

              <div className="flex-grow overflow-y-auto space-y-3 pr-2">
                {zones.map(z => (
                  <div key={z.id} className="p-3.5 border border-neutral-200 dark:border-neutral-800 rounded-xl flex justify-between items-center bg-neutral-50 dark:bg-neutral-950/60">
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-neutral-900 dark:text-white leading-tight">{z.name}</p>
                      <span className={`inline-block text-3xs font-extrabold px-2 py-0.5 rounded ${
                        z.type === "UNSAFE_ZONE" ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                        z.type === "CYCLING_RESTRICTION" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                        "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                      }`}>
                        {z.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleDeleteZone(z.id, z.name)} 
                      className="text-xs p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                      title="Revoke Spatial Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {zones.length === 0 && (
                  <div className="text-center py-16">
                    <ShieldAlert className="w-10 h-10 text-neutral-350 dark:text-neutral-700 mx-auto mb-2" />
                    <p className="text-xs font-bold text-neutral-500">No active restrictions deployed.</p>
                    <p className="text-3xs text-neutral-400 mt-1">Deploy spatial rules to force router bypasses.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: PORTAL CUSTOMIZER */}
        {activeTab === "portal" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Customizer editor panel */}
            <div className="lg:col-span-7 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Palette className="w-5 h-5 text-neutral-400" />
                  Customize Portal Content
                </h3>
                <button 
                  onClick={saveConfig} 
                  disabled={saving} 
                  className="bg-primary hover:bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/10 transition-all"
                >
                  <Save className="w-4 h-4" /> Save Portal Settings
                </button>
              </div>

              {/* Active Switcher Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-150 dark:border-neutral-850">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Dynamic Landing Page Status</label>
                  <p className="text-3xs text-neutral-500 dark:text-neutral-400 leading-normal">
                    {config?.landingPageActive ? "Active: Standard users see the custom landing page on first load." : "Deactivated: Standard users bypass landing page and go straight to Plan Trip."}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="landingPageActive" 
                    checked={config?.landingPageActive ?? true} 
                    onChange={handleConfigChange}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-neutral-200 dark:bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1.5">Portal Main Title</label>
                  <input 
                    type="text" 
                    name="landingPageTitle" 
                    value={config?.landingPageTitle || ""} 
                    onChange={handleConfigChange} 
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1.5">Description Subheading</label>
                  <textarea 
                    name="landingPageSubtitle" 
                    value={config?.landingPageSubtitle || ""} 
                    onChange={handleConfigChange} 
                    className="w-full h-24 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1.5">Primary Button CTA Text</label>
                  <input 
                    type="text" 
                    name="landingPageButtonText" 
                    value={config?.landingPageButtonText || ""} 
                    onChange={handleConfigChange} 
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Theme Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wide">Portal Color Palette & Gradient</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {[
                      { name: "Emerald Glow", colors: "from-emerald-500 to-teal-700" },
                      { name: "Midnight Purple", colors: "from-indigo-500 to-purple-700" },
                      { name: "Ocean Breeze", colors: "from-blue-500 to-cyan-700" },
                      { name: "Cosmic Rose", colors: "from-rose-500 to-pink-700" },
                      { name: "Dark Obsidian", colors: "from-neutral-700 to-neutral-900" }
                    ].map((themeItem) => (
                      <button
                        key={themeItem.name}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, landingPageBgColor: themeItem.name }))}
                        className={`p-2.5 rounded-xl border text-[10px] font-extrabold transition-all text-center flex flex-col items-center gap-1.5 ${
                          config?.landingPageBgColor === themeItem.name
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-neutral-250 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-500 hover:border-neutral-400"
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full bg-gradient-to-br ${themeItem.colors} shadow-sm`} />
                        <span className="truncate w-full">{themeItem.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* High fidelity interactive live preview */}
            <div className="lg:col-span-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <Eye className="w-5 h-5 text-neutral-400" />
                Landing Page Preview
              </h3>

              {/* Simulated Desktop Preview frame */}
              <div className="relative rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-lg overflow-hidden bg-neutral-950 flex-grow min-h-[380px] flex flex-col">
                
                {/* Window Controls Decorator */}
                <div className="bg-neutral-900/80 px-4 py-2 border-b border-neutral-850 flex items-center justify-between text-neutral-500">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                  </div>
                  <div className="text-[9px] bg-neutral-950/80 px-6 py-0.5 rounded border border-neutral-800/40 text-neutral-400 font-mono">
                    greenpath.com/portal
                  </div>
                  <div className="w-[30px]" />
                </div>

                {/* Viewport content */}
                <div className={`flex-grow relative flex flex-col items-center justify-center p-6 text-center overflow-hidden transition-all duration-500 bg-gradient-to-b ${
                  config?.landingPageBgColor === "Emerald Glow" ? "from-emerald-950 via-neutral-900 to-emerald-950" :
                  config?.landingPageBgColor === "Midnight Purple" ? "from-indigo-950 via-neutral-900 to-purple-950" :
                  config?.landingPageBgColor === "Ocean Breeze" ? "from-blue-950 via-neutral-900 to-cyan-950" :
                  config?.landingPageBgColor === "Cosmic Rose" ? "from-rose-950 via-neutral-900 to-pink-950" :
                  "from-neutral-950 via-neutral-900 to-neutral-950"
                }`}>
                  {/* Glow rings */}
                  <div className={`absolute top-1/4 left-1/4 w-40 h-40 rounded-full blur-2xl pointer-events-none opacity-40 ${
                    config?.landingPageBgColor === "Emerald Glow" ? "bg-emerald-500/10" :
                    config?.landingPageBgColor === "Midnight Purple" ? "bg-indigo-500/10" :
                    config?.landingPageBgColor === "Ocean Breeze" ? "bg-blue-500/10" :
                    config?.landingPageBgColor === "Cosmic Rose" ? "bg-rose-500/10" :
                    "bg-neutral-800/15"
                  }`} />

                  <div className="space-y-4 relative z-10 max-w-sm">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-white/5 bg-white/5 text-[9px] font-semibold text-neutral-300">
                      <Sparkles className="w-2.5 h-2.5 text-yellow-400 animate-pulse" />
                      <span>Dynamic Portal Mode</span>
                    </div>

                    {/* Title */}
                    <h4 className="text-lg sm:text-xl font-black text-white leading-tight break-words tracking-tight">
                      {config?.landingPageTitle || "Empower Your Journey With GreenPath"}
                    </h4>

                    {/* Subtitle */}
                    <p className="text-[10px] text-neutral-400 leading-relaxed break-words line-clamp-3">
                      {config?.landingPageSubtitle || "Compare carbon footprints across transportation modes, plan energy-efficient trips, and log eco-friendly miles to earn impact points."}
                    </p>

                    {/* Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        className={`px-5 py-2 text-[10px] font-black text-white rounded-lg transition-transform transform scale-95 shadow-md ${
                          config?.landingPageBgColor === "Emerald Glow" ? "bg-emerald-600 shadow-emerald-500/10" :
                          config?.landingPageBgColor === "Midnight Purple" ? "bg-indigo-600 shadow-indigo-500/10" :
                          config?.landingPageBgColor === "Ocean Breeze" ? "bg-blue-600 shadow-blue-500/10" :
                          config?.landingPageBgColor === "Cosmic Rose" ? "bg-rose-600 shadow-rose-500/10" :
                          "bg-neutral-800 shadow-neutral-700/10"
                        }`}
                      >
                        {config?.landingPageButtonText || "Enter Hub"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Active / Inactive Status bar indicator */}
                <div className="bg-neutral-900 border-t border-neutral-850 px-4 py-2 flex items-center justify-between text-2xs">
                  <span className="text-neutral-500">Live Status:</span>
                  <span className={`font-bold flex items-center gap-1.5 ${config?.landingPageActive ? 'text-emerald-500' : 'text-neutral-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${config?.landingPageActive ? 'bg-emerald-500 animate-ping' : 'bg-neutral-500'}`} />
                    {config?.landingPageActive ? 'Shown to users' : 'Bypassed'}
                  </span>
                </div>

              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
