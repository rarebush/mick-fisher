import { useState, useEffect, useRef } from "react";
import useGameStore from "../../game/state/gameStore";
import { getItem } from "../../game/data/itemDatabase";
import "./game-notification.css";

function GameNotification() {
  const [notification, setNotification] = useState(null);
  const { sessionStats, currentCast } = useGameStore();
  const prevStatsRef = useRef({ itemsCaught: 0, itemsLost: 0 });
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Detect when an item is caught
    if (sessionStats.itemsCaught > prevStatsRef.current.itemsCaught) {
      const item = currentCast.itemId ? getItem(currentCast.itemId) : null;
      if (item) {
        setNotification({
          type: "success",
          message: `Caught: ${item.name}!`,
          value: `+$${item.value}`,
        });

        timeoutRef.current = setTimeout(() => setNotification(null), 3000);
      }
      prevStatsRef.current.itemsCaught = sessionStats.itemsCaught;
      return;
    }

    // Detect when an item is lost
    if (sessionStats.itemsLost > prevStatsRef.current.itemsLost) {
      setNotification({
        type: "failure",
        message: "Item lost!",
      });

      timeoutRef.current = setTimeout(() => setNotification(null), 3000);
      prevStatsRef.current.itemsLost = sessionStats.itemsLost;
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [sessionStats.itemsCaught, sessionStats.itemsLost, currentCast.itemId]);

  if (!notification) return null;

  return (
    <div className={`game-notification ${notification.type}`}>
      <div className="notification-message">{notification.message}</div>
      {notification.value && (
        <div className="notification-value">{notification.value}</div>
      )}
    </div>
  );
}

export default GameNotification;
