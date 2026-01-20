import { useRef, useEffect, useState } from "react";
import { PixiApp } from "../../game/PixiApp";
import useGameStore from "../../game/state/gameStore";
import useSessionStore from "../../game/state/sessionStore";
import "./pixi-game.css";

function PixiGame() {
  const canvasRef = useRef(null);
  const pixiAppRef = useRef(null);
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Get store references
  const gameStore = useGameStore;
  const sessionStore = useSessionStore;

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    let cancelled = false;
    const { clientWidth, clientHeight } = containerRef.current;

    // Create PixiApp instance with store references
    const pixiApp = new PixiApp(
      canvasRef.current,
      clientWidth,
      clientHeight,
      gameStore,
      sessionStore,
    );
    pixiAppRef.current = pixiApp;

    // Initialize asynchronously
    pixiApp
      .initialize()
      .then(() => {
        // Check if component unmounted during initialization
        if (cancelled) {
          console.log("Component unmounted during PixiJS init, cleaning up");
          if (pixiApp && !pixiApp.isDestroyed) {
            pixiApp.destroy();
          }
          return;
        }

        if (!pixiApp.isDestroyed && pixiApp.app) {
          setReady(true);
          console.log("PixiGame ready");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("PixiJS init failed:", err);
        }
      });

    // Resize handler
    const handleResize = () => {
      if (pixiAppRef.current && !pixiAppRef.current.isDestroyed) {
        const { clientWidth, clientHeight } = containerRef.current;
        pixiAppRef.current.resize(clientWidth, clientHeight);
      }
    };

    window.addEventListener("resize", handleResize);

    // Cleanup function
    return () => {
      cancelled = true; // Mark this effect as cancelled
      window.removeEventListener("resize", handleResize);

      if (pixiAppRef.current) {
        pixiAppRef.current.destroy();
        pixiAppRef.current = null;
      }

      setReady(false);
    };
  }, []); // Empty deps - only run once

  return (
    <div ref={containerRef} className="pixi-container">
      <canvas ref={canvasRef} />
      {!ready && (
        <div
          style={{
            position: "absolute",
            color: "rgba(255,255,255,0.5)",
            fontSize: "14px",
          }}
        >
          Loading...
        </div>
      )}
    </div>
  );
}

export default PixiGame;
