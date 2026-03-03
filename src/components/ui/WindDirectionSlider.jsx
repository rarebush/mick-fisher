import useGameStore from "../../game/state/gameStore";
import "./current-speed-input.css";

function WindDirectionSlider() {
  const windDirAngle = useGameStore((state) => state.windDirAngle);
  const setWindDirAngle = useGameStore((state) => state.setWindDirAngle);

  const handleChange = (e) => {
    setWindDirAngle(parseFloat(e.target.value));
  };

  const displayDeg = Math.round(180 - windDirAngle * 360);

  return (
    <div className="current-speed-input">
      <label className="current-speed-label">
        <span>Wind dir</span>
        <input
          type="range"
          className="current-speed-field"
          min="0"
          max="1"
          step="0.0416667"
          value={windDirAngle}
          onChange={handleChange}
          style={{ width: 80 }}
        />
        <span style={{ minWidth: 42, textAlign: "right" }}>
          {displayDeg}
          {"\u00b0"}
        </span>
      </label>
    </div>
  );
}

export default WindDirectionSlider;
