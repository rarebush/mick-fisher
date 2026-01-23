import { useEffect, useRef } from "react";
import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import "./tension-bar.css";

function TensionBar() {
  // Zustand stores - read only
  const { dragState, isDragging } = useSessionStore();
  const { gamePhase, currentCast } = useGameStore();

  // Show during casting or dragging phases
  const isCasting = gamePhase === "casting";
  const isDragPhase = gamePhase === "dragging" && dragState.active;

  if (!isCasting && !isDragPhase) {
    return null;
  }

  // Use cast tension during casting, drag tension during dragging
  const tension = isCasting ? currentCast.tension : dragState.tension;
  const distance = isCasting ? currentCast.distance : dragState.distance;

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
      </div>

      <div className="drag-instruction">
        {isCasting && "Casting..."}
        {isDragPhase && (isDragging ? "Pulling..." : "Click to pull")}
      </div>

      <div className="tension-hint">
        {displayTension >= 85 && "⚠️ DANGER!"}
        {displayTension >= 60 && displayTension < 85 && "Careful"}
        {displayTension < 60 && ""}
      </div>
    </div>
  );
}

export default TensionBar;
