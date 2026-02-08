import { useState } from "react";
import useGameStore from "../../game/state/gameStore";
import "./current-speed-input.css";

function CloudCoverInput() {
  const cloudCover = useGameStore((state) => state.cloudCover);
  const setCloudCover = useGameStore((state) => state.setCloudCover);
  const [inputValue, setInputValue] = useState(String(cloudCover));

  const handleChange = (e) => {
    setInputValue(e.target.value);
  };

  const commit = () => {
    const val = parseFloat(inputValue);
    if (Number.isFinite(val)) {
      setCloudCover(val);
    } else {
      setInputValue(String(cloudCover));
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
        <span>Cloud cover</span>
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

export default CloudCoverInput;
