import { useState } from "react";
import useGameStore from "../../game/state/gameStore";
import "./current-speed-input.css";

function WindSpeedInput() {
  const windSpeed = useGameStore((state) => state.windSpeed);
  const setWindSpeed = useGameStore((state) => state.setWindSpeed);
  const [inputValue, setInputValue] = useState(String(windSpeed));

  const handleChange = (e) => {
    setInputValue(e.target.value);
  };

  const commit = () => {
    const val = parseFloat(inputValue);
    if (Number.isFinite(val)) {
      setWindSpeed(val);
    } else {
      setInputValue(String(windSpeed));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      commit();
      e.target.blur();
    }
  };

  return (
    <div className="current-speed-input">
      <label className="current-speed-label">
        <span>Wind speed</span>
        <input
          type="text"
          className="current-speed-field"
          value={inputValue}
          onChange={handleChange}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
      </label>
    </div>
  );
}

export default WindSpeedInput;
