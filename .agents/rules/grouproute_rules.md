# GROUPROUTE PROJECT RULES + PERMANENT DEVELOPMENT INSTRUCTIONS

## ⚠️ IMPORTANT: PERMANENT RULES

You are working on **GroupRoute**, a student full-stack project for real-time group travel and location intelligence.

These are **PERMANENT PROJECT RULES**.
They apply to **EVERY future change** made to this project.
They must be followed when:
* fixing bugs
* adding features
* modifying features
* changing UI
* changing APIs
* changing database models
* changing authentication
* changing Google Maps integration
* changing real-time location tracking
* changing Socket.IO
* changing location detection
* changing stop detection
* changing group split detection
* changing ETA logic
* refactoring
* optimizing
* installing dependencies
* modifying configuration

Before making ANY change, read and follow these rules.

---

# 1. CORE PRIORITIES

Always prioritize:
- **WORKING PRODUCT > COMPLEX ARCHITECTURE**
- **CORRECTNESS > CLEVERNESS**
- **REAL DATA > FAKE DATA**
- **SIMPLE CODE > ENTERPRISE-LOOKING CODE**
- **REUSE > DUPLICATION**
- **SMALL CHANGE > LARGE REFACTOR**
- **EXPLAINABLE > IMPRESSIVE-LOOKING**
- **STABILITY > NEW FEATURES**

This is a student project. The owner must be able to understand and confidently explain the implementation during software engineering interviews. Do not introduce complexity simply to make the project look more professional.

---

# 2. BEFORE EVERY CHANGE

Before modifying anything:
1. **Classify the task**: Bug Fix, Existing Feature Modification, New Feature, Refactor, UI Change, Database Change, API Change, Configuration Change, Dependency Change.
2. **Inspect existing code**: Inspect project structure, related components, services, APIs, database models, auth, Socket.IO, Google Maps, location tracking, state management, utilities, tests.
3. **Search before creating**: Before creating a new component, hook, utility, service, controller, route, model, API, calculation, helper, Socket.IO event, or map function, search the project for existing implementations. Reuse or modify existing code.

---

# 3. EXPLAIN BEFORE CODING

Before making changes, briefly explain:
1. What is being changed?
2. What existing code is relevant?
3. What files need to change?
4. Why is this the simplest safe approach?

Keep the explanation short, then implement.

---

# 4. MINIMUM CODE PRINCIPLE

Write the minimum code required to solve the requested problem. Do NOT add speculative architecture, unused helpers, unnecessary abstractions, unnecessary interfaces, or future-proofing that is not required.

---

# 5. NO DUPLICATE SYSTEMS

There must be one source of truth for each important responsibility:
- Auth & JWT
- User location tracking
- Socket.IO connection management
- Trip state & member status
- Stop & split detection
- Distance & ETA calculation
- Google Maps & API client
- Database logic

---

# 6. NO DEAD CODE

After every change, check for and remove:
- Unused imports, variables, functions, components, routes, services
- Commented-out old implementations
- Duplicate implementations & temporary debug code

---

# 7. FUNCTION RESPONSIBILITY

Keep functions simple and focused. Every major function should be explainable in one sentence.

---

# 8. NO SPECULATIVE ARCHITECTURE

Do not introduce repositories, factories, adapters, facades, event buses, or unnecessary abstraction layers unless the existing project genuinely requires them.

---

# 9. EXISTING CODE MUST BE PRESERVED

Before modifying an existing function, determine callers, return values, inputs, API dependencies, DB fields, and frontend dependencies. Do not break working behavior.

---

# 10. STABILIZATION MODE

If ANY existing functionality is broken:
**STOP FEATURE DEVELOPMENT → ENTER STABILIZATION MODE**
1. Reproduce the issue.
2. Identify the exact failure.
3. Trace the dependency.
4. Identify root cause.
5. Make the smallest safe fix.
6. Test fix and affected functionality.
7. Only then continue development.

---

# 11. REAL DATA ONLY

Never fabricate user locations, movement status, stop locations/durations, group distance, split events, rejoin events, ETA, or analytics. If data is unavailable, display `"Location unavailable"` or `"ETA unavailable"`.

---

