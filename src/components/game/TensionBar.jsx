import { useEffect, useRef } from "react";
import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import useInventoryStore from "../../game/state/inventoryStore";
import {
  calculateTensionBuildRate,
  updateDragState,
} from "../../game/mechanics/dragMechanics";
import { getItem } from "../../game/data/itemDatabase";
import "./tension-bar.css";

function TensionBar() {
  const lastUpdateTime = useRef(null);
  const dragStartTime = useRef(null);
  const animationFrame = useRef(null);

  // Zustand stores
  const {
    dragState,
    isDragging,
    updateDragTension,
    updateDragProgress,
    completeDrag,
  } = useSessionStore();
  const { gamePhase, currentCast, setGamePhase, completeCast } = useGameStore();
  const { addItem } = useInventoryStore();

  const MAX_TENSION = 100;

  // Reset drag state when leaving drag phase
  useEffect(() => {
    if (gamePhase !== "dragging") {
      // Ensure drag state is cleared when not in drag phase
      if (isDragging) {
        useSessionStore.setState({ isDragging: false });
      }
    }
  }, [gamePhase, isDragging]);

  // Main update loop - only active during drag phase
  useEffect(() => {
    if (gamePhase !== "dragging" || !dragState.active) {
      return;
    }

    dragStartTime.current = performance.now();
    lastUpdateTime.current = dragStartTime.current;

    const updateLoop = (currentTime) => {
      const deltaTime = (currentTime - lastUpdateTime.current) / 1000;
      lastUpdateTime.current = currentTime;

      // Get current item data
      const item = currentCast.itemId ? getItem(currentCast.itemId) : null;
      if (!item) {
        // No item - shouldn't be in drag phase
        setGamePhase("idle");
        return;
      }

      // Calculate tension change based on item weight and hold state
      const tensionChange = calculateTensionBuildRate(
        dragState.tension,
        item.weight,
        isDragging,
      );
      const newTension = Math.max(
        0,
        Math.min(100, dragState.tension + tensionChange * deltaTime),
      );

      updateDragTension(newTension);

      // Update drag progress with positional slip calculation
      const result = updateDragState(
        {
          tension: newTension,
          distance: dragState.distance,
          magnetPosition: dragState.magnetPosition,
          magnetContactWidth: dragState.magnetContactWidth,
          slipDirection: dragState.slipDirection,
        },
        item,
        deltaTime,
      );

      updateDragProgress(result.distance, result.magnetPosition);

      // VERBOSE LOGGING FOR ANALYSIS (log ~2% of frames)
      if (Math.random() < 0.02) {
        const dragSpeed =
          result.distance !== dragState.distance
            ? (dragState.distance - result.distance) / deltaTime
            : 0;
        const magnetLeftEdge =
          result.magnetPosition - dragState.magnetContactWidth / 2;
        const magnetRightEdge =
          result.magnetPosition + dragState.magnetContactWidth / 2;
        console.log(
          `[DRAG] T:${newTension.toFixed(0)}% | Speed:${dragSpeed.toFixed(2)}m/s | Dist:${result.distance.toFixed(1)}/${dragState.totalDistance.toFixed(1)}m | MagPos:${result.magnetPosition.toFixed(1)} [${magnetLeftEdge.toFixed(1)}-${magnetRightEdge.toFixed(1)}] | ${item.name}(${item.weight}kg)`,
        );
      }

      // Check for completion or failure
      if (result.complete) {
        const finalSlip = completeDrag();
        const dragDuration = (performance.now() - dragStartTime.current) / 1000;

        // TODO: Implement lift phase UI - for now, auto-complete successfully
        console.log(
          `[DRAG COMPLETE] Duration:${dragDuration.toFixed(1)}s | Dist:${dragState.totalDistance.toFixed(1)}m | AvgSpeed:${(dragState.totalDistance / dragDuration).toFixed(2)}m/s | ${item.name} | Slip:${finalSlip.toFixed(1)}`,
        );

        // Add item to inventory
        addItem(item);
        console.log("Added item to inventory:", item.name);

        // Complete cast successfully
        completeCast(true);

        // Return to idle
        setGamePhase("idle");
      } else if (result.failed) {
        completeDrag();

        console.log("Drag failed! Reason:", result.failReason);

        // Store failure reason in current cast
        useGameStore.setState((state) => ({
          currentCast: {
            ...state.currentCast,
            failureReason: result.failReason,
          },
        }));

        // Complete cast as failure
        completeCast(false);

        // Return to idle after brief delay
        setTimeout(() => {
          setGamePhase("idle");
        }, 1000);
      }

      animationFrame.current = requestAnimationFrame(updateLoop);
    };

    animationFrame.current = requestAnimationFrame(updateLoop);

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [
    gamePhase,
    dragState.active,
    isDragging,
    dragState.tension,
    dragState.distance,
    dragState.slipAccumulated,
    currentCast,
  ]);

  // Don't render if not in drag phase
  if (gamePhase !== "dragging" || !dragState.active) {
    return null;
  }

  const tension = dragState.tension;
  const distance = dragState.distance;

  // Color coding based on tension level
  let barColor = "#4CAF50"; // Green (safe)
  if (tension >= 85) {
    barColor = "#F44336"; // Red (danger)
  } else if (tension >= 70) {
    barColor = "#FF9800"; // Orange (warning)
  } else if (tension >= 50) {
    barColor = "#FFEB3B"; // Yellow (high)
  }

  return (
    <div className="tension-bar-container">
      <div className="drag-info">
        <div className="info-item">
          <span className="label">Dist</span>
          <span className="value">{distance.toFixed(1)}m</span>
        </div>
        <div className="info-item">
          <span className="label">Tension</span>
          <span className="value">{Math.round(tension)}%</span>
        </div>
      </div>

      <div className="tension-bar">
        <div
          className="tension-fill"
          style={{
            height: `${tension}%`,
            backgroundColor: barColor,
          }}
        />
      </div>

      <div className="drag-instruction">
        {isDragging ? "Pulling..." : "Click to pull"}
      </div>

      <div className="tension-hint">
        {tension >= 85 && "⚠️ DANGER!"}
        {tension >= 60 && tension < 85 && "Careful"}
        {tension < 60 && ""}
      </div>
    </div>
  );
}

export default TensionBar;
