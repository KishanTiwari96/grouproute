# GroupRoute — Real-Time Group Travel & Location Intelligence Platform

GroupRoute is a production-grade full-stack platform for group road trips and convoy navigation. It transforms raw mobile GPS telemetry into real-time group travel intelligence:

- 🚗 **Live Convoy Tracking**: Real-time multi-member location sharing on interactive Google Maps / Vector Map.
- 🛑 **Intelligent Stop Detection**: Automatically detects stationary stops, reverse-geocodes the exact location name (e.g. *Murthal*), tracks stop duration, and records completed stop history.
- 📍 **Active Group Centroid**: Dynamically calculates the true geographic center of active travelers.
- ⚠ **Group Split & Fall-Behind Alerts**: Warns when a traveler falls behind or separates from the convoy (e.g. `Karan is 7.8 km behind the group`).
- 🟢 **Automatic Rejoin Detection**: Detects when a separated traveler catches up and returns within group radius without false GPS flapping.
- ⏱ **Clustered Group ETA & Individual ETAs**: Calculates individual destination ETAs and true whole-group arrival times.
- 📜 **Live Trip Timeline**: Chronological real-time travel feed of stops, separation alerts, and progress.
- 🎮 **Developer Simulation Mode**: Multi-agent interactive simulator (5 travelers on Delhi $\rightarrow$ Manali highway) to demonstrate all algorithms with zero physical devices.

---

## 1. System Architecture

```
USER DEVICES (Mobile / Desktop)
       │
       │ Geolocation API (Throttled 3.5s)
       ▼
React Client (TailwindCSS + Zustand)
       │
       │ Socket.IO + REST
       ▼
Node.js + Express Backend
       │
┌──────┴──────────────────────────┐
│   Location Intelligence Engine  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Stop Detector State Mach. │  │
│  ├───────────────────────────┤  │
│  │ Centroid & Haversine Dist │  │
│  ├───────────────────────────┤  │
│  │ Split / Rejoin Detector   │  │
│  ├───────────────────────────┤  │
│  │ Individual & Group ETA    │  │
│  └───────────────────────────┘  │
└──────┬────────────────────┬─────┘
       │                    │
       ▼                    ▼
Redis Real-Time State   PostgreSQL + PostGIS
(trip:tripId:locations) (Trips, Stops, Events)
       │                    │
       └────────┬───────────┘
                ▼
      Socket.IO Broadcast
                │
                ▼
     Live Google Maps Client
```

---

## 2. Location Intelligence Algorithms

### A. Moving vs. Stopped Detection
The system avoids false triggers from traffic lights by using a multi-condition state machine:
1. **Stationary Condition**: `speed < 3.0 km/h` AND spatial displacement `Δr < 50 meters` over a sliding coordinate window.
2. **State Transition**:
   - `0s - 45s`: `POSSIBLE_STOP` (low confidence / temporary pause).
   - `≥ 20s (dev) / 180s (prod)`: Transitions to `STOPPED`.
3. **Actions on Stop**:
   - Generates `STOP_STARTED` event with start timestamp.
   - Calls **Google Reverse Geocoding** (or localized high-precision highway gazetteer) to identify the place name (e.g. *"Murthal (Sukhdev Dhaba), Haryana"*).
   - Creates a pending entry in the `stops` database table.
4. **Movement Resumed**:
   - When `speed ≥ 5.0 km/h` and displacement `Δr > 75m`, state transitions back to `MOVING`.
   - Computes exact stop duration: `duration_seconds = ended_at - started_at`.
   - Generates `STOP_ENDED` event with duration details (e.g. *18 minutes*).

### B. Group Centroid & Distance Calculation
- Filters active members (excluding `location_sharing == false`, `status == OFFLINE`, or stale coordinates $> 3$ minutes old).
- Calculates geographic centroid $(\text{Lat}_c, \text{Lng}_c)$ using spherical coordinate averaging:
$$\text{Lat}_c = \frac{1}{N}\sum_{i=1}^N \text{lat}_i, \quad \text{Lng}_c = \frac{1}{N}\sum_{i=1}^N \text{lng}_i$$
- For each member $i$, computes great-circle distance $d(i, c)$ using the **Haversine formula**.

### C. Group Split & Falling Behind Detection
- Split Threshold $D_{\text{split}} = 5.0\text{ km}$.
- If $d(i, c) > D_{\text{split}}$:
  - State transitions to `SPLIT` / `FALLING_BEHIND`.
  - Broadcasts `MEMBER_FELL_BEHIND` and `GROUP_SPLIT` events with relative distance.
  - Highlights the trailing member on the map with visual separation vectors.

### D. Rejoin Detection
- Rejoin Threshold $D_{\text{rejoin}} = 2.0\text{ km}$.
- When a split member's distance reduces to $d(i, c) \le D_{\text{rejoin}}$ with hysteresis:
  - State transitions back to `MOVING` (or `REJOINED`).
  - Broadcasts `MEMBER_REJOINED` notification.
  - Updates the timeline.