# 12. SIMULATION MODE

Development-only simulation mode is allowed for demonstrations. Simulated data MUST be clearly identified as **DEMO / SIMULATION** and never mixed with real production data.

---

# 13. GOOGLE MAPS RULES

Use Google Maps Platform for map, markers, routes, geocoding, reverse geocoding, directions, and ETA. Keep API keys in environment variables. If Google Maps is unavailable, show a clear setup guide / error rather than silent fake map data.

---

# 14. LOCATION TRACKING & FREQUENCY

- Track: `latitude`, `longitude`, `accuracy`, `speed`, `heading`, `timestamp`.
- Broadcast frequency: approximately every 3 to 5 seconds while actively moving.
- Reduce frequency when stationary to conserve battery.

---

# 15. REAL-TIME SOCKET ARCHITECTURE & SECURITY

- Single real-time system with Socket.IO.
- Authenticate socket connection.
- Verify trip membership before processing coordinates.
- Room isolation: `trip:{tripId}`. Never broadcast globally.

---

# 16. LOCATION PRIVACY & STALENESS

- **Location Sharing Toggle**: ON / OFF. When OFF, stop broadcasting and storing.
- When trip ends, automatically terminate location sharing.
- **Staleness**: If last update $> 2\text{-}3$ min old, mark as `STALE` (`Last seen X min ago`).
- **GPS Accuracy**: Accuracy $> 100\text{m}$ marked low confidence; avoid false stops/splits.

---

# 17. STOP DETECTION ENGINE

- Condition: `speed < 3 km/h` AND spatial radius displacement $< 50\text{m}$ persisting $\ge 20\text{s}$ (dev) / $3\text{ min}$ (prod).
- State: `MOVING` $\rightarrow$ `POSSIBLE_STOP` $\rightarrow$ `STOPPED`.
- Stop start: Emit `STOP_STARTED`, reverse geocode coordinates (e.g. *Murthal*), record in `stops` table.
- Movement resumed (`speed ≥ 5 km/h`): Emit `STOP_ENDED`, compute duration (`ended_at - started_at`).

---

# 18. GROUP CENTROID, SPLIT & REJOIN DETECTION

- **Centroid**: Dynamic geographic center of active, fresh, sharing members.
- **Distance**: Haversine distance $d(i, c)$ from centroid.
- **Split Detection**: $d(i, c) > 5.0\text{ km}$ persisting $\rightarrow$ `POSSIBLE_SPLIT` $\rightarrow$ `SPLIT` / `MEMBER_FELL_BEHIND`.
- **Rejoin Detection**: When distance reduces to $\le 2.0\text{ km}$ $\rightarrow$ `MEMBER_REJOINED` (with debounce against GPS noise).

---

# 19. INDIVIDUAL & GROUP ETA

- Individual ETA = Route distance to destination / speed profile.
- Group ETA = Clustered 80th-percentile arrival time of convoy.
- Clearly label Individual vs Group ETA.

---

# 20. TRIP TIMELINE

Real-time chronological events (`TRIP_STARTED`, `MEMBER_JOINED`, `STOP_STARTED`, `STOP_ENDED`, `MEMBER_FELL_BEHIND`, `GROUP_SPLIT`, `MEMBER_REJOINED`, `TRIP_COMPLETED`).

---

# 21. DATABASE & API CONTRACT RULES

- Inspect DB models before changing.
- Preserve endpoint paths, HTTP methods, request/response formats, and status codes.
- Validate inputs with schemas (Zod).

---

# 22. FINAL TASK REPORTING TEMPLATE

After EVERY future development task, report:
1. **Task Type**: Bug Fix / Existing Feature / New Feature / Refactor / UI / API / Database / Config
2. **Files Modified** & **Files Created** (with rationale)
3. **Existing Code Reused**
4. **Core Behavior Changed**
5. **API & Database Changes**
6. **Real-Time Changes**
7. **Tests Performed** (actual automated & functional tests)
8. **Build Result**
9. **Known Issues / Edge Cases**

---

# 23. HIGHEST-PRIORITY RULE

**STOP → UNDERSTAND → INSPECT → REUSE → IMPLEMENT → TEST → VERIFY**
