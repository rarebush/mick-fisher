import { useRef, useEffect, useState } from "react";
import { PixiApp } from "../../game/PixiApp";
import useGameStore from "../../game/state/gameStore";
import useSessionStore from "../../game/state/sessionStore";
import useLocationStore from "../../game/state/locationStore";
import useInventoryStore from "../../game/state/inventoryStore";
import "./pixi-game.css";

// Track global PixiApp instance for HMR cleanup
let globalPixiApp = null;

const BASE_WIDTH = 640;
const BASE_HEIGHT = 360;

// Expose for other components (e.g., TensionBar needs to update debug overlay)
if (typeof window !== "undefined") {
  window.getPixiApp = () => globalPixiApp;
}

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
  const renderScaleMode = useGameStore((state) => state.renderScaleMode);
  const renderScaleModeRef = useRef(renderScaleMode);

  // Get store references
  const gameStore = useGameStore;
  const sessionStore = useSessionStore;
  const locationStore = useLocationStore;
  const inventoryStore = useInventoryStore;
  const gamePhase = useGameStore((state) => state.gamePhase);
  const lastCompletedCast = useGameStore((state) => state.lastCompletedCast);

  // Note: We no longer pause the PixiJS ticker when notifications appear
  // This allows animations (like rope reel-in) to continue smoothly
  // The game timer is paused by GameNotification component instead

  const applyCanvasScale = () => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let scale = 1;
    if (renderScaleModeRef.current === "integer") {
      scale = Math.max(
        1,
        Math.floor(
          Math.min(
            container.clientWidth / BASE_WIDTH,
            container.clientHeight / BASE_HEIGHT,
          ),
        ),
      );
    } else {
      scale = Math.min(
        container.clientWidth / BASE_WIDTH,
        container.clientHeight / BASE_HEIGHT,
      );
    }

    if (Number.isFinite(scale) && scale > 0) {
      canvas.style.width = `${BASE_WIDTH * scale}px`;
      canvas.style.height = `${BASE_HEIGHT * scale}px`;
    }
  };

  useEffect(() => {
    renderScaleModeRef.current = renderScaleMode;
    applyCanvasScale();
  }, [renderScaleMode]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) {
      return;
    }

    let cancelled = false;
    // Create PixiApp instance with store references
    const pixiApp = new PixiApp(
      canvasRef.current,
      BASE_WIDTH,
      BASE_HEIGHT,
      gameStore,
      sessionStore,
      locationStore,
      inventoryStore,
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
      if (!pixiAppRef.current || pixiAppRef.current.isDestroyed) return;
      applyCanvasScale();
    };

    applyCanvasScale();
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
