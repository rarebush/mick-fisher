import { useEffect } from "react";
import useSessionStore from "../../game/state/sessionStore";
import "./timer.css";

function Timer() {
  const { sessionTimeRemaining, sessionActive, tickTimer, startSession } =
    useSessionStore();

  // Auto-start session on mount (for MVP)
  useEffect(() => {
    if (!sessionActive) {
      startSession();
    }
  }, []);

  useEffect(() => {
    if (!sessionActive) return;

    const interval = setInterval(() => {
      tickTimer();
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionActive, tickTimer]);

  const minutes = Math.floor(sessionTimeRemaining / 60);
  const seconds = sessionTimeRemaining % 60;

  // Color coding
  let displayClass = "time-display";
  if (sessionTimeRemaining <= 60) displayClass += " danger";
  else if (sessionTimeRemaining <= 180) displayClass += " warning";

  return (
    <div className="timer">
      <h3>Session Time</h3>
      <div className={displayClass}>
        {minutes}:{seconds.toString().padStart(2, "0")}
      </div>
      {!sessionActive && sessionTimeRemaining === 0 && (
        <div className="session-ended">Session Complete!</div>
      )}
    </div>
  );
}

export default Timer;
