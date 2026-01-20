import { useRef, useEffect, useState } from "react";
import { PixiApp } from "../../game/PixiApp";
import "./pixi-game.css";

function PixiGame() {
  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const { clientWidth, clientHeight } = containerRef.current;

    // Create and initialize
    const pixiApp = new PixiApp(canvasRef.current, clientWidth, clientHeight);
    appRef.current = pixiApp;

    pixiApp.initialize().then(() => {
      if (!pixiApp.isDestroyed) {
        setReady(true);
      }
    });

    // Resize handler
    const handleResize = () => {
      if (
        containerRef.current &&
        appRef.current &&
        !appRef.current.isDestroyed
      ) {
        const { clientWidth, clientHeight } = containerRef.current;
        appRef.current.resize(clientWidth, clientHeight);
      }
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (appRef.current) {
        appRef.current.destroy();
      }
    };
  }, []);

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
