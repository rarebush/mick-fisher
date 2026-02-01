import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import { TENSION_ZONES } from "../../game/physics/physicsSystem";
import "./tension-bar.css";

function TensionBar() {
  // Zustand stores - read only
  const { physicsState, isDragging, phase } = useSessionStore();
  const { currentCast, gamePhase } = useGameStore();

  // Show during cast phases and dragging
  const isCastPhase =
    phase === "cast" ||
    phase === "throwing" ||
    phase === "splashing" ||
    phase === "sinking" ||
    phase === "settling";
  const isDragPhase = gamePhase === "dragging";
  const isWaiting = gamePhase === "waiting";

  if (!isCastPhase && !isDragPhase && !isWaiting) {
    return null;
  }

  const tension = isCastPhase ? currentCast.tension : physicsState.tension;
  const distance = isCastPhase
    ? currentCast.distance
    : physicsState.distanceToShore || 0;
  const heatPercent =
    physicsState.heat && physicsState.heat > 0
      ? Math.min(1, physicsState.heat / 100)
      : 0;
  const shakeIntensity = heatPercent > 0 ? 1 + 4 * heatPercent : 0;
  const tensionZones = [
    { id: "low", value: TENSION_ZONES.LOW_MAX },
    { id: "working", value: TENSION_ZONES.WORKING_MAX },
  ];

  // Clamp tension for display only (actual value can exceed 100 to trigger failure)
  const displayTension = Math.max(0, Math.min(100, tension));

  // Color coding based on tension level
  let barColor = "#4CAF50"; // Green (safe)
  if (displayTension >= 85) {
    barColor = "#F44336"; // Red (danger)
  } else if (displayTension >= 70) {
    barColor = "#FF9800"; // Orange (warning)
  } else if (displayTension >= 50) {
    barColor = "#FFEB3B"; // Yellow (high)
  }

  return (
    <div className="tension-bar-container">
      <div
        className={`tension-bar-inner ${
          heatPercent > 0 ? "tension-bar-inner--shaking" : ""
        }`}
        style={{ "--shake-intensity": `${shakeIntensity}px` }}
      >
        <div className="drag-info">
          <div className="info-item">
            <span className="label">Dist</span>
            <span className="value">{distance.toFixed(1)}m</span>
          </div>
          <div className="info-item">
            <span className="label">Tension</span>
            <span className="value">{Math.round(displayTension)}%</span>
          </div>
        </div>

        <div className="tension-bar">
          <div
            className="tension-fill"
            style={{
              height: `${displayTension}%`,
              backgroundColor: barColor,
            }}
          />
          {tensionZones.map((zone) => (
            <div
              key={zone.id}
              className={`tension-zone-line tension-zone-line--${zone.id}`}
              style={{ bottom: `${zone.value}%` }}
            />
          ))}
        </div>

        {heatPercent > 0 && (
          <div className="overload-meter">
            <div className="overload-label">Heat</div>
            <div
              className={`overload-track ${
                heatPercent >= 0.8 ? "overload-track--danger" : ""
              }`}
            >
              <div
                className="overload-fill"
                style={{ width: `${Math.round(heatPercent * 100)}%` }}
              />
            </div>
            <div className="overload-value">
              {Math.round(heatPercent * 100)}%
            </div>
          </div>
        )}

        <div className="drag-instruction">
          {isCastPhase && "Casting..."}
          {isDragPhase && (isDragging ? "Pulling..." : "Click to pull")}
          {isWaiting && "Waiting for bite..."}
        </div>

        <div className="tension-hint">
          {displayTension >= 85 && "⚠️ DANGER!"}
          {displayTension >= 60 && displayTension < 85 && "Careful"}
          {displayTension < 60 && ""}
        </div>
      </div>
    </div>
  );
}

export default TensionBar;
