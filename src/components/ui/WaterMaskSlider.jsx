import useGameStore from "../../game/state/gameStore";
import "./current-speed-input.css";

function WaterMaskSlider() {
  const waterMaskThreshold = useGameStore((state) => state.waterMaskThreshold);
  const setWaterMaskThreshold = useGameStore(
    (state) => state.setWaterMaskThreshold,
  );

  const handleChange = (e) => {
    setWaterMaskThreshold(parseFloat(e.target.value));
  };

  return (
    <div className="current-speed-input">
      <label className="current-speed-label">
        <span>Mask&nbsp;thresh</span>
        <input
          type="range"
          className="current-speed-field"
          min="0"
          max="1"
          step="0.01"
          value={waterMaskThreshold}
          onChange={handleChange}
          style={{ width: 80 }}
        />
        <span style={{ minWidth: 32, textAlign: "right" }}>
          {waterMaskThreshold.toFixed(2)}
        </span>
      </label>
    </div>
  );
}

export default WaterMaskSlider;
