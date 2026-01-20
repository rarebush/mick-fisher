import { useState, useEffect } from "react";
import "./timer.css";

function Timer() {
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  // Color coding
  let displayClass = "time-display";
  if (timeLeft <= 60) displayClass += " danger";
  else if (timeLeft <= 180) displayClass += " warning";

  return (
    <div className="timer">
      <h3>Session Time</h3>
      <div className={displayClass}>
        {minutes}:{seconds.toString().padStart(2, "0")}
      </div>
    </div>
  );
}

export default Timer;
