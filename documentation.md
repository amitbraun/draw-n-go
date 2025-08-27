# Draw & Go

## Purpose

Draw & Go is a mobile app that gamifies physical activity by transforming real-world movement into collaborative digital art. A "Painter" defines a target pattern or shape, and "Runners" physically move — jogging or walking — to replicate the shape using GPS tracking. The app encourages creativity, teamwork, and physical exercise, blending fitness with location-based interaction.

## Target Users

- Casual joggers and walkers seeking motivation
- Friends, couples, or families looking for a fun outdoor challenge
- Fitness enthusiasts who enjoy goal-oriented tracking
- Schools or community groups running collaborative health initiatives
- Urban gamers interested in location-based social play

## Platform

Web using React Native. Azure is used for backend services including:

- Azure Table Storage for user data and in-game data and statistics
- Azure Function Apps for serverless backend logic

## Core Building Blocks

### Templates

Predefined shapes or paths (e.g., circle, star, square) that players are challenged to replicate on the map. Templates determine the goal shape for each game. Templates have a difficulty multiplier for later score calculation.

### Session

A persistent game container acting like a "waiting room." Users can join a session and chat or wait. One user (the admin) starts games within the session. The session holds a shared coordinate (latitude and longitude), which is used to anchor all drawings on the map. This coordinate can be set or updated by the admin either before the first game or between games while users are in the waiting room. When a game ends, users return to the session and may start a new round.

### Game

A single round of drawing. The game includes:

