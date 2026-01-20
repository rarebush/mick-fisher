import Timer from "./Timer";
import Inventory from "./Inventory";
import "./sidebar.css";

function Sidebar() {
  return (
    <aside className="sidebar">
      <Timer />
      <Inventory />
    </aside>
  );
}

export default Sidebar;
