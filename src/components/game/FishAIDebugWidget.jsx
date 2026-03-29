import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import { getWaterBounds } from "../../game/mechanics/worldBounds";
import { magnitude, normalize } from "../../game/physics/vectorUtils";
import "./fish-ai-debug-widget.css";

const WIDGET_SIZE = 140;
const PLOT_PADDING = 10;
const MAX_VECTOR_LENGTH = 24;
const FORCE_TO_PIXELS = 0.9;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  if (Math.abs(inMax - inMin) < 1e-6) {
    return (outMin + outMax) / 2;
  }
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

function FishAIDebugWidget() {
  const { physicsState } = useSessionStore();
  const { gamePhase } = useGameStore();

  if (gamePhase !== "dragging" || physicsState.targetType !== "fish") {
    return null;
  }

  const currentDirection = physicsState.target?.currentDirection ?? {
    x: 0,
    y: 0,
  };
  const targetDirection = physicsState.target?.targetDirection ?? {
    x: 0,
    y: 0,
  };
  const swimForceVector = physicsState.target?.currentForce ?? { x: 0, y: 0 };
  const swimForce = magnitude(swimForceVector);
  const fishPosition = physicsState.target?.position;

  const desiredWorldDirection =
    magnitude(currentDirection) > 0.0001
      ? normalize(currentDirection)
      : magnitude(targetDirection) > 0.0001
        ? normalize(targetDirection)
        : magnitude(swimForceVector) > 0.0001
          ? normalize(swimForceVector)
          : { x: 0, y: 0 };

  const waterBounds = getWaterBounds();
  const plotMin = PLOT_PADDING;
  const plotMax = WIDGET_SIZE - PLOT_PADDING;
  const fishWorldX =
    fishPosition?.x ?? (waterBounds.minX + waterBounds.maxX) / 2;
  const fishWorldY =
    fishPosition?.y ?? (waterBounds.minY + waterBounds.maxY) / 2;
  const fishX = mapRange(
    fishWorldX,
    waterBounds.minX,
    waterBounds.maxX,
    plotMin,
    plotMax,
  );
  const fishY = mapRange(
    fishWorldY,
    waterBounds.minY,
    waterBounds.maxY,
    plotMax,
    plotMin,
  );

  const midWorldX = (waterBounds.minX + waterBounds.maxX) / 2;
  const midWorldY = (waterBounds.minY + waterBounds.maxY) / 2;
  const midX = mapRange(
    midWorldX,
    waterBounds.minX,
    waterBounds.maxX,
    plotMin,
    plotMax,
  );
  const midY = mapRange(
    midWorldY,
    waterBounds.minY,
    waterBounds.maxY,
    plotMax,
    plotMin,
  );

  const quarterX1 = plotMin + (plotMax - plotMin) * 0.25;
  const quarterX2 = plotMin + (plotMax - plotMin) * 0.75;
  const quarterY1 = plotMin + (plotMax - plotMin) * 0.25;
  const quarterY2 = plotMin + (plotMax - plotMin) * 0.75;

  const lineLength = Math.min(MAX_VECTOR_LENGTH, swimForce * FORCE_TO_PIXELS);
  const endX = clamp(
    fishX + desiredWorldDirection.x * lineLength,
    plotMin,
    plotMax,
  );
  const endY = clamp(
    fishY - desiredWorldDirection.y * lineLength,
    plotMin,
    plotMax,
  );

  return (
    <div className="fish-ai-debug-widget">
      <div className="fish-ai-debug-widget__header">
        Fish AI Intent (Top-Down)
      </div>
      <svg
        className="fish-ai-debug-widget__plot"
        viewBox={`0 0 ${WIDGET_SIZE} ${WIDGET_SIZE}`}
        role="img"
        aria-label="Fish AI desired swim direction and force on top-down water-space map"
      >
        <rect
          x={plotMin}
          y={plotMin}
          width={plotMax - plotMin}
          height={plotMax - plotMin}
          className="fish-ai-debug-widget__bounds"
        />
        <line
          x1={quarterX1}
          y1={plotMin}
          x2={quarterX1}
          y2={plotMax}
          className="fish-ai-debug-widget__grid"
        />
        <line
          x1={quarterX2}
          y1={plotMin}
          x2={quarterX2}
          y2={plotMax}
          className="fish-ai-debug-widget__grid"
        />
        <line
          x1={plotMin}
          y1={quarterY1}
          x2={plotMax}
          y2={quarterY1}
          className="fish-ai-debug-widget__grid"
        />
        <line
          x1={plotMin}
          y1={quarterY2}
          x2={plotMax}
          y2={quarterY2}
          className="fish-ai-debug-widget__grid"
        />
        <line
          x1={midX}
          y1={plotMin}
          x2={midX}
          y2={plotMax}
          className="fish-ai-debug-widget__axis"
        />
        <line
          x1={plotMin}
          y1={midY}
          x2={plotMax}
          y2={midY}
          className="fish-ai-debug-widget__axis"
        />
        <circle
          cx={fishX}
          cy={fishY}
          r={3}
          className="fish-ai-debug-widget__origin"
        />
        <line
          x1={fishX}
          y1={fishY}
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
          Pos {fishWorldX.toFixed(2)}, {fishWorldY.toFixed(2)}
        </span>
        <span>
          Dir {desiredWorldDirection.x.toFixed(2)},{" "}
          {desiredWorldDirection.y.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default FishAIDebugWidget;
