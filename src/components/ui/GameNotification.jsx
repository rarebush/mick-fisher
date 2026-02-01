import { useState, useEffect, useRef } from "react";
import useGameStore from "../../game/state/gameStore";
import useSessionStore from "../../game/state/sessionStore";
import { getItem } from "../../game/data/itemDatabase";
import "./game-notification.css";

function GameNotification() {
  const [notification, setNotification] = useState(null);
  const { sessionStats, lastCompletedCast, clearLastCompletedCast } =
    useGameStore();
  const { pauseTimer, resumeTimer } = useSessionStore();
  const prevStatsRef = useRef({ itemsCaught: 0, itemsLost: 0 });

  const handleDismiss = () => {
    setNotification(null);
    clearLastCompletedCast();
    resumeTimer();
  };

  useEffect(() => {
    // Detect when an item is caught
    if (sessionStats.itemsCaught > prevStatsRef.current.itemsCaught) {
      const itemFromDb = lastCompletedCast?.itemId
        ? getItem(lastCompletedCast.itemId)
        : null;
      const item = itemFromDb || lastCompletedCast?.item || null;
      if (item) {
        setNotification({
          type: "success",
          item: item,
          distance: lastCompletedCast.distance,
          placementQuality: lastCompletedCast.placementQuality,
        });
        pauseTimer();
      }
      prevStatsRef.current.itemsCaught = sessionStats.itemsCaught;
      return;
    }

    // Detect when an item is lost
    if (sessionStats.itemsLost > prevStatsRef.current.itemsLost) {
      const itemFromDb = lastCompletedCast?.itemId
        ? getItem(lastCompletedCast.itemId)
        : null;
      const item = itemFromDb || lastCompletedCast?.item || null;
      setNotification({
        type: "failure",
        message: item ? `Lost ${item.name}!` : "Item lost!",
        reason: lastCompletedCast?.failureReason,
      });
      pauseTimer();
      prevStatsRef.current.itemsLost = sessionStats.itemsLost;
    }
  }, [
    sessionStats.itemsCaught,
    sessionStats.itemsLost,
    lastCompletedCast,
    pauseTimer,
  ]);

  if (!notification) return null;

  // Success notification with item details
  if (notification.type === "success" && notification.item) {
    const { item, distance, placementQuality } = notification;
    return (
      <div className="game-notification success">
        <div className="notification-icon">{item.icon || "✨"}</div>
        <div className="notification-title">
          {item.category?.includes("fish") ? "Fish Caught!" : "Item Caught!"}
        </div>
        <div className="notification-item-name">{item.name}</div>
        <div className="notification-stats">
          <div className="stat">
            <span className="stat-label">Value:</span>
            <span className="stat-value">${item.value}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Weight:</span>
            <span className="stat-value">{item.weight}kg</span>
          </div>
        </div>
        <div className="notification-details">
          <div className="detail">{distance?.toFixed(1)}m from shore</div>
          {placementQuality && (
            <div className={`detail placement-${placementQuality.placement}`}>
              {placementQuality.label}
            </div>
          )}
        </div>
        <button className="dismiss-button" onClick={handleDismiss}>
          Continue
        </button>
      </div>
    );
  }

  // Failure notification
  return (
    <div className="game-notification failure">
      <div className="notification-message">{notification.message}</div>
      {notification.reason && (
        <div className="notification-reason">
          {notification.reason === "tension-overload"
            ? "⚡ The line snapped from too much force!"
            : notification.reason === "line-snapped"
              ? "🪢 The line snapped!"
              : "💨 The magnet slipped off the item!"}
        </div>
      )}
      <button className="dismiss-button" onClick={handleDismiss}>
        Continue
      </button>
    </div>
  );
}

export default GameNotification;
