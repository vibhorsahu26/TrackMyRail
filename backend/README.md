# TrackMyRail local backend

1. Run `START_TRACKMYRAIL.bat` from the project root on Windows, or use the equivalent PowerShell script.
2. The backend listens on `0.0.0.0:5000` so a browser served from `:8080` can reach it.
3. The frontend automatically resolves the backend host from the page hostname.
4. `GET /health` checks connectivity and model status.
5. `GET /live-data` returns the local moving train feed.
6. `POST /reoptimize` returns a recommendation. Before a trained model is available, a deterministic heuristic keeps the control loop functional.

## Section simulation behavior

The frontend simulator uses two straight main lines with two simple junction branches. Trains do not wrap around the map: when a run exits the section it is removed, recorded as a completed departure, and a new calculated traffic arrival is spawned later. Initial and replacement traffic uses deterministic pseudo-randomness with spacing and junction constraints so the screen stays readable while still producing recurring merge conflicts for the ML right-of-way recommendation.

The browser-side KNN model scores conflicting trains using priority, current delay, predicted delay and junction distance. When the backend is connected, the existing `/reoptimize` endpoint is also asked for its recommendation on a detected junction conflict.
