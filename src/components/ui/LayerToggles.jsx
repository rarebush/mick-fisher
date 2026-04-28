import useGameStore from "../../game/state/gameStore";
import "./layer-toggles.css";

const LAYER_LABELS = [
  { key: "riverbed", label: "Riverbed" },
  { key: "submergedWalls", label: "Submerged Walls" },
  { key: "waterSurface", label: "Water Surface" },
  { key: "reflections", label: "Reflections" },
  { key: "sparkles", label: "Sparkles" },
  { key: "sparkleBlooms", label: "Sparkle Bloom" },
  { key: "fluidFoam", label: "Fluid Foam" },
  { key: "edgeFoam", label: "Edge Foam" },
  { key: "waterObjectsBelow", label: "Objects (Below)" },
  { key: "waterObjectsAbove", label: "Objects (Above)" },
  { key: "displacement", label: "Displacement" },
  { key: "riverWall", label: "River Wall" },
  { key: "walkway", label: "Walkway" },
];

function LayerToggles() {
  const layerVisibility = useGameStore((state) => state.layerVisibility);
  const toggleLayerVisibility = useGameStore(
    (state) => state.toggleLayerVisibility,
  );

  return (
    <div className="layer-toggles">
      <div className="layer-toggles__title">Layer Toggles</div>
      <div className="layer-toggles__list">
        {LAYER_LABELS.map(({ key, label }) => (
          <label key={key} className="layer-toggles__item">
            <input
              type="checkbox"
              className="layer-toggles__checkbox"
              checked={layerVisibility[key]}
              onChange={() => toggleLayerVisibility(key)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default LayerToggles;
