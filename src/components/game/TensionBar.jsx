import { useEffect, useRef } from "react";
import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import {
  DRAG_TENSION_PULL_THRESHOLD,
  OVERLOAD_FAIL_SECONDS,
} from "../../game/mechanics/dragMechanics";
import "./tension-bar.css";

function TensionBar() {
  // Zustand stores - read only
  const { dragState, isDragging, ropeTension, phase } = useSessionStore();
  const { currentCast } = useGameStore();

  // Show during cast phases and dragging
  const isCastPhase =
    phase === "cast" ||
    phase === "throwing" ||
    phase === "splashing" ||
    phase === "sinking" ||
    phase === "settling";
  const isDragPhase = phase === "drag" && dragState.active;

  if (!isCastPhase && !isDragPhase) {
    return null;
  }

  // Single source of truth for tension
  const tension = ropeTension;
  const distance = isCastPhase ? currentCast.distance : dragState.distance;
  const overloadTimer = dragState.overloadTimer || 0;
  const overloadProgress =
    OVERLOAD_FAIL_SECONDS > 0
      ? Math.min(1, overloadTimer / OVERLOAD_FAIL_SECONDS)
      : 0;
  const shakeIntensity = overloadProgress > 0 ? 1 + 4 * overloadProgress : 0;
  const pullThreshold = Math.max(0, Math.min(100, DRAG_TENSION_PULL_THRESHOLD));

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
          overloadProgress > 0 ? "tension-bar-inner--shaking" : ""
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
          {isDragPhase && (
            <div
              className="tension-threshold-line"
              style={{ bottom: `${pullThreshold}%` }}
            />
          )}
        </div>

        {isDragPhase && (
          <div className="overload-meter">
            <div className="overload-label">Overload</div>
            <div
              className={`overload-track ${
                overloadProgress >= 0.8 ? "overload-track--danger" : ""
              }`}
            >
              <div
                className="overload-fill"
                style={{ width: `${Math.round(overloadProgress * 100)}%` }}
              />
            </div>
            <div className="overload-value">
              {Math.round(overloadProgress * 100)}%
            </div>
          </div>
        )}

        <div className="drag-instruction">
          {isCastPhase && "Casting..."}
          {isDragPhase && (isDragging ? "Pulling..." : "Click to pull")}
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