- A selected template
- A set of players
- One player designated as Painter (who sees the template and all runners' trails)
- Multiple Brushes (who follow blindly the Painter's instructions)
- A shared coordinate that anchors the drawing on the map, set by the admin

The Painter decides when the game ends based on the quality and speed of the drawing. The goal is to draw the selected template as accurately and quickly as possible using live GPS trails.

### Drawing

The final product of a game, containing:

- The chosen template
- The trails of all Runners
- Total duration of the game
- Score

## Data Model: Azure Tables

This project uses Azure Table Storage. Each table row has PartitionKey and RowKey. Below are the actual tables and fields used in code.

### Templates

- PartitionKey: "template"
- RowKey: templateId (string)
- displayName: string
- baseVertices: JSON string of [{ x, y }] (normalized shape)
- isCustom: boolean
- multiplier: number

### Sessions

- PartitionKey: "session"
- RowKey: sessionId (string)
- creator: string (admin username)
- users: JSON string array of usernames
- readyStatus: JSON string object { username: boolean }
- isStarted: boolean
- currentGameId: string | null
- isTemplateSet: boolean
- templateId: string
- templateCenter: JSON string of { latitude, longitude } (or { lat, lng })
- templateRadiusMeters: number
- templateZoom: number (optional)
- templateVertices: JSON string array of { lat, lng } (materialized vertices)
- roles: JSON string object { username: "Painter" | "Brush" }
- painter: string (username)
- defaultCenter: JSON string of { latitude, longitude } (optional)

### Games

- PartitionKey: "game"
- RowKey: gameId (string)
- sessionId: string
- players: JSON string array of usernames
- roles: JSON string object { username: role }
- timeStarted: ISO 8601 string
- status: "in progress" | "completed"
- timeCompleted: ISO 8601 string (on end)
- results: JSON string (optional)
- teamAccuracy: number (optional)
- teamF1: number (optional)
- shape: string (placeholder)

### Scores

Used for high-scores and player history; one row per completed game.

- PartitionKey: "score"
- RowKey: gameId (string)
- gameId: string
- sessionId: string
- timeCompleted: ISO 8601 string
- timePlayedSec: number (optional)
- templateId: string
- templateCenter: JSON string of { latitude, longitude }
- templateRadiusMeters: number
- templateZoom: number (optional)
- templateVertices: JSON string array of { lat, lng }
- finalScore: number (optional)
- totalAccuracy: number (optional)
- players: JSON string array of { username, role, accuracy? }
- hasDrawing: boolean (optional)
- drawing: JSON string { trails: { username: [ { latitude, longitude } ] } } (optional, compact)
- templateName: string (optional)

### Distances

Stores the latest location and cumulative distance per user per game.

- PartitionKey: gameId (string)
- RowKey: username (string)
- location: JSON string { latitude, longitude, timestamp }
- totalDistance: number (meters)
- seq: number (monotonic counter)
- lastUpdated: ISO 8601 string

### Users

- PartitionKey: "user"
- RowKey: username (string)
- Password: string (SHA-256 hex)

## Flows & Processes

### User Onboarding

Handles authentication, permission granting, and initial navigation.

### Session Lifecycle

- Creating a session
- Setting/changing the target template
- Managing lobby status

### Game Lifecycle

- Starting a game
- Assigning roles
- Rendering the template and tracking movement
- Ending a game and transitioning back to session

### Real-Time Tracking

- Receiving and storing GPS coordinates (Distances table holds the latest point and cumulative distance per user per game)
- Painter/clients poll getLocations to display current positions
- Managing disconnects or location errors

### Scoring Logic & High Scores

- Accuracy of trails compared to the template
- Time taken
- Difficulty of the template
- Team size
- Composite scoring method

### Template Management

- Creating new template
- Editing existing ones
- Session specific templates ("Polygon")

## User Onboarding

Authenticate or sign up the user, ensure necessary permissions are granted, initialize their profile, and route them to the appropriate first screen.

1. **App Launch**
  - Display splash screen.
  - On the entrance screen the current weather forecast, provided by OpenWeather API, is displayed based on the user location.

2. **Sign Up / Login**
  - If no token:
    - Present the option to log in or sign up.
    - For sign-up: collect username, password, display name; validate that username is unique among active users; hash and store credentials in Azure Table Storage.
    - For login: collect username and password; validate against Azure records.
  - If token is valid: auto-login.

3. **Permissions**
  - Request location access (foreground and background).

4. **Profile Initialization**
  - Fetch or create a user profile.
  - Set default values if new users (e.g., avatar color, nickname, preferences).

5. **Navigation & Session Routing**
  - If the user is in an active session: redirect to session lobby.
  - If no session: direct to "Create or Join Session" screen.

**Edge Cases:**

- Failed sign-up/login (e.g., username in use, wrong password): show error message and retry prompt.

## Game Lifecycle

### Starting a Game

After logging in, a user can create or join a session. The creator becomes the Admin. To join an existing session, the user can enter the session auto-generated UUID, or the name of the admin of the desired session.

**Admin view in waiting room:**

- A map centered on the admin's current location is displayed, always fixed north-up.
- In the top-right corner, a dropdown lists available templates from the Templates table.
  - A player can choose to create a new template from scratch. This template won't be saved after the session ends.
- When a template is selected:
  - The shape appears on the map as semi-transparent lines.
  - The admin can pinch to change the radius (scale) and drag the shape to set its center coordinate.
  - Rotation and tilt are disabled; the template always remains aligned north-up.
- The admin's goal is to set the middle point and radius so the shape is correctly placed and scaled for the game.
- Once confirmed, the chosen template, center, and radius are stored and locked for the round.
- All other players' maps update to display the same shape, middle point, and radius in the same fixed orientation.
- The game can only start once all players are Ready, and the shape on the map is Set.
  - The player usernames and current status are shown in the waiting room.

**Non-admin players in waiting room:**

- See the map with the template, center, and radius as set by the admin.
- Cannot move or resize the template.

### Assigning Roles

- One player is designated as Painter (Brush).
  - This can be done at random, or by choosing a specific player. The mechanism is set by the session admin.
- All other active participants are Runners.
- Roles are stored on the session/game entities (roles JSON). Player colors are assigned client‑side for display only.

**Painter view:**

- Sees the template overlay in the fixed position and scale.
- Sees the full trails of all Runners, built from their polled location points (rendered as colored polylines).
- A marker indicating each Runner's latest point.
- The time passed since the game started.

**Brush view:**

- Sends location updates in the background. The UI shows only the elapsed time.

### Rendering the Template and Tracking Movement

- All maps are fixed north-up; rotation and tilt are disabled.
- At game start, GPS tracking begins for all participants.
  - Runners send location updates to the server at a regular interval and after movement.
  - The server stores only the latest location per user and a cumulative totalDistance in the Distances table.
  - The Painter polls getLocations and reconstructs each Runner's trail locally from successive latest points, drawing colored polylines client-side.

### Game end

- When the Painter or the Admin decides, they press "End Game".
- Each player will see the score breakdown of the game on their screen, and then will be moved back to the session waiting room screen.

### Session end

- When the Admin decides, they press "End Session" — this terminates the session for all players and returns them to the Create Session screen.

## Real-Time Tracking

During the game, the system tracks and displays the trails of the players.

- Receiving and storing GPS coordinates
- Painter polling of getLocations to fetch latest positions
- Managing disconnects or location errors

## Scoring Process

The scoring mechanism evaluates the game outcome. The shape referred to here is the combination of the chosen template, its size, and its fixed placement on the map.

1) Accuracy against the shape (numeric)
  - We sample the template boundary and player trails in meters (2 m spacing) and use a tolerance that scales with size: max(3 m, min(6% of radius, 10 m)).
  - Coverage = fraction of template samples close to any trail; Precision = fraction of trail samples close to the template.
  - accuracyPct = round(F1(Coverage, Precision) × 100).
  - adjustedPct = round((Coverage × Precision) × 100). This “completion-corrected” accuracy drives points.

2) Base points from accuracy
  - Let B = adjustedPct (0..100).
  - Base points P0 = 12 × B. This converts percent accuracy to a base score band (0..1200).

