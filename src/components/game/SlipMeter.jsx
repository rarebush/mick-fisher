import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import "./slip-meter.css";

function SlipMeter() {
  const { physicsState } = useSessionStore();
  const { gamePhase } = useGameStore();

  if (gamePhase !== "dragging") {
    return null;
  }

  if (physicsState.targetType !== "metallic") {
    return null;
  }

  const slipPercent = Math.min(1, Math.max(0, physicsState.slip.percent || 0));

  // Color coding based on slip percent
  let barColor = "#4CAF50"; // Green (safe, 40+ units)
  let warningClass = "";

  if (slipPercent >= 0.8) {
    barColor = "#F44336"; // Red (danger zone, 0-14 units)
    warningClass = "critical";
  } else if (slipPercent >= 0.6) {
    barColor = "#FF9800"; // Orange (edge grip, 15-24 units)
    warningClass = "danger";
  } else if (slipPercent >= 0.4) {
    barColor = "#FFEB3B"; // Yellow (good center, 25-39 units)
    warningClass = "warning";
  }

  return (
    <div className={`slip-meter-container ${warningClass}`}>
      <div className="slip-info">
        <span className="label">Magnet Slip:</span>
        <span className="value">{Math.round(slipPercent * 100)}%</span>
      </div>

      <div className="slip-bar">
        <div
          className="slip-fill"
          style={{
            width: `${Math.round(slipPercent * 100)}%`,
            backgroundColor: barColor,
          }}
        />
      </div>

      <div className="slip-hint">
        {slipPercent >= 0.8 && "⚠️ DANGER! Magnet slipping!"}
        {slipPercent >= 0.6 &&
          slipPercent < 0.8 &&
          "Edge grip - reduce tension!"}
        {slipPercent >= 0.4 && slipPercent < 0.6 && "Good position"}
        {slipPercent < 0.4 && "Perfect center - safe"}
      </div>
    </div>
  );
}

export default SlipMeter;
