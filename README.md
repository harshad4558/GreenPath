# GreenPath: Sustainable Transit Hub & Route Planner 🍃

GreenPath is a comprehensive, modern web platform designed to promote eco-friendly transportation and reduce carbon footprints. Unlike standard navigation tools that prioritize only travel speed, GreenPath uses a multi-criteria optimization formula balancing **Carbon Emissions**, **Time**, and **Cost**. It gamifies sustainability by tracking user impact, providing live AI-driven alerts, and dynamically adjusting routes based on real-world constraints.

---

## 🌟 Key Features

### 1. Multi-Criteria Eco-Routing
*   **Intelligent Pathing**: Computes optimal routes taking into account vehicle type, EV charging availability, public transit fares, and exact carbon (CO₂) footprints.
*   **Configurable Weights**: Administrators can globally alter the weights of CO₂, Time, Cost, and EV Bias on the fly. 

### 2. Gamification & Eco-Leaderboard
*   **Eco-Points**: Users earn points for making sustainable choices (like choosing to bike instead of drive).
*   **Global Leaderboard**: A real-time ranking system rewarding the most eco-conscious travelers with dynamic trophy tiers.

### 3. Real-Time AI Mobility Co-Pilot
*   **Persistent WebSockets**: Connects every user directly to the backend (`Socket.io`) across the entire app.
*   **Live Event Feed**: Uses geolocation to track navigation and pushes context-aware dynamic alerts (like severe weather warnings, traffic changes, or safety zone alerts) directly to an overlay panel on the user's screen.

### 4. Dynamic Route Governance
*   **Spatial Restrictions**: Administrators can draw GeoJSON bounding boxes (e.g., "Cycling Only Zones" or "Temporary Roadblocks") and instantly deploy them. The AI Copilot engine ensures no navigator breaches restricted geometry.

### 5. Advanced Admin Dashboard
*   **Analytics Hub**: High-fidelity UI featuring dynamic KPI cards and interactive SVG data charts (CO₂ Savings Trend & EV Node Availability).
*   **Portal Configurator**: Let admins brand the landing page instantly through a live-rendering mock device view.

---

## 🛠 Tech Stack

*   **Frontend**: React, Vite, Tailwind CSS, Lucide-React.
*   **Backend**: Node.js, Express, Socket.io (WebSocket Engine).
*   **Database**: PostgreSQL, connected via TypeORM.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   PostgreSQL database running locally or via cloud

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd sustainable-transport-hub
   ```

2. **Setup Backend:**
   ```bash
   cd backend
   npm install
   # Configure your .env file with your PostgreSQL connection string
   npm run dev
   ```

3. **Setup Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the application:**
   Open `http://localhost:5173` (or the port Vite provides) in your browser.
   *Demo Admin Account*: `admin@greenpath.com` / `password123`

---

*Let's build a greener future, one route at a time!*
