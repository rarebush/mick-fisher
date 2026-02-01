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
  const physicsState = useSessionStore((state) => state.physicsState);
  const [isVisible, setIsVisible] = useState(false);

  // Only show during active dragging
  useEffect(() => {
    setIsVisible(gamePhase === "dragging" && physicsState.active);
  }, [gamePhase, physicsState.active]);

  const handleGiveUp = () => {
    // Trigger manual failure via custom event
    // This will be caught by PixiApp which has access to onDragFailure callback
    const event = new CustomEvent("manualDragFailure", {
      detail: { position: physicsState.target?.position || null },
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
