import { useEffect, useState } from "react";
import useGameStore from "../../game/state/gameStore";
import useSessionStore from "../../game/state/sessionStore";
import "./give-up-button.css";

/**
 * GiveUpButton - Manual drag cancellation
 * Allows player to manually fail the current drag
 * Item remains engaged at current position (progressive retrieval)
 */
function GiveUpButton() {
  const gamePhase = useGameStore((state) => state.gamePhase);
  const dragState = useSessionStore((state) => state.dragState);
  const [isVisible, setIsVisible] = useState(false);

  // Only show during active dragging
  useEffect(() => {
    setIsVisible(gamePhase === "dragging" && dragState.active);
  }, [gamePhase, dragState.active]);

  const handleGiveUp = () => {
    // Trigger manual failure via custom event
    // This will be caught by PixiApp which has access to onDragFailure callback
    const event = new CustomEvent("manualDragFailure", {
      detail: { distance: dragState.distance },
    });
    window.dispatchEvent(event);
  };

  if (!isVisible) return null;

  return (
    <button
      className="give-up-btn"
      onClick={handleGiveUp}
      title="Give up (let the magnet slip off)"
    >
      Give Up
    </button>
  );
}

export default GiveUpButton;
