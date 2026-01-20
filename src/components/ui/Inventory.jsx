import "./inventory.css";

function Inventory() {
  // Placeholder data - will connect to Zustand store later
  const items = [
    { id: 1, name: "Rusty Bicycle", value: 45, icon: "🚲" },
    { id: 2, name: "Glass Bottle", value: 5, icon: "🍾" },
    { id: 3, name: "Old Boot", value: 8, icon: "🥾" },
  ];

  return (
    <div className="inventory">
      <h3>Session Catch ({items.length})</h3>
      {items.length === 0 ? (
        <div className="empty-state">No catches yet...</div>
      ) : (
        <ul className="item-list">
          {items.map((item) => (
            <li key={item.id} className="item">
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
