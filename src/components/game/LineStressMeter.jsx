import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import "./line-stress-meter.css";

function LineStressMeter() {
  const { physicsState } = useSessionStore();
  const { gamePhase } = useGameStore();

  if (gamePhase !== "dragging" || physicsState.targetType !== "fish") {
    return null;
  }

  const stressPercent = Math.min(
    1,
    Math.max(0, physicsState.lineStress.percent || 0),
  );

  let barColor = "#4CAF50";
  if (stressPercent >= 0.8) {
    barColor = "#F44336";
  } else if (stressPercent >= 0.6) {
    barColor = "#FF9800";
  } else if (stressPercent >= 0.4) {
    barColor = "#FFEB3B";
  }

  return (
    <div className="line-stress-meter">
      <div className="line-stress-title">Line Stress</div>
      <div className="line-stress-bar">
        <div
          className="line-stress-fill"
          style={{
            width: `${Math.round(stressPercent * 100)}%`,
            background: barColor,
          }}
        />
      </div>
      <div className="line-stress-value">
        {Math.round(stressPercent * 100)}%
      </div>
    </div>
  );
}

export default LineStressMeter;
