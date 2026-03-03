import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import { clamp } from "../../game/physics/vectorUtils";
import "./line-condition-indicator.css";

function getConditionColor(condition) {
  if (condition <= 30) return "#E2513B";
  if (condition <= 60) return "#E7A642";
  return "#59C37B";
}

function LineConditionIndicator() {
  const { physicsState } = useSessionStore();
  const { gamePhase } = useGameStore();

  if (gamePhase !== "dragging") {
    return null;
  }

  const condition = physicsState.lineCondition ?? 100;
  const ratio = clamp(condition / 100, 0, 1);
  const color = getConditionColor(condition);

  return (
    <div className="line-condition">
      <div className="line-condition__header">
        <span>Line Condition</span>
        <span>{Math.round(condition)}%</span>
      </div>
      <div className="line-condition__track">
        <div
          className="line-condition__fill"
          style={{ width: `${Math.round(ratio * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default LineConditionIndicator;
