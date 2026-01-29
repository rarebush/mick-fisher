import useGameStore from "../../game/state/gameStore";
import "./water-opacity-toggle.css";

function WaterOpacityToggle() {
  const waterSurfaceOpaque = useGameStore((state) => state.waterSurfaceOpaque);
  const setWaterSurfaceOpaque = useGameStore(
    (state) => state.setWaterSurfaceOpaque,
  );

  return (
    <div className="water-opacity-toggle">
      <label className="water-opacity-label">
        <input
          type="checkbox"
          className="water-opacity-checkbox"
          checked={waterSurfaceOpaque}
          onChange={(event) => setWaterSurfaceOpaque(event.target.checked)}
        />
        <span>Opaque water surface</span>
      </label>
    </div>
  );
}

export default WaterOpacityToggle;