3) Multipliers (applied multiplicatively)
  - Difficulty: template.multiplier if set; otherwise defaults by shape: polygon/catch‑all 1.0, circle 1.05, triangle 1.15, square 1.30, star 1.60.
  - Size (radiusMeters): radiusFactor = clamp(radiusMeters / 100, 0.8, 1.5). Example: 50 m → 0.8, 100 m → 1.0, 150 m+ → 1.5.
  - Team size: teamFactor = 1 + log10(teamSize). Adds diminishing returns as more Brushes contribute.
  - Time: timeFactor = clamp(90 / max(30, timeSeconds), 0.8, 1.2). Faster rounds slightly boost; very short/long rounds are bounded.

4) Final score (stored as Scores.finalScore)
  - points = round(P0 × difficulty × radiusFactor × teamFactor × timeFactor).

Notes
- accuracyPct and adjustedPct are also returned for display; the server persists team adjustedPct as totalAccuracy when provided, and the computed points as finalScore.

Scores are presented at the end of each game and are also accessible through the user portal (via the user icon on the top left, or the high-scores tab). You can filter your high scores by different parameters.

## Template Management

The system supports a structured approach to managing templates, which serve as the foundation for trails and scoring.

1. **Creating New Templates**
  - An admin can create new templates by setting points on the map that define the shape, difficulty multiplier, and name.
2. **Editing Existing Templates**
  - Multipliers and display names can be edited for any template via UpdateTemplate. Core templates (circle, square, star, triangle) cannot be deleted. Custom templates (isCustom=true) can be deleted via DeleteTemplate.
3. **Session-Specific Templates**
  - You can draw and save a new custom template in-app (web) using NewTemplateCreator, then select and set it in the waiting room. When a game ends, a snapshot of the selected template (center, radius, zoom, vertices) is stored in Scores for historical rendering.

### Session Template Setup

- Admin selects a template and configures center, radius, and zoom; backend materializes concrete vertices for all shapes to the session so clients can render without re-fetching the catalog.
- The isTemplateSet flag locks the chosen template for the round; admin may toggle/reset prior to start.

## Functions

