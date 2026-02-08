import Sidebar from "../ui/Sidebar";
import PixiGame from "../game/PixiGame";
import TensionBar from "../game/TensionBar";
import SlipMeter from "../game/SlipMeter";
import WaitIndicator from "../game/WaitIndicator";
import FishStatus from "../game/FishStatus";
import LineStressMeter from "../game/LineStressMeter";
import GameNotification from "../ui/GameNotification";
import GiveUpButton from "../ui/GiveUpButton";
import CastingEquipmentToggle from "../ui/CastingEquipmentToggle";
import FishingEquipmentToggle from "../ui/FishingEquipmentToggle";
import RenderScaleToggle from "../ui/RenderScaleToggle";
import CurrentSpeedInput from "../ui/CurrentSpeedInput";
import ChoppinessInput from "../ui/ChoppinessInput";
import CloudCoverInput from "../ui/CloudCoverInput";
import "../../styles/game-layout.css";

function GameLayout({ onQuit }) {
  return (
    <div className="game-layout">
      <main className="game-main">
        <PixiGame />
        <div className="ui-overlay">
          <div className="ui-row ui-row--top">
            <div className="ui-column ui-column--left">
              <Sidebar />
            </div>
            <div className="ui-column ui-column--right" />
          </div>
          <div className="ui-row ui-row--center">
            <GameNotification />
          </div>
          <div className="ui-row ui-row--bottom">
            <div className="ui-column ui-column--left">
              <CastingEquipmentToggle />
              <FishingEquipmentToggle />
              <LineStressMeter />
              <FishStatus />
              <SlipMeter />
            </div>
            <div className="ui-column ui-column--right">
              <WaitIndicator />
              <TensionBar />
              <GiveUpButton />
              <RenderScaleToggle />
              <CurrentSpeedInput />
              <ChoppinessInput />
              <CloudCoverInput />
              <button className="quit-btn" onClick={onQuit}>
                ← Menu
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default GameLayout;
