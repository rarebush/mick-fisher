import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import { clamp } from "../../game/physics/vectorUtils";
import "./spool-indicator.css";

function SpoolIndicator() {
  const { physicsState } = useSessionStore();
  const { gamePhase } = useGameStore();

  if (gamePhase !== "dragging") {
    return null;
  }

  const capacity = physicsState.spoolCapacity || 1;
  const remaining = physicsState.spoolRemaining || 0;
  const ratio = clamp(remaining / capacity, 0, 1);

  return (
    <div className="spool-indicator">
      <div className="spool-indicator__header">
        <span>Spool</span>
        <span>{remaining.toFixed(1)}m</span>
      </div>
      <div className="spool-indicator__track">
        <div
          className="spool-indicator__fill"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

export default SpoolIndicator;
