import useGameStore from "../../game/state/gameStore";
import useSessionStore from "../../game/state/sessionStore";
import { CASTING_EQUIPMENT } from "../../game/data/castingEquipmentDatabase";
import "./casting-equipment-toggle.css";

const CASTING_MODES = [
  { id: "click", label: "Click" },
  { id: "direction_power", label: "Direction + Power" },
  { id: "donut", label: "Donut" },
];

function CastingEquipmentToggle() {
  const { selectedCastingEquipmentId, setCastingEquipmentId } = useGameStore();
  const castInputMode = useSessionStore((state) => state.castInputMode);
  const setCastInputMode = useSessionStore((state) => state.setCastInputMode);
  const resetCastAim = useSessionStore((state) => state.resetCastAim);
  const resetDonutAim = useSessionStore((state) => state.resetDonutAim);

  return (
    <div className="casting-equipment-bar">
      <div className="casting-equipment-toggle">
        <div className="casting-equipment-title">Casting Gear</div>
        <div className="casting-equipment-buttons">
          {CASTING_EQUIPMENT.map((equipment) => {
            const isActive = equipment.id === selectedCastingEquipmentId;
            return (
              <button
                key={equipment.id}
                className={`equipment-btn ${isActive ? "active" : ""}`}
                onClick={() => setCastingEquipmentId(equipment.id)}
              >
                {equipment.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="casting-mode-display">
        <div className="casting-equipment-title">Casting Mode</div>
        <div className="casting-mode-buttons">
          {CASTING_MODES.map((mode) => {
            const isActive = mode.id === castInputMode;
            return (
              <button
                key={mode.id}
                className={`equipment-btn ${isActive ? "active" : ""}`}
                onClick={() => {
                  setCastInputMode(mode.id);
                  resetCastAim();
                  resetDonutAim();
                }}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CastingEquipmentToggle;
