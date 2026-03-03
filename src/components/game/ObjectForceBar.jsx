import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import { clamp } from "../../game/physics/vectorUtils";
import "./object-force-bar.css";

function ObjectForceBar() {
  const { physicsState } = useSessionStore();
  const { gamePhase } = useGameStore();

  if (gamePhase !== "dragging") {
    return null;
  }

  const objectForce = physicsState.forces?.totalObject || 0;
  const maxReference = Math.max(
    Math.abs(objectForce),
    physicsState.breakThreshold || 0,
    physicsState.totalPlayerResistance || 0,
    1,
  );

  const forceRatio = clamp(Math.abs(objectForce) / maxReference, 0, 1);
  const isAway = objectForce >= 0;

  return (
    <div className="object-force">
      <div className="object-force__header">
        <span>Object Force</span>
        <span>
          {isAway ? "Away" : "Toward"} {Math.round(Math.abs(objectForce))}N
        </span>
      </div>
      <div className="object-force__track">
        <div
          className={`object-force__fill ${isAway ? "away" : "toward"}`}
          style={{ width: `${Math.round(forceRatio * 50)}%` }}
        />
        <div className="object-force__center" />
      </div>
    </div>
  );
}

export default ObjectForceBar;
