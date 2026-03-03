import useInventoryStore from "../../game/state/inventoryStore";
import "./inventory.css";

function Inventory() {
  const { sessionItems, sessionValue } = useInventoryStore();
  const recentSessionItems = sessionItems.slice(-3);

  return (
    <div className="inventory">
      <h3>Session Catch ({sessionItems.length})</h3>
      <div className="session-value">Value: ${sessionValue}</div>
      {sessionItems.length === 0 ? (
        <div className="empty-state">No catches yet...</div>
      ) : (
        <ul className="item-list">
          {recentSessionItems.map((item, index) => (
            <li key={`${item.id}-${index}`} className="item">
              <div className="item-icon">{item.icon}</div>
              <div className="item-info">
                <span className="item-name">{item.name}</span>
                <span className="item-value">${item.value}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Inventory;
