import useGameStore from "../../game/state/gameStore";
import "./current-speed-input.css";

function ReflectionAlphaSlider() {
  const reflectionAlpha = useGameStore((state) => state.reflectionAlpha);
  const setReflectionAlpha = useGameStore((state) => state.setReflectionAlpha);

  const handleChange = (e) => {
    setReflectionAlpha(parseFloat(e.target.value));
  };

  return (
    <div className="current-speed-input">
      <label className="current-speed-label">
        <span>Reflection&nbsp;α</span>
        <input
          type="range"
          className="current-speed-field"
          min="0"
          max="1"
          step="0.01"
          value={reflectionAlpha}
          onChange={handleChange}
          style={{ width: 80 }}
        />
        <span style={{ minWidth: 32, textAlign: "right" }}>
          {reflectionAlpha.toFixed(2)}
        </span>
      </label>
    </div>
  );
}

export default ReflectionAlphaSlider;
