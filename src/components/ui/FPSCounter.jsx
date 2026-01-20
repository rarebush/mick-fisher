import { useState, useEffect, useRef } from "react";
import "./fps-counter.css";

function FPSCounter() {
  const [fps, setFps] = useState(60);
  const frameTimesRef = useRef([]);
  const lastTimeRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const updateFPS = (currentTime) => {
      // Initialize lastTimeRef on first frame
      if (lastTimeRef.current === null) {
        lastTimeRef.current = currentTime;
        rafRef.current = requestAnimationFrame(updateFPS);
        return;
      }

      const delta = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // Store last 60 frame times
      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      // Calculate average FPS from last 60 frames
      const avgDelta =
        frameTimesRef.current.reduce((a, b) => a + b, 0) /
        frameTimesRef.current.length;
      const calculatedFps = Math.round(1000 / avgDelta);

      setFps(calculatedFps);

      rafRef.current = requestAnimationFrame(updateFPS);
    };

    rafRef.current = requestAnimationFrame(updateFPS);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Color code based on FPS
  let fpsClass = "good";
  if (fps < 30) fpsClass = "bad";
  else if (fps < 50) fpsClass = "warning";

  return (
    <div className="fps-counter">
      <div className={`fps-value ${fpsClass}`}>{fps}</div>
      <div className="fps-label">FPS</div>
    </div>
  );
}

export default FPSCounter;
