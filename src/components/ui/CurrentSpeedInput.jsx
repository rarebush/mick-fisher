import { useState } from "react";
import useGameStore from "../../game/state/gameStore";
import "./current-speed-input.css";

function CurrentSpeedInput() {
  const currentSpeed = useGameStore((state) => state.currentSpeed);
  const setCurrentSpeed = useGameStore((state) => state.setCurrentSpeed);
  const [inputValue, setInputValue] = useState(String(currentSpeed));

  const handleChange = (e) => {
    setInputValue(e.target.value);
  };

  const commit = () => {
    const val = parseFloat(inputValue);
    if (Number.isFinite(val)) {
      setCurrentSpeed(val);
    } else {
      // Reset to current store value
      setInputValue(String(currentSpeed));
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
        <span>Current speed</span>
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

export default CurrentSpeedInput;
