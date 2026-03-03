import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import {
  createViewport,
  getProjectionMetrics,
} from "../../game/mechanics/worldConstants";
import { magnitude, normalize } from "../../game/physics/vectorUtils";
import "./fish-ai-debug-widget.css";

const WIDGET_SIZE = 140;
const CENTER = WIDGET_SIZE / 2;
const MAX_LINE = 56;
const FORCE_TO_PIXELS = 1.6;

function FishAIDebugWidget() {
  const { physicsState } = useSessionStore();
  const { gamePhase } = useGameStore();

  if (gamePhase !== "dragging" || physicsState.targetType !== "fish") {
    return null;
  }

  const targetDirection = physicsState.target?.targetDirection ?? {
    x: 0,
    y: 0,
  };
  const swimForceVector = physicsState.target?.currentForce ?? { x: 0, y: 0 };
  const swimForce = magnitude(swimForceVector);

  const desiredWorldDirection =
    magnitude(targetDirection) > 0.0001
      ? normalize(targetDirection)
      : magnitude(swimForceVector) > 0.0001
        ? normalize(swimForceVector)
        : { x: 0, y: 0 };

  const viewport = createViewport(window.innerWidth, window.innerHeight);
  const metrics = getProjectionMetrics(viewport);

  const projectedDirection = {
    x:
      (desiredWorldDirection.x - desiredWorldDirection.y) *
      metrics.screenXPerWorldUnit,
    y:
      (desiredWorldDirection.x + desiredWorldDirection.y) *
      metrics.screenYPerWorldUnit,
  };

  const projectedMagnitude = magnitude(projectedDirection);
  const isoDirection =
    projectedMagnitude > 0.0001
      ? scaleVector(projectedDirection, 1 / projectedMagnitude)
      : { x: 0, y: 0 };

  const lineLength = Math.min(MAX_LINE, swimForce * FORCE_TO_PIXELS);
  const endX = CENTER + isoDirection.x * lineLength;
  const endY = CENTER + isoDirection.y * lineLength;

  return (
    <div className="fish-ai-debug-widget">
      <div className="fish-ai-debug-widget__header">Fish AI Intent</div>
      <svg
        className="fish-ai-debug-widget__plot"
        viewBox={`0 0 ${WIDGET_SIZE} ${WIDGET_SIZE}`}
        role="img"
        aria-label="Fish AI desired swim direction and swim force"
      >
        <line
          x1={0}
          y1={CENTER}
          x2={WIDGET_SIZE}
          y2={CENTER}
          className="fish-ai-debug-widget__axis"
        />
        <line
          x1={CENTER}
          y1={0}
          x2={CENTER}
          y2={WIDGET_SIZE}
          className="fish-ai-debug-widget__axis"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={3}
          className="fish-ai-debug-widget__origin"
        />
        <line
          x1={CENTER}
          y1={CENTER}
          x2={endX}
          y2={endY}
          className="fish-ai-debug-widget__vector"
        />
        <circle
          cx={endX}
          cy={endY}
          r={3}
          className="fish-ai-debug-widget__tip"
        />
      </svg>
      <div className="fish-ai-debug-widget__stats">
        <span>Force {swimForce.toFixed(1)}N</span>
        <span>
          Dir {desiredWorldDirection.x.toFixed(2)},{" "}
          {desiredWorldDirection.y.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function scaleVector(vector, scalar) {
  return {
    x: vector.x * scalar,
    y: vector.y * scalar,
  };
}

export default FishAIDebugWidget;
