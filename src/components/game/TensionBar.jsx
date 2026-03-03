import useSessionStore from "../../game/state/sessionStore";
import useGameStore from "../../game/state/gameStore";
import { LINE_CONDITION_CONSTANTS } from "../../game/physics/physicsExports.js";
import { clamp } from "../../game/physics/vectorUtils";
import "./tension-bar.css";

function getConditionColor(lineCondition) {
  if (lineCondition <= 30) return "#E2513B";
  if (lineCondition <= 60) return "#E7A642";
  return "#59C37B";
}

function TensionBar() {
  const { physicsState } = useSessionStore();
  const { gamePhase } = useGameStore();

  if (gamePhase !== "dragging") {
    return null;
  }

  const tension = physicsState.tension || 0;
  const slack = physicsState.slack || 0;
  const lineCondition = physicsState.lineCondition ?? 100;
  const breakThreshold = physicsState.breakThreshold || 0;
  const baseBreakThreshold =
    physicsState.equipment?.lineStrength || breakThreshold || 1;
  const hotZoneThreshold = LINE_CONDITION_CONSTANTS.HOT_ZONE_THRESHOLD;
  const distanceToShore = physicsState.distanceToShore || 0;
  const lineTaut = Boolean(physicsState.lineTaut);
  const clampActive = Boolean(physicsState.forces?.clampActive);
  const linePayout = physicsState.linePayout || 0;
  const objectLineForce = physicsState.forces?.objectLineForce || 0;
  const objectState = physicsState.objectState || "static";
  const quickReleaseActive = Boolean(physicsState.dragQuickReleaseActive);
  const playerRecoveryVelocity = physicsState.playerRecoveryVelocity || 0;
  const objectApproachRate = physicsState.objectApproachRate || 0;
  const effectiveReelCap =
    physicsState.forces?.effectiveReelCap || playerRecoveryVelocity;
  const reelCapMet = clampActive;

  const stateMode = !lineTaut
    ? "slack"
    : linePayout > 0
      ? "payout"
      : clampActive
        ? "clamped"
        : "engaged";

  const stateLabel =
    stateMode === "slack"
      ? "Slack"
      : stateMode === "payout"
        ? "Payout"
        : stateMode === "clamped"
          ? "Clamped Reel-In"
          : "Engaged";

  const objectDirection =
    objectLineForce >= 0 ? "Object Pulling Away" : "Object Pulling Toward";

  const slackMax = Math.max(
    3,
    Math.min(6, (physicsState.spoolCapacity || 24) * 0.2),
  );
  const slackRatio = clamp(slack / slackMax, 0, 1);
  const tensionRatio = clamp(tension / baseBreakThreshold, 0, 1);
  const breakRatio = clamp(breakThreshold / baseBreakThreshold, 0, 1);
  const hotZoneRatio = clamp(hotZoneThreshold / baseBreakThreshold, 0, 1);
  const conditionColor = getConditionColor(lineCondition);

  return (
    <div className="tension-bar-container">
      <div
        className={`tension-bar-panel tension-bar-panel--${stateMode}`}
        style={{
          "--slack-fill": `${slackRatio * 50}%`,
          "--tension-fill": `${tensionRatio * 50}%`,
          "--break-marker": `${50 + breakRatio * 50}%`,
          "--hot-zone-start": `${50 + hotZoneRatio * 50}%`,
          "--condition-color": conditionColor,
        }}
      >
        <div className="tension-header">
          <div className="tension-title">Line State</div>
          <div className="tension-sub">
            {distanceToShore.toFixed(1)}m to shore
          </div>
        </div>

        <div className="tension-state-row">
          <span className={`tension-chip tension-chip--${stateMode}`}>
            {stateLabel}
          </span>
          <span className="tension-chip">{lineTaut ? "Taut" : "Slack"}</span>
          <span
            className={`tension-chip ${reelCapMet ? "tension-chip--cap-met" : ""}`}
          >
            {reelCapMet ? "Reel Cap Met" : "Below Reel Cap"}
          </span>
          {quickReleaseActive && (
            <span className="tension-chip tension-chip--quick">
              Quick Release
            </span>
          )}
        </div>

        <div className="tension-track">
          <div className="tension-track-hot" />
          <div className="tension-fill slack" />
          <div className="tension-fill pull" />
          <div className="tension-center" />
          <div className="tension-break-marker" />
        </div>

        <div className="tension-readout">
          <div>
            Slack <span>{slack.toFixed(2)}m</span>
          </div>
          <div>
            Tension <span>{Math.round(tension)}N</span>
          </div>
          <div>
            Mode <span>{stateLabel}</span>
          </div>
          <div>
            Motion <span>{objectState}</span>
          </div>
          <div>
            Object <span>{objectDirection}</span>
          </div>
          <div>
            Payout <span>{linePayout.toFixed(2)}m/s</span>
          </div>
          <div>
            Reel Vel <span>{playerRecoveryVelocity.toFixed(2)}m/s</span>
          </div>
          <div>
            Approach <span>{objectApproachRate.toFixed(2)}m/s</span>
          </div>
          <div>
            Cap <span>{effectiveReelCap.toFixed(2)}m/s</span>
          </div>
          <div>
            Cap Met <span>{reelCapMet ? "Yes" : "No"}</span>
          </div>
          <div>
            Break <span>{Math.round(breakThreshold)}N</span>
          </div>
          <div>
            Condition <span>{Math.round(lineCondition)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TensionBar;
