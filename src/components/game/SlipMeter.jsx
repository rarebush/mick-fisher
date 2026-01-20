import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import { getDistanceToNearestEdge } from "../../game/mechanics/slipCalculations";
import "./slip-meter.css";

function SlipMeter() {
  const { dragState, liftState } = useSessionStore();
  const { gamePhase } = useGameStore();

  // Show during dragging or revealed lift phase (for debugging)
  if (gamePhase !== "dragging" && gamePhase !== "lifting-revealed") {
    return null;
  }

  // Get magnet position from appropriate phase
  const magnetPosition =
    gamePhase === "dragging"
      ? dragState.magnetPosition
      : liftState.magnetPosition || 50;

  const magnetContactWidth =
    gamePhase === "dragging" ? dragState.magnetContactWidth : 10;

  // Calculate distance to nearest edge
  const distanceToEdge = getDistanceToNearestEdge(magnetPosition);

  // Determine which edge is nearest for visual display
  const isNearLeftEdge = magnetPosition < 50;

  // Color coding based on distance to edge (from documentation)
  let barColor = "#4CAF50"; // Green (safe, 40+ units)
  let warningClass = "";

  if (distanceToEdge < 15) {
    barColor = "#F44336"; // Red (danger zone, 0-14 units)
    warningClass = "critical";
  } else if (distanceToEdge < 25) {
    barColor = "#FF9800"; // Orange (edge grip, 15-24 units)
    warningClass = "danger";
  } else if (distanceToEdge < 40) {
    barColor = "#FFEB3B"; // Yellow (good center, 25-39 units)
    warningClass = "warning";
  }

  // Calculate magnet edges for display
  const magnetLeftEdge = magnetPosition - magnetContactWidth / 2;
  const magnetRightEdge = magnetPosition + magnetContactWidth / 2;

  return (
    <div className={`slip-meter-container ${warningClass}`}>
      <div className="slip-info">
        <span className="label">Magnet Position:</span>
        <span className="value">
          {distanceToEdge.toFixed(0)} units from edge
        </span>
      </div>

      <div className="slip-bar">
        {/* Red danger zones on both edges (0-15 units) */}
        <div className="slip-danger-zone left" />
        <div className="slip-danger-zone right" />

        {/* Yellow caution zones (15-40 units) */}
        <div className="slip-caution-zone left" />
        <div className="slip-caution-zone right" />

        {/* Magnet indicator - shows position and contact width */}
        <div
          className="slip-magnet"
          style={{
            left: `${magnetLeftEdge}%`,
            width: `${magnetContactWidth}%`,
            backgroundColor: barColor,
          }}
        >
          <div
            className="magnet-center"
            style={{ left: `${magnetContactWidth / 2}%` }}
          />
        </div>
      </div>

      <div className="slip-hint">
        {distanceToEdge < 15 &&
          `⚠️ DANGER! ${distanceToEdge.toFixed(0)} units from ${isNearLeftEdge ? "left" : "right"} edge!`}
        {distanceToEdge >= 15 &&
          distanceToEdge < 25 &&
          "Edge grip - reduce tension!"}
        {distanceToEdge >= 25 && distanceToEdge < 40 && "Good position"}
        {distanceToEdge >= 40 && "Perfect center - safe"}
      </div>
    </div>
  );
}

export default SlipMeter;
