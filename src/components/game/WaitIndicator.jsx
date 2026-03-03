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
  const isStrikeWindow = waitState.mode === "strike";
  const progress = isStrikeWindow
    ? waitState.strikeWindowSeconds > 0
      ? Math.min(
          1,
          waitState.strikeTimeRemaining / waitState.strikeWindowSeconds,
        )
      : 0
    : 0;

  const handleCancel = () => {
    window.dispatchEvent(new CustomEvent("manualWaitCancel"));
  };

  return (
    <div className={`wait-indicator ${isStrikeWindow ? "strike" : ""}`}>
      <div className="wait-title">
        {isStrikeWindow ? "Strike now!" : "Waiting for a bite..."}
      </div>
      <div className="wait-progress">
        <div
          className="wait-progress-fill"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <div className="wait-meta">
        {isStrikeWindow ? (
          <span>Window: {waitState.strikeTimeRemaining.toFixed(2)}s</span>
        ) : (
          <span>Time: {waitState.waitTime.toFixed(1)}s</span>
        )}
        <span>Nibble: {waitState.nibbleCount}</span>
      </div>
      {!isStrikeWindow && (
        <button className="wait-cancel" onClick={handleCancel}>
          Reel In
        </button>
      )}
    </div>
  );
}

export default WaitIndicator;
