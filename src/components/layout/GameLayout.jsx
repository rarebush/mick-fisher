import { useState } from "react";
import Sidebar from "../ui/Sidebar";
import PixiGame from "../game/PixiGame";
import TensionBar from "../game/TensionBar";
import SlipMeter from "../game/SlipMeter";
import WaitIndicator from "../game/WaitIndicator";
import FishStatus from "../game/FishStatus";
import PlayerForceBar from "../game/PlayerForceBar";
import ObjectForceBar from "../game/ObjectForceBar";
import SpoolIndicator from "../game/SpoolIndicator";
import LineConditionIndicator from "../game/LineConditionIndicator";
import FishAIDebugWidget from "../game/FishAIDebugWidget";
import GameNotification from "../ui/GameNotification";
import GiveUpButton from "../ui/GiveUpButton";
import CastingEquipmentToggle from "../ui/CastingEquipmentToggle";
import FishingEquipmentToggle from "../ui/FishingEquipmentToggle";
import RenderScaleToggle from "../ui/RenderScaleToggle";
import CurrentSpeedInput from "../ui/CurrentSpeedInput";
import ChoppinessInput from "../ui/ChoppinessInput";
import CloudCoverInput from "../ui/CloudCoverInput";
import WindSpeedInput from "../ui/WindSpeedInput";
import WindDirectionSlider from "../ui/WindDirectionSlider";
import ReflectionAlphaSlider from "../ui/ReflectionAlphaSlider";
import WaterAlphaSlider from "../ui/WaterAlphaSlider";
import "../../styles/game-layout.css";

function GameLayout({ onQuit }) {
  const [showRenderOptions, setShowRenderOptions] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);

  return (
    <div className="game-layout">
      <main className="game-main">
        <PixiGame />
        <div className="ui-overlay">
          <div className="ui-row ui-row--top">
            <div className="ui-column ui-column--left">
              <Sidebar />
            </div>
            <div className="ui-column ui-column--right">
              <FishAIDebugWidget />
            </div>
          </div>
          <div className="ui-row ui-row--bottom">
            <div className="ui-column ui-column--left">
              <PlayerForceBar />
              <ObjectForceBar />
              <SpoolIndicator />
              <LineConditionIndicator />
              <FishStatus />
              <SlipMeter />
            </div>
            <div className="ui-column ui-column--right">
              <WaitIndicator />
              <TensionBar />
              <GiveUpButton />
              {showEquipment && (
                <div className="equipment-options">
                  <CastingEquipmentToggle />
                  <FishingEquipmentToggle />
                </div>
              )}
              {showRenderOptions && (
                <div className="render-options">
                  <RenderScaleToggle />
                  <CurrentSpeedInput />
                  <ChoppinessInput />
                  <CloudCoverInput />
                  <WindSpeedInput />
                  <WindDirectionSlider />
                  <ReflectionAlphaSlider />
                  <WaterAlphaSlider />
                </div>
              )}
              <div className="menu-controls">
                <button
                  className="options-btn"
                  onClick={() => setShowEquipment((value) => !value)}
                >
                  {showEquipment ? "Hide" : "Show"} Equipment
                </button>
                <button
                  className="options-btn"
                  onClick={() => setShowRenderOptions((value) => !value)}
                >
                  {showRenderOptions ? "Hide" : "Show"} Options
                </button>
                <button className="quit-btn" onClick={onQuit}>
                  ← Menu
                </button>
              </div>
            </div>
          </div>
        </div>
        <GameNotification />
      </main>
    </div>
  );
}

export default GameLayout;
