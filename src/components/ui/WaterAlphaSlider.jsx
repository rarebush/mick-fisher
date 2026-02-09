import useGameStore from "../../game/state/gameStore";
import "./current-speed-input.css";

function WaterAlphaSlider() {
  const waterAlpha = useGameStore((state) => state.waterAlpha);
  const setWaterAlpha = useGameStore((state) => state.setWaterAlpha);

  const handleChange = (e) => {
    setWaterAlpha(parseFloat(e.target.value));
  };

  return (
    <div className="current-speed-input">
      <label className="current-speed-label">
        <span>Water&nbsp;α</span>
        <input
          type="range"
          className="current-speed-field"
          min="0"
          max="1"
          step="0.01"
          value={waterAlpha}
          onChange={handleChange}
          style={{ width: 80 }}
        />
        <span style={{ minWidth: 32, textAlign: "right" }}>
          {waterAlpha.toFixed(2)}
        </span>
      </label>
    </div>
  );
}

export default WaterAlphaSlider;
