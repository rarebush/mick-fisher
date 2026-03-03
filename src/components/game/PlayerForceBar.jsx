import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import { clamp } from "../../game/physics/vectorUtils";
import "./player-force-bar.css";

function PlayerForceBar() {
  const { physicsState } = useSessionStore();
  const { gamePhase } = useGameStore();

  if (gamePhase !== "dragging") {
    return null;
  }

  const dragThreshold = physicsState.dragThresholdCurrent || 0;
  const dragThresholdMax = physicsState.dragThresholdMax || dragThreshold;
  const reactiveDrag = physicsState.reactiveDrag || 0;
  const avatarPull = physicsState.avatarPullForce || 0;
  const totalResistance = physicsState.totalPlayerResistance || 0;
  const quickReleaseActive = Boolean(physicsState.dragQuickReleaseActive);
  const maxPull = physicsState.equipment?.maxPullForce || 0;
  const maxForce = Math.max(dragThresholdMax + maxPull, totalResistance, 1);

  const reactiveRatio = clamp(reactiveDrag / maxForce, 0, 1);
  const activeRatio = clamp(avatarPull / maxForce, 0, 1);
  const reelRatio = clamp(dragThreshold / maxForce, 0, 1);

  return (
    <div className="player-force">
      <div className="player-force__header">
        <span>Player Force</span>
        <span>{Math.round(totalResistance)}N</span>
      </div>
      <div className="player-force__track">
        <div
          className={`player-force__drag ${
            quickReleaseActive ? "player-force__drag--quick" : ""
          }`}
          style={{ width: `${Math.round(reactiveRatio * 100)}%` }}
        />
        <div
          className="player-force__fill"
          style={{
            left: `${Math.round(reactiveRatio * 100)}%`,
            width: `${Math.round(activeRatio * 100)}%`,
          }}
        />
        <div
          className="player-force__baseline"
          style={{ left: `${Math.round(reelRatio * 100)}%` }}
        />
      </div>
      <div className="player-force__labels">
        <span>Reactive {Math.round(reactiveDrag)}N</span>
        <span>Ceil {Math.round(dragThreshold)}N</span>
        <span>Pull {Math.round(avatarPull)}N</span>
      </div>
    </div>
  );
}

export default PlayerForceBar;
