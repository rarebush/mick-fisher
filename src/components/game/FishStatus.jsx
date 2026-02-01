import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import "./fish-status.css";

function FishStatus() {
  const { physicsState } = useSessionStore();
  const { gamePhase } = useGameStore();

  if (gamePhase !== "dragging" || physicsState.targetType !== "fish") {
    return null;
  }

  const energyPercent = Math.min(
    1,
    Math.max(
      0,
      (physicsState.fishStatus.energy || 0) /
        (physicsState.target?.maxEnergy || 1),
    ),
  );
  const panicPercent = Math.min(
    1,
    Math.max(0, (physicsState.fishStatus.panic || 0) / 100),
  );
  const fishState = physicsState.fishStatus.state || "hooked";

  return (
    <div className="fish-status">
      <div className="fish-status-title">Fish Status</div>
      <div className="fish-status-row">
        <span>Energy</span>
        <div className="fish-bar">
          <div
            className="fish-bar-fill energy"
            style={{ width: `${Math.round(energyPercent * 100)}%` }}
          />
        </div>
      </div>
      <div className="fish-status-row">
        <span>Panic</span>
        <div className="fish-bar">
          <div
            className="fish-bar-fill panic"
            style={{ width: `${Math.round(panicPercent * 100)}%` }}
          />
        </div>
      </div>
      <div className="fish-status-state">State: {fishState}</div>
    </div>
  );
}

export default FishStatus;
