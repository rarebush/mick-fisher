import useGameStore from "../../game/state/gameStore";
import "./render-scale-toggle.css";

function RenderScaleToggle() {
  const renderScaleMode = useGameStore((state) => state.renderScaleMode);
  const setRenderScaleMode = useGameStore((state) => state.setRenderScaleMode);
  const renderResolutionScale = useGameStore(
    (state) => state.renderResolutionScale,
  );
  const setRenderResolutionScale = useGameStore(
    (state) => state.setRenderResolutionScale,
  );
  const isIntegerScale = renderScaleMode === "integer";
  const resolutionOptions = [1, 2, 3, 4];

  return (
    <div className="render-scale-toggle">
      <label className="render-scale-label">
        <input
          type="checkbox"
          className="render-scale-checkbox"
          checked={isIntegerScale}
          onChange={(event) =>
            setRenderScaleMode(event.target.checked ? "integer" : "auto")
          }
        />
        <span>Integer scaling (off = auto)</span>
      </label>
      <div className="render-resolution-control">
        <label
          className="render-resolution-label"
          htmlFor="render-resolution-scale"
        >
          Internal resolution
        </label>
        <select
          id="render-resolution-scale"
          className="render-resolution-select"
          value={renderResolutionScale}
          onChange={(event) =>
            setRenderResolutionScale(Number(event.target.value))
          }
        >
          {resolutionOptions.map((scale) => (
            <option key={scale} value={scale}>
              {scale}x
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default RenderScaleToggle;