### CreateSession (POST)
- Creates a new row in Sessions with a fresh UUID sessionId.
- Persists: creator username, users array initialized with creator, readyStatus map (creator: false), isStarted=false, currentGameId=null.
- Returns the new sessionId.

### JoinSession (GET/POST)
- GET: Returns a session snapshot: users, readyStatus, roles, painter, template (if set), defaultCenter, and state flags.
- POST operations (require x-username header):
  - Join: adds user to users list and initializes readyStatus[user]=false.
  - Ready toggle: sets readyStatus[user] to true/false.
  - Leave: removes user; deletes session if admin leaves or last user leaves.
  - setDefaultCenter (admin only): stores a default map center.
  - setTemplate (admin only): stores templateId, center, radius, zoom and materializes concrete vertices into session:
    - For polygon: accepts client-provided vertices.
    - For catalog shapes: fetches baseVertices (normalized x,y) and scales to lat/lng using dLat=radius/111320 and dLng=radius/(111320*cos(lat)).
    - If polygon center missing but vertices exist, computes centroid as fallback.
  - templateSet toggle (admin only): updates isTemplateSet flag.

### StartGame (POST)
- Start: validates session is not started, picks painter (requested or random), sets roles map (Painter/Brush), creates a Games entity (status "in progress"), and updates the Session (isStarted, currentGameId, roles, painter).
- End (endGame=true):
  - Loads current game, attaches optional results payload, and stamps completion time.
  - Builds a Scores row (one per game) with timePlayedSec (from timeStarted to timeCompleted), template snapshot (center, radius, zoom, vertices), finalScore and totalAccuracy from results.team if provided.
  - Players summary: merges roles with per-user adjustedPct (Brushes only) into a players array.
  - Resets session state (isStarted=false, clears currentGameId/roles/painter).

### sendLocation (POST)
- Upserts the latest location per (gameId, username) in the Distances table with cumulative totalDistance.
- Uses haversine to compute segment delta between previous and current point; ignores jitter below 0.5m.
- Maintains a monotonically increasing seq and lastUpdated timestamp for ordering/debugging.

### getLocations (GET)
- Queries Distances by PartitionKey=gameId and returns an array [{ username, latitude, longitude, timestamp, totalDistance }].
- Parses numeric fields defensively; returns an empty list on errors.

### GetTemplates (GET)
- Returns the templates catalog (PartitionKey=='template').
- Passes through baseVertices (normalized x,y) if stored as JSON string or array.
- Supplies a multiplier per template: uses stored value if valid; otherwise sensible defaults by shape (star 1.6, square 1.3, triangle 1.15, circle 1.05, polygon 1.0).

### CreateTemplate (POST)
- Validates templateId with a conservative regex and baseVertices shape (array of {x,y} with length ≥3).
- Accepts multiplier (supports comma or dot decimals); falls back to 1.0 when absent/invalid.
- Stores displayName (capitalized id), baseVertices as JSON, isCustom=true, and multiplier.

### UpdateTemplate (POST)
- Updates multiplier (validated float) and/or displayName for an existing template.
- Merges changes into the Templates row.

### DeleteTemplate (DELETE)
- Deletes a template only if it is custom (isCustom=true).
- Protects core templates (circle, square, star, triangle) from deletion.

### GetHighScores (GET)
- Lists scores (PartitionKey=='score') with optional templateId filter.
- Expands players JSON and template names.
- Sorts strictly by finalScore descending (missing scores sort last) and paginates (page/pageSize bounds enforced).

### GetPlayerGames (GET)
- Returns paged game history for a username by scanning Scores rows and selecting entries where players[] contains that username.
- Includes role and individual accuracy (for Brushes) and normalized date strings.
- Sorts by timeCompleted descending.

### login (POST)
- Authenticates against Users table by hashing the provided password with SHA‑256 and comparing to stored Password hash.
- Returns 200 on success, 401 for wrong password, 404 if user not found.

### signUp (POST)
- Creates a new Users row with SHA‑256 hashed password if username doesn’t already exist.
- Returns 201 on success; 409 if username is taken.
