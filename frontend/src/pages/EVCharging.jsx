import React, { useState, useEffect } from "react";
import { BatteryCharging, PlusCircle, ShieldAlert, BarChart3, Users, Leaf, Navigation } from "lucide-react";
import { evAPI, adminAPI, authAPI } from "../utils/api.js";
import MapView from "../components/MapView.jsx";

export default function EVCharging({ theme }) {
  const [stations, setStations] = useState([]);
  const [filterAvailable, setFilterAvailable] = useState(false);
  const [user, setUser] = useState(null);
  
  // Admin Analytics & Form States
  const [isAdmin, setIsAdmin] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  
  // Charger Form State
  const [stationName, setStationName] = useState("");
  const [latitude, setLatitude] = useState(47.6062);
  const [longitude, setLongitude] = useState(-122.3321);
  const [chargerType, setChargerType] = useState("DC Fast Charger");
  const [isAvailable, setIsAvailable] = useState(true);
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadStations = async () => {
    try {
      const data = await evAPI.getAll();
      setStations(data);
    } catch (err) {
      console.error("Error loading stations:", err);
      setError("Please login to view EV charging stations.");
    }
  };

  const loadAdminData = async () => {
    try {
      const data = await adminAPI.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error("Error loading analytics:", err);
    }
  };

  useEffect(() => {
    const currentUser = authAPI.getCurrentUser();
    setUser(currentUser);
    if (currentUser && currentUser.role === "ADMIN") {
      setIsAdmin(true);
    }
    loadStations();
  }, []);

  // Initial load of admin stats
  useEffect(() => {
    if (isAdmin) {
      setLoadingAnalytics(true);
      loadAdminData().finally(() => setLoadingAnalytics(false));
    }
  }, [isAdmin]);

  // Real-time polling updates every 4 seconds for chargers and admin metrics
  useEffect(() => {
    const interval = setInterval(() => {
      loadStations();
      if (isAdmin) {
        loadAdminData();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleToggleStatus = async (id, newStatus) => {
    try {
      await evAPI.toggleStatus(id, newStatus);
      // Refresh state immediately
      await loadStations();
      if (isAdmin) {
        await loadAdminData();
      }
    } catch (err) {
      console.error("Error toggling charger availability:", err);
      setError("Failed to update charger status.");
    }
  };

  const handleCreateStation = async (e) => {
    e.preventDefault();
    if (!stationName || !latitude || !longitude) {
      setError("Please fill in all station details.");
      return;
    }

    try {
      setError("");
      setSuccess("");
      await adminAPI.updateStation({
        name: stationName,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        chargerType,
        isAvailable
      });
      
      setSuccess("New charging station registered successfully!");
      setStationName("");
      // Refresh state immediately
      await loadStations();
      await loadAdminData();
    } catch (err) {
      console.error(err);
      setError("Failed to create charging station. Verify coordinates format.");
    }
  };

  const filteredStations = filterAvailable
    ? stations.filter(station => station.isAvailable)
    : stations;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 md:py-10 animate-fade-in space-y-8 transition-colors duration-200">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
            <BatteryCharging className="w-8 h-8 text-primary" />
            EV Charger Finder
          </h1>
          <p className="text-neutral-550 dark:text-neutral-400 text-sm mt-1">
            Locate active charging stations, toggle availability, and register new points.
          </p>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 p-1.5 rounded-lg transition-colors">
          <button
            onClick={() => setFilterAvailable(false)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              !filterAvailable ? "bg-primary text-white" : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            All Stations
          </button>
          <button
            onClick={() => setFilterAvailable(true)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              filterAvailable ? "bg-primary text-white" : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            Available Only
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-xl">
          {success}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Control Panel */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          
          {/* Station List Card */}
          <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 flex flex-col max-h-[400px] transition-colors">
            <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-300 mb-4 flex items-center gap-1.5">
              Chargers Index ({filteredStations.length})
            </h3>
            
            <div className="overflow-y-auto space-y-3 flex-grow pr-1">
              {filteredStations.length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-8">No matching charging hubs found.</p>
              ) : (
                filteredStations.map((station) => (
                  <div
                    key={station.id}
                    className="p-3 bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 rounded-lg flex justify-between items-center transition-all"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-white">{station.name}</h4>
                      <p className="text-3xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-medium">
                        {station.chargerType} | [{Number(station.latitude).toFixed(4)}, {Number(station.longitude).toFixed(4)}]
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleStatus(station.id, !station.isAvailable)}
                      className={`px-2 py-1 text-3xs font-semibold rounded-md border transition-all ${
                        station.isAvailable
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                      }`}
                    >
                      {station.isAvailable ? "Available" : "Occupied"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Admin Panel (If user.role === 'ADMIN') */}
          {isAdmin && (
            <div className="space-y-6">
              
              {/* Analytics dashboard */}
              <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900 space-y-4 shadow-lg transition-colors">
                <h3 className="text-sm font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                  <BarChart3 className="w-4 h-4" />
                  System Metrics (Admin Only)
                </h3>

                {loadingAnalytics ? (
                  <div className="h-20 bg-neutral-100 dark:bg-neutral-900/40 rounded-lg animate-pulse"></div>
                ) : analytics ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white dark:bg-neutral-900/80 rounded-lg border border-neutral-200 dark:border-neutral-800 transition-colors">
                      <span className="text-3xs text-neutral-500 dark:text-neutral-400 block uppercase font-semibold">Total Users</span>
                      <span className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-1 mt-0.5">
                        <Users className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                        {analytics.analytics.totalUsers}
                      </span>
                    </div>
                    <div className="p-3 bg-white dark:bg-neutral-900/80 rounded-lg border border-neutral-200 dark:border-neutral-800 transition-colors">
                      <span className="text-3xs text-neutral-500 dark:text-neutral-400 block uppercase font-semibold">Trips Planned</span>
                      <span className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-1 mt-0.5">
                        <Navigation className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                        {analytics.analytics.totalTrips}
                      </span>
                    </div>
                    <div className="p-3 bg-white dark:bg-neutral-900/80 rounded-lg border border-neutral-200 dark:border-neutral-800 transition-colors">
                      <span className="text-3xs text-neutral-500 dark:text-neutral-400 block uppercase font-semibold">Total CO₂ Saved</span>
                      <span className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-1 mt-0.5">
                        <Leaf className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                        {analytics.analytics.totalCO2Saved} kg
                      </span>
                    </div>
                    <div className="p-3 bg-white dark:bg-neutral-900/80 rounded-lg border border-neutral-200 dark:border-neutral-800 transition-colors">
                      <span className="text-3xs text-neutral-500 dark:text-neutral-400 block uppercase font-semibold">Available Chargers</span>
                      <span className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-1 mt-0.5">
                        <BatteryCharging className="w-4 h-4 text-primary" />
                        {analytics.analytics.availableStations} / {analytics.analytics.totalStations}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Station Creator form */}
              <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 space-y-4 transition-colors">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <PlusCircle className="w-4.5 h-4.5 text-primary" />
                  Register New Charging Station
                </h3>
                
                <form onSubmit={handleCreateStation} className="space-y-3.5">
                  <div>
                    <label className="block text-2xs text-neutral-500 dark:text-neutral-400 mb-1 font-semibold">Station Hub Name</label>
                    <input
                      type="text"
                      value={stationName}
                      onChange={(e) => setStationName(e.target.value)}
                      placeholder="e.g. Westlake Plaza Chargers"
                      className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg py-1.5 px-3 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs text-neutral-500 dark:text-neutral-400 mb-1 font-semibold">Latitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        placeholder="47.6062"
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg py-1.5 px-3 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-2xs text-neutral-500 dark:text-neutral-400 mb-1 font-semibold">Longitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        placeholder="-122.3321"
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg py-1.5 px-3 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs text-neutral-500 dark:text-neutral-400 mb-1 font-semibold">Charger Style</label>
                      <select
                        value={chargerType}
                        onChange={(e) => setChargerType(e.target.value)}
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg py-1.5 px-3 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="DC Fast Charger">DC Fast Charger</option>
                        <option value="Level 2 Charger">Level 2 Charger</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-2xs text-neutral-500 dark:text-neutral-400 mb-1 font-semibold">Initial Status</label>
                      <select
                        value={isAvailable ? "yes" : "no"}
                        onChange={(e) => setIsAvailable(e.target.value === "yes")}
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg py-1.5 px-3 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="yes">Available</option>
                        <option value="no">Occupied</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-primary hover:bg-emerald-600 text-white font-semibold rounded-lg text-xs transition-all shadow-sm"
                  >
                    Add Charging Hub
                  </button>
                </form>
              </div>

            </div>
          )}

        </div>

        {/* Right Map Panel */}
        <div className="lg:col-span-7 h-[450px] lg:h-auto min-h-[500px] flex flex-col">
          <MapView
            startCoords={null}
            endCoords={null}
            routeGeometry={null}
            nearbyStations={filteredStations}
            onToggleStation={handleToggleStatus}
            theme={theme}
          />
        </div>

      </div>
    </div>
  );
}