### E. Individual and Group ETA Calculation
- **Individual ETA**: Calculates remaining road distance to trip destination divided by effective highway speed profile.
- **Group ETA**: Clustered 80th-percentile calculation across all active travelers to reflect realistic whole-group arrival.

---

## 3. Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, React Router v6, Zustand, Socket.IO Client, `@react-google-maps/api`.
- **Backend**: Node.js (ES Modules), Express.js, Socket.IO, Zod validation, JWT, bcryptjs.
- **Real-Time Cache**: Redis (with automatic in-memory high-speed cache fallback for zero-setup execution).
- **Database**: PostgreSQL with PostGIS schema migrations + robust local embedded store fallback.
- **Maps**: Google Maps JavaScript API + High-fidelity Interactive SVG Vector Map Visualizer.

---

## 4. Getting Started & Installation

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### 1. Install Dependencies
```bash
# Install root, backend, and frontend packages in one command
npm run install:all
```

### 2. Environment Variables

**Backend (`backend/.env`)**:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/grouproute
REDIS_URL=redis://localhost:6379
GOOGLE_MAPS_API_KEY=
USE_LOCAL_STORAGE_FALLBACK=true
STOP_DETECTION_TIME_MS=20000
SPLIT_DISTANCE_KM=5.0
REJOIN_DISTANCE_KM=2.0
```

**Frontend (`frontend/.env`)**:
```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_MAPS_API_KEY=
```

### 3. Run the Application
```bash
# Run both backend and frontend concurrently
npm run dev
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

### 4. Run Automated Intelligence Tests
```bash
npm test
```

---

## 5. Demonstration & Simulation Guide

GroupRoute comes with a built-in multi-agent simulation engine on the **Delhi $\rightarrow$ Manali** highway:

1. Log in with the 1-click demo button (**Rahul** or **Aman**).
2. Click **"Launch Delhi → Manali Demo Trip"** on the Dashboard.
3. On the live map screen, click **"Start Simulation"** in the bottom panel.
4. **Watch Live Telemetry**:
   - 5 simulated travelers will move along NH44.
   - Click **"Stop Aman at Murthal"**: Aman slows down to 0 km/h at Murthal. After 20 seconds, the system triggers `STOP_STARTED` with reverse-geocoded location `Murthal (Sukhdev Dhaba)`. Click **"Resume Aman"** to see `STOP_ENDED` and total stop duration.
   - Click **"Split Karan"**: Karan falls 7.8 km behind. The system emits `MEMBER_FELL_BEHIND` and draws a dashed amber separation vector on the map. Click **"Rejoin Karan"** to see `MEMBER_REJOINED`.
   - Speed multipliers: `1x`, `2x`, `5x`, `10x`.

---

## 6. REST API & Socket Event Reference

### Authentication
- `POST /api/auth/register` — Create account (`name`, `email`, `password`)
- `POST /api/auth/login` — Login (`email`, `password`)
- `GET /api/auth/me` — Current user profile

### Groups
- `GET /api/groups` — Get user groups
- `POST /api/groups` — Create group (returns auto-generated invite code)
- `POST /api/groups/join` — Join group via invite code
- `GET /api/groups/:groupId` — Group details and members
- `DELETE /api/groups/:groupId/members/:userId` — Remove member

### Trips
- `GET /api/trips/active` — Active trips
- `POST /api/trips` — Create trip
- `GET /api/trips/:tripId` — Full trip details, members, live locations, stops, events
- `POST /api/trips/:tripId/start` — Start trip (status $\rightarrow$ `ACTIVE`)
- `POST /api/trips/:tripId/end` — Complete trip (status $\rightarrow$ `COMPLETED`)
- `GET /api/trips/:tripId/timeline` — Chronological travel events
- `GET /api/trips/:tripId/stops` — Recorded stops
- `GET /api/trips/:tripId/locations` — Current live member locations

### Socket.IO Events
| Event Name | Direction | Description |
|---|---|---|
| `join_trip` | Client $\rightarrow$ Server | Joins real-time trip room |
| `leave_trip` | Client $\rightarrow$ Server | Leaves trip room |
| `location:update` | Client $\rightarrow$ Server | Sends GPS update |
| `location:sharing:start` | Client $\rightarrow$ Server | Enables location sharing |
| `location:sharing:stop` | Client $\rightarrow$ Server | Disables location sharing |
| `location:update` | Server $\rightarrow$ Client | Broadcasts updated member location |
| `locations:snapshot` | Server $\rightarrow$ Client | Snapshot of all active members |
| `trip:state` | Server $\rightarrow$ Client | Group centroid and group ETA update |
| `trip:event` | Server $\rightarrow$ Client | Generic timeline event |
| `stop:started` | Server $\rightarrow$ Client | Confirmed stop notification |
| `stop:ended` | Server $\rightarrow$ Client | Stop ended notification with duration |
| `member:behind` | Server $\rightarrow$ Client | Separation alert |
| `member:rejoined` | Server $\rightarrow$ Client | Rejoin notification |

---

## 7. License
MIT License.
