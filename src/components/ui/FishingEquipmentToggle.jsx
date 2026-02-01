import useGameStore from "../../game/state/gameStore";
import { EQUIPMENT_DATABASE } from "../../game/data/fishingEquipmentDatabase";
import "./fishing-equipment-toggle.css";

function FishingEquipmentToggle() {
  const { fishingEquipment, setFishingEquipment, gamePhase } = useGameStore();
  const isBusy = gamePhase !== "idle";

  const renderButtons = (type) =>
    Object.values(EQUIPMENT_DATABASE[type]).map((equipment) => {
      const isActive =
        fishingEquipment.type === type &&
        fishingEquipment.tierId === equipment.id;
      return (
        <button
          key={equipment.id}
          className={`equipment-btn ${isActive ? "active" : ""}`}
          disabled={isBusy}
          onClick={() => setFishingEquipment(type, equipment.id)}
        >
          {equipment.name}
        </button>
      );
    });

  return (
    <div className="fishing-equipment-bar">
      <div className="fishing-equipment-group">
        <div className="fishing-equipment-title">Magnet</div>
        <div className="fishing-equipment-buttons">
          {renderButtons("magnet")}
        </div>
      </div>
      <div className="fishing-equipment-group">
        <div className="fishing-equipment-title">Rod</div>
        <div className="fishing-equipment-buttons">{renderButtons("rod")}</div>
      </div>
      {isBusy && (
        <div className="fishing-equipment-hint">
          Finish the cast to switch gear.
        </div>
      )}
    </div>
  );
}

export default FishingEquipmentToggle;
