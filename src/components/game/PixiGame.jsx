import { useRef, useEffect, useState } from "react";
import { PixiApp } from "../../game/PixiApp";
import useGameStore from "../../game/state/gameStore";
import useSessionStore from "../../game/state/sessionStore";
import "./pixi-game.css";

// Track global PixiApp instance for HMR cleanup
let globalPixiApp = null;

// HMR: Force full page reload to avoid canvas reinitialization issues
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log("HMR: Cleaning up and reloading page");
    if (globalPixiApp && !globalPixiApp.isDestroyed) {
      globalPixiApp.destroy();
      globalPixiApp = null;
    }
    window.location.reload();
  });
}

function PixiGame() {
  const canvasRef = useRef(null);
  const pixiAppRef = useRef(null);
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Get store references
  const gameStore = useGameStore;
  const sessionStore = useSessionStore;
  const gamePhase = useGameStore((state) => state.gamePhase);
  const lastCompletedCast = useGameStore((state) => state.lastCompletedCast);

  // Control PixiJS ticker based on game phase and notification state
  useEffect(() => {
    if (!pixiAppRef.current || pixiAppRef.current.isDestroyed) return;

    // Pause ticker when notification is showing
    // Resume when no notification (regardless of gamePhase - idle just means between casts)
    if (lastCompletedCast !== null) {
      pixiAppRef.current.pauseTicker();
    } else {
      pixiAppRef.current.resumeTicker();
    }
  }, [gamePhase, lastCompletedCast]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) {
      return;
    }

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
    globalPixiApp = pixiApp;

    // Safety timeout - if initialization takes too long, show error
    const initTimeout = setTimeout(() => {
      if (!cancelled && !ready) {
        console.error("PixiJS initialization timeout");
        setReady(true);
      }
    }, 5000);

    // Initialize asynchronously
    pixiApp
      .initialize()
      .then(() => {
        clearTimeout(initTimeout);
        if (cancelled) {
          if (pixiApp && !pixiApp.isDestroyed) {
            pixiApp.destroy();
          }
          return;
        }

        if (!pixiApp.isDestroyed && pixiApp.app) {
          setReady(true);
        } else {
          console.warn("PixiApp initialized but app is missing");
          setReady(true);
        }
      })
      .catch((err) => {
        clearTimeout(initTimeout);
        if (!cancelled) {
          console.error("PixiJS init failed:", err);
          setReady(true);
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
      cancelled = true;
      clearTimeout(initTimeout);
      window.removeEventListener("resize", handleResize);

      if (pixiAppRef.current) {
        pixiAppRef.current.destroy();
        pixiAppRef.current = null;
      }

      if (globalPixiApp === pixiAppRef.current) {
        globalPixiApp = null;
      }

      setReady(false);
    };
  }, []); // Only run once on mount

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
