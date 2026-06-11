import axios from "axios";

// Create Axios instance with proxy base path
const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to automatically attach authorization header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("greenpath_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const authAPI = {
  signup: async (email, password, role = "USER") => {
    const response = await api.post("/auth/signup", { email, password, role });
    if (response.data.token) {
      localStorage.setItem("greenpath_token", response.data.token);
      localStorage.setItem("greenpath_user", JSON.stringify(response.data.user));
    }
    return response.data;
  },
  
  login: async (email, password) => {
    const response = await api.post("/auth/login", { email, password });
    if (response.data.token) {
      localStorage.setItem("greenpath_token", response.data.token);
      localStorage.setItem("greenpath_user", JSON.stringify(response.data.user));
    }
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem("greenpath_token");
    localStorage.removeItem("greenpath_user");
  },
  
  getCurrentUser: () => {
    const user = localStorage.getItem("greenpath_user");
    return user ? JSON.parse(user) : null;
  },

  getProfile: async () => {
    const response = await api.get("/auth/profile");
    return response.data;
  }
};

export const tripAPI = {
  compare: async (origin, destination, preferences = {}, batteryLevel = 100) => {
    const response = await api.post("/trip/compare", {
      origin,
      destination,
      userPreferences: preferences,
      batteryLevel,
    });
    return response.data;
  },
  
  save: async (tripData) => {
    const response = await api.post("/trip/save", tripData);
    return response.data;
  },
  
  getAll: async () => {
    const response = await api.get("/trip");
    return response.data;
  }
};

export const evAPI = {
  getAll: async () => {
    const response = await api.get("/ev");
    return response.data;
  },
  
  toggleStatus: async (id, isAvailable) => {
    const response = await api.post("/ev/status", { id, isAvailable });
    return response.data;
  }
};

export const adminAPI = {
  getAnalytics: async () => {
    const response = await api.get("/admin/analytics");
    return response.data;
  },

  getLiveMonitorData: async () => {
    const response = await api.get("/admin/live-monitor");
    return response.data;
  },
  
  updateStation: async (stationData) => {
    const response = await api.post("/admin/ev/update", stationData);
    return response.data;
  },

  getSystemConfig: async () => {
    const response = await api.get("/admin/config");
    return response.data;
  },

  updateSystemConfig: async (config) => {
    const response = await api.put("/admin/config", config);
    return response.data;
  },

  getGovernanceZones: async () => {
    const response = await api.get("/admin/governance");
    return response.data;
  },

  addGovernanceZone: async (zoneData) => {
    const response = await api.post("/admin/governance", zoneData);
    return response.data;
  },

  deleteGovernanceZone: async (id) => {
    const response = await api.delete(`/admin/governance/${id}`);
    return response.data;
  }
};

export const navigationAPI = {
  startNavigation: async (origin, destination, travelMode, userId = "anonymous") => {
    const response = await api.post("/navigation/start", {
      origin,
      destination,
      travelMode,
      userId,
    });
    return response.data;
  },

  updateLocation: async (userId, lat, lng, currentStepIndex) => {
    const response = await api.post("/navigation/update-location", {
      userId,
      lat,
      lng,
      currentStepIndex,
    });
    return response.data;
  },
};

export const userAPI = {
  getLiveDashboard: async () => {
    const response = await api.get("/user/dashboard");
    return response.data;
  },
  
  updatePreferences: async (preferences) => {
    const response = await api.put("/user/preferences", preferences);
    return response.data;
  },
  
  addEcoPointsLive: async (payload) => {
    const response = await api.post("/user/analytics/live", payload);
    return response.data;
  },

  getLandingConfig: async () => {
    const response = await api.get("/user/landing-config");
    return response.data;
  }
};

export const assistantAPI = {
  /**
   * Inject any platform event into the AI co-pilot engine.
   * @param {"NAV_DEVIATION"|"TURN_WARNING"|"STATION_STATUS_CHANGE"|"WEATHER_ALERT"} eventType
   * @param {object} payload
   * @param {string} [userId] — admin-only: target a different user
   */
  sendEvent: async (eventType, payload = {}, userId) => {
    const response = await api.post("/assistant/event", { eventType, payload, userId });
    return response.data;
  },

  /**
   * Fire a WEATHER_ALERT via the dedicated convenience endpoint.
   * @param {string}   condition      e.g. "Heavy Rain"
   * @param {string}   severity       "LOW" | "MEDIUM" | "HIGH" | "EXTREME"
   * @param {string[]} affectedModes  transport modes impacted
   * @param {string}   [location]     human-readable area name
   * @param {string}   [userId]       admin-only: target user
   */
  weatherAlert: async (condition, severity = "MEDIUM", affectedModes = [], location = "", userId) => {
    const response = await api.post("/assistant/weather-alert", {
      condition, severity, affectedModes, location, userId,
    });
    return response.data;
  },

  /** Check engine health and active WebSocket connection count. */
  health: async () => {
    const response = await api.get("/assistant/health");
    return response.data;
  },
};

export default api;
