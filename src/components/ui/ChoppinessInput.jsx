import { useState } from "react";
import useGameStore from "../../game/state/gameStore";
import "./current-speed-input.css";

function ChoppinessInput() {
  const choppiness = useGameStore((state) => state.choppiness);
  const setChoppiness = useGameStore((state) => state.setChoppiness);
  const [inputValue, setInputValue] = useState(String(choppiness));

  const handleChange = (e) => {
    setInputValue(e.target.value);
  };

  const commit = () => {
    const val = parseFloat(inputValue);
    if (Number.isFinite(val)) {
      setChoppiness(val);
    } else {
      setInputValue(String(choppiness));
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
        <span>Choppiness</span>
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

export default ChoppinessInput;
