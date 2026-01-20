import Sidebar from "../ui/Sidebar";
import PixiGame from "../game/PixiGame";
import "../../styles/game-layout.css";

function GameLayout({ onQuit }) {
  return (
    <div className="game-layout">
      <Sidebar />
      <main className="game-main">
        <PixiGame />
      </main>
      <button className="quit-btn" onClick={onQuit}>
        ← Menu
      </button>
    </div>
  );
}

export default GameLayout;
