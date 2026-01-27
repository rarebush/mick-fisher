import Sidebar from "../ui/Sidebar";
import PixiGame from "../game/PixiGame";
import TensionBar from "../game/TensionBar";
import SlipMeter from "../game/SlipMeter";
import GameNotification from "../ui/GameNotification";
import GiveUpButton from "../ui/GiveUpButton";
import CastingEquipmentToggle from "../ui/CastingEquipmentToggle";
import "../../styles/game-layout.css";

function GameLayout({ onQuit }) {
  return (
    <div className="game-layout">
      <Sidebar />
      <main className="game-main">
        <CastingEquipmentToggle />
        <PixiGame />
        <GameNotification />
        <SlipMeter />
        <TensionBar />
        <GiveUpButton />
      </main>
      <button className="quit-btn" onClick={onQuit}>
        ← Menu
      </button>
    </div>
  );
}

export default GameLayout;
