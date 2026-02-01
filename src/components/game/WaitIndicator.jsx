import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import "./wait-indicator.css";

function WaitIndicator() {
  const { physicsState } = useSessionStore();
  const { gamePhase } = useGameStore();

  if (gamePhase !== "waiting" || !physicsState.waitState) {
    return null;
  }

  const waitState = physicsState.waitState;
  const progress =
    waitState.maxWaitTime > 0
      ? Math.min(1, waitState.waitTime / waitState.maxWaitTime)
      : 0;

  return (
    <div className="wait-indicator">
      <div className="wait-title">Waiting for a bite...</div>
      <div className="wait-progress">
        <div
          className="wait-progress-fill"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <div className="wait-meta">
        <span>Time: {waitState.waitTime.toFixed(1)}s</span>
        <span>Nibble: {waitState.nibbleCount}</span>
      </div>
    </div>
  );
}

export default WaitIndicator;
