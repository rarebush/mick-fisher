import { useState, useEffect, useRef } from "react";
import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import useInventoryStore from "../../game/state/inventoryStore";
import {
  calculateTensionBuildRate,
  processTap,
  updateDragState,
} from "../../game/mechanics/dragMechanics";
import { getItem } from "../../game/data/itemDatabase";
import "./tension-bar.css";

function TensionBar() {
  const [isHolding, setIsHolding] = useState(false);
  const lastUpdateTime = useRef(null);
  const animationFrame = useRef(null);
  const lastTapTime = useRef(0);

  // Zustand stores
  const { dragState, updateDragTension, updateDragProgress, completeDrag } =
    useSessionStore();
  const { gamePhase, currentCast, setGamePhase, completeCast } = useGameStore();
  const { addItem } = useInventoryStore();

  const MAX_TENSION = 100;

  // Reset holding state when game phase changes away from dragging
  useEffect(() => {
    if (gamePhase !== "dragging") {
      setIsHolding(false);
    }
  }, [gamePhase]);

  // Main update loop - only active during drag phase
  useEffect(() => {
    if (gamePhase !== "dragging" || !dragState.active) {
      return;
    }

    lastUpdateTime.current = performance.now();

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
        isHolding,
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

      // Check for completion or failure
      if (result.complete) {
        const finalSlip = completeDrag();

        // TODO: Implement lift phase UI - for now, auto-complete successfully
        console.log("Drag complete! Slip accumulated:", finalSlip);

        // Add item to inventory
        addItem(item);

        // Complete cast successfully
        completeCast(true);

        // Return to idle
        setGamePhase("idle");
      } else if (result.failed) {
        completeDrag();

        console.log("Drag failed! Reason:", result.failReason);

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
    isHolding,
    dragState.tension,
    dragState.distance,
    dragState.slipAccumulated,
    currentCast,
  ]);

  const handleMouseDown = () => {
    if (gamePhase !== "dragging") return;

    const now = performance.now();
    const timeSinceLastTap = now - lastTapTime.current;

    // Detect tap (quick press) vs hold
    if (timeSinceLastTap < 200) {
      // This is part of rapid tapping, don't set holding
      return;
    }

    lastTapTime.current = now;
    setIsHolding(true);
  };

  const handleMouseUp = () => {
    if (gamePhase !== "dragging") return;

    const now = performance.now();
    const pressDuration = now - lastTapTime.current;

    // If released within 200ms, treat as tap
    if (pressDuration < 200) {
      const item = currentCast.itemId ? getItem(currentCast.itemId) : null;
      if (item) {
        const newTension = processTap(dragState.tension);
        updateDragTension(newTension);
      }
    }

    setIsHolding(false);
  };

  // Handle mouse leaving button while holding
  const handleMouseLeave = () => {
    if (isHolding) {
      setIsHolding(false);
    }
  };

  // Prevent context menu
  const handleContextMenu = (e) => {
    e.preventDefault();
  };

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

      <button
        className="pull-button"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        onContextMenu={handleContextMenu}
      >
        {isHolding ? "Pull" : "Hold"}
      </button>

      <div className="tension-hint">
        {tension >= 85 && "⚠️ DANGER!"}
        {tension >= 60 && tension < 85 && "Careful"}
        {tension < 60 && ""}
      </div>
    </div>
  );
}

export default TensionBar;
