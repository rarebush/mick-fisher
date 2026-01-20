import { useState, useEffect, useRef } from "react";
import "./tension-bar.css";

function TensionBar({ onCast }) {
  const [isHolding, setIsHolding] = useState(false);
  const [tension, setTension] = useState(0);
  const lastUpdateTime = useRef(null);
  const animationFrame = useRef(null);

  // Constants (will eventually come from game state/item properties)
  const TENSION_BUILD_RATE = 25; // % per second when holding
  const TENSION_DECAY_RATE = 10; // % per second when not holding
  const MAX_TENSION = 100;

  useEffect(() => {
    lastUpdateTime.current = performance.now();

    const updateTension = (currentTime) => {
      const deltaTime = (currentTime - lastUpdateTime.current) / 1000; // Convert to seconds
      lastUpdateTime.current = currentTime;

      setTension((prevTension) => {
        let newTension;

        if (isHolding) {
          // Build tension when holding
          newTension = Math.min(
            prevTension + TENSION_BUILD_RATE * deltaTime,
            MAX_TENSION,
          );
        } else {
          // Decay tension when not holding
          newTension = Math.max(
            prevTension - TENSION_DECAY_RATE * deltaTime,
            0,
          );
        }

        return newTension;
      });

      animationFrame.current = requestAnimationFrame(updateTension);
    };

    animationFrame.current = requestAnimationFrame(updateTension);

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [isHolding]);

  const handleMouseDown = () => {
    setIsHolding(true);
  };

  const handleMouseUp = () => {
    setIsHolding(false);
  };

  // Handle mouse leaving button while holding
  const handleMouseLeave = () => {
    if (isHolding) {
      setIsHolding(false);
    }
  };

  // Determine tension state for visual feedback
  const getTensionState = () => {
    if (tension < 30) return "low";
    if (tension < 60) return "medium";
    if (tension < 85) return "high";
    return "danger";
  };

  return (
    <div className="tension-bar-container">
      <div className={`tension-bar tension-${getTensionState()}`}>
        <div className="tension-fill" style={{ width: `${tension}%` }} />
        <div className="tension-label">
          {tension > 0 ? `Tension: ${Math.round(tension)}%` : "Ready to Pull"}
        </div>
      </div>

      <button
        className="pull-button"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      >
        {isHolding ? "Pulling..." : "Hold to Pull"}
      </button>

      <div className="tension-hint">
        {tension >= 85 && "Danger! High tension!"}
        {tension >= 60 && tension < 85 && "Careful..."}
      </div>
    </div>
  );
}

export default TensionBar;
