# Magnet Fishing & Fishing Game: Physics System Implementation

## Project Context

This is a 2.5D magnet fishing simulation game built with Vite, React, PixiJS, and Zustand. The game uses isometric projection where physics are simulated in 3D world space (X horizontal, Y depth, Z vertical) but rendered through 2D projection.

**Coordinate System:**

- X = horizontal (left/right along the shore)
- Y = depth (toward/away from shore; toward player is negative Y)
- Z = vertical (used in lift phase, not drag phase)
- Avatar position: (0, -1, 3) on the walkway
- Water surface: Z = 1
- Riverbed: Z = 0

**Important:** Before implementing, investigate the existing codebase structure, state management patterns, and rendering approach. Adapt this specification to work with what exists rather than assuming structure.

---

## Overview

We are implementing a physics-based drag system that supports two equipment types:

1. **Magnet** - catches metallic items (passive objects)
2. **Rod** - catches fish (active agents with AI)

Both use the same underlying 2D force-based physics simulation. The difference is that metallic items are passive (only respond to forces) while fish are active (generate their own forces).

---

## Part 1: Core Physics Engine

### 1.1 Force-Based Simulation

All movement emerges from forces. No arbitrary speed caps or limits. The simulation runs every frame.

**Core equation:**

```
Net Force = Pull Force + Water Drag + Current Force + Friction + Additional Forces
Acceleration = Net Force / Mass
Velocity += Acceleration × deltaTime
Position += Velocity × deltaTime
```

### 1.2 Physics Constants

```javascript
const PHYSICS_CONSTANTS = {
  // Water properties
  WATER_DENSITY: 1.0,
  BASELINE_WATER_RESISTANCE: 2.0, // Minimum drag everything experiences
  TURBULENCE_FACTOR: 0.05, // High-speed turbulence (cubic term)

  // Line properties
  LINE_DRAG_PER_METER: 0.02, // Line itself creates drag

  // Mechanical properties
  REEL_EFFICIENCY_FALLOFF: 0.1, // Pull force diminishes at high reel speeds

  // Friction (items on riverbed)
  STATIC_FRICTION_COEFFICIENT: 0.8, // Force needed to start moving
  KINETIC_FRICTION_COEFFICIENT: 0.2, // Friction while sliding

  // Tension dynamics
  ROPE_SYSTEM_INERTIA: 50, // How quickly tension responds to input
  TENSION_DECAY_BASE: 30, // Tension decay rate when not holding
};
```

### 1.3 Tension System

Tension behaves like engine RPM. Player input is the throttle.

**Tension zones (for UI feedback, not arbitrary limits):**

- 0-40%: Low tension (minimal power output)
- 40-75%: Working tension (good power)
- 75-100%: Redline tension (maximum power, heat builds)

**Tension update logic:**

```javascript
function updateTension(deltaTime, isHolding, target, equipment) {
  if (isHolding) {
    // Engine torque from power curve
    const engineTorque = getEngineTorque(tension, equipment);

    // Load resistance based on how the target is moving
    const loadResistance = calculateLoadResistance(target, avatarPosition);

    // Tension climbs based on torque minus load
    const tensionDelta =
      (engineTorque - loadResistance) / PHYSICS_CONSTANTS.ROPE_SYSTEM_INERTIA;
    tension += tensionDelta * deltaTime;
  } else {
    // Tension decays when not holding
    // Decay is slightly reduced if target is still moving (momentum pulls on line)
    const speed = magnitude(target.velocity);
    const velocityDecayBonus = speed * 5;
    const decayRate = Math.max(
      10,
      PHYSICS_CONSTANTS.TENSION_DECAY_BASE - velocityDecayBonus,
    );
    tension -= decayRate * deltaTime;
  }

  tension = clamp(tension, 0, 100);
}
```

**Power curve (maps tension to torque output):**

```javascript
function getEngineTorque(tension, equipment) {
  // Exponential curve: almost nothing at low tension, rapid growth at high tension
  const normalizedTension = tension / 100;

  // Piecewise for distinct zones
  let torqueMultiplier;
  if (normalizedTension < 0.4) {
    // Idle zone: very low output
    torqueMultiplier = Math.pow(normalizedTension / 0.4, 2) * 0.1;
  } else if (normalizedTension < 0.75) {
    // Working zone: power builds
    const zoneProgress = (normalizedTension - 0.4) / 0.35;
    torqueMultiplier = 0.1 + zoneProgress * 0.5;
  } else {
    // Redline zone: maximum power
    const zoneProgress = (normalizedTension - 0.75) / 0.25;
    torqueMultiplier = 0.6 + zoneProgress * 0.4;
  }

  return equipment.maxPullForce * torqueMultiplier;
}
```

**Load resistance (how hard the system is working):**

```javascript
function calculateLoadResistance(target, avatarPosition) {
  const pullDirection = normalize(subtract(avatarPosition, target.position));
  const speed = magnitude(target.velocity);

  // How aligned is velocity with pull direction?
  let alignment = 0;
  if (speed > 0.01) {
    alignment = dotProduct(normalize(target.velocity), pullDirection);
  }

  // Low speed = high resistance (item isn't moving, load is heavy)
  // Perpendicular/opposite movement = high resistance (fighting the pull)
  const speedFactor = Math.max(0.3, 1 - speed * 0.3);
  const alignmentFactor = 1 - alignment * 0.5; // Range: 0.5 to 1.5

  return target.mass * speedFactor * alignmentFactor * 0.5;
}
```

### 1.4 Force Calculations

All forces are 2D vectors with x and y components.

**Pull Force:**

```javascript
function getPullForce(tension, equipment, target, avatarPosition) {
  const speed = magnitude(target.velocity);

  // Base pull from tension and power curve
  const basePull = getEngineTorque(tension, equipment);

  // Mechanical efficiency diminishes at high reel speeds
  const efficiency =
    1 / (1 + speed * PHYSICS_CONSTANTS.REEL_EFFICIENCY_FALLOFF);

  const pullMagnitude = basePull * efficiency;

  // Direction: from target toward avatar
  const direction = normalize(subtract(avatarPosition, target.position));

  return {
    x: direction.x * pullMagnitude,
    y: direction.y * pullMagnitude,
  };
}
```

**Water Drag:**

```javascript
function getWaterDrag(target, velocity, lineLength) {
  const speed = magnitude(velocity);
  if (speed < 0.001) return { x: 0, y: 0 };

  // Direction opposes motion
  const direction = {
    x: -velocity.x / speed,
    y: -velocity.y / speed,
  };

  // Item-specific drag (quadratic with speed)
  const itemDrag =
    target.dragFactor * PHYSICS_CONSTANTS.WATER_DENSITY * speed * speed;

  // Baseline water resistance (linear, everything has some)
  const baselineDrag = PHYSICS_CONSTANTS.BASELINE_WATER_RESISTANCE * speed;

  // Turbulence at high speed (cubic, naturally limits top speed)
  const turbulenceDrag =
    PHYSICS_CONSTANTS.TURBULENCE_FACTOR * speed * speed * speed;

  // Line drag (longer line = more resistance)
  const lineDrag = PHYSICS_CONSTANTS.LINE_DRAG_PER_METER * lineLength * speed;

  const totalDrag = itemDrag + baselineDrag + turbulenceDrag + lineDrag;

  return {
    x: direction.x * totalDrag,
    y: direction.y * totalDrag,
  };
}
```

**Current Force:**

```javascript
function getCurrentForce(target, currentEnvironment) {
  if (!currentEnvironment || currentEnvironment.strength === 0) {
    return { x: 0, y: 0 };
  }

  // Current affects items based on their drag factor (larger surface = more push)
  const effectiveStrength = currentEnvironment.strength * target.dragFactor;

  // Normalize direction
  const dir = normalize(currentEnvironment.direction);

  return {
    x: dir.x * effectiveStrength,
    y: dir.y * effectiveStrength,
  };
}
```

**Friction (for items on riverbed):**

```javascript
function getFriction(target, velocity, isMoving) {
  const speed = magnitude(velocity);

  if (!isMoving) {
    // Static friction: must overcome to start moving
    // Returns the threshold, not a force vector
    return {
      type: "static",
      threshold: target.mass * PHYSICS_CONSTANTS.STATIC_FRICTION_COEFFICIENT,
    };
  }

  if (speed < 0.01) return { x: 0, y: 0 };

  // Kinetic friction: opposes motion
  const frictionMagnitude =
    target.mass * PHYSICS_CONSTANTS.KINETIC_FRICTION_COEFFICIENT;

  return {
    x: (-velocity.x / speed) * frictionMagnitude,
    y: (-velocity.y / speed) * frictionMagnitude,
  };
}
```

### 1.5 Main Physics Update Loop

```javascript
function updateDragPhysics(
  deltaTime,
  isHolding,
  target,
  targetType,
  equipment,
  environment,
) {
  const avatarPosition = getAvatarPosition(); // From game state
  const lineLength = magnitude(subtract(target.position, avatarPosition));

  // Update tension
  updateTension(deltaTime, isHolding, target, equipment);

  // Check if target can move (static friction)
  if (!target.isMoving) {
    const staticFriction =
      target.mass * PHYSICS_CONSTANTS.STATIC_FRICTION_COEFFICIENT;
    const pullForce = getPullForce(tension, equipment, target, avatarPosition);
    const pullMagnitude = magnitude(pullForce);

    if (pullMagnitude > staticFriction) {
      target.isMoving = true;
    } else {
      // Can't overcome static friction, no movement
      return {
        tension,
        canMove: false,
        requiredForce: staticFriction,
        currentForce: pullMagnitude,
      };
    }
  }

  // Calculate all forces
  const pullForce = getPullForce(tension, equipment, target, avatarPosition);
  const waterDrag = getWaterDrag(target, target.velocity, lineLength);
  const currentForce = getCurrentForce(target, environment.current);
  const friction = getFriction(target, target.velocity, target.isMoving);

  // Additional force from fish AI (zero for metallic items)
  let additionalForce = { x: 0, y: 0 };
  if (targetType === "fish" && target.currentForce) {
    additionalForce = target.currentForce;
  }

  // Net force
  const netForce = {
    x:
      pullForce.x +
      waterDrag.x +
      currentForce.x +
      friction.x +
      additionalForce.x,
    y:
      pullForce.y +
      waterDrag.y +
      currentForce.y +
      friction.y +
      additionalForce.y,
  };

  // Acceleration (F = ma, so a = F/m)
  const acceleration = {
    x: netForce.x / target.mass,
    y: netForce.y / target.mass,
  };

  // Update velocity
  target.velocity.x += acceleration.x * deltaTime;
  target.velocity.y += acceleration.y * deltaTime;

  // Update position
  target.position.x += target.velocity.x * deltaTime;
  target.position.y += target.velocity.y * deltaTime;

  // Return state for UI/feedback
  return {
    tension,
    speed: magnitude(target.velocity),
    distanceToShore: lineLength,
    netForce: magnitude(netForce),
  };
}
```

### 1.6 Heat/Pressure System (Redline Penalty)

Separate from physics. Monitors tension and creates consequences for sustained redline.

```javascript
const HEAT_CONSTANTS = {
  BUILD_RATE: 25, // %/second when in redline
  DECAY_RATE: 15, // %/second when below redline
  REDLINE_THRESHOLD: 75, // Tension % where heat starts building
  FAILURE_THRESHOLD: 100,
};

let heat = 0;

function updateHeat(deltaTime, tension) {
  if (tension >= HEAT_CONSTANTS.REDLINE_THRESHOLD) {
    // Heat builds faster the deeper into redline
    const redlineDepth =
      (tension - HEAT_CONSTANTS.REDLINE_THRESHOLD) /
      (100 - HEAT_CONSTANTS.REDLINE_THRESHOLD);
    heat += HEAT_CONSTANTS.BUILD_RATE * redlineDepth * deltaTime;
  } else {
    // Heat decays when below redline
    heat -= HEAT_CONSTANTS.DECAY_RATE * deltaTime;
  }

  heat = clamp(heat, 0, HEAT_CONSTANTS.FAILURE_THRESHOLD);

  if (heat >= HEAT_CONSTANTS.FAILURE_THRESHOLD) {
    return { overheated: true };
  }

  return {
    overheated: false,
    heat,
    heatPercent: heat / HEAT_CONSTANTS.FAILURE_THRESHOLD,
  };
}
```

---

## Part 2: Equipment System

### 2.1 Equipment Categories

Two equipment types for MVP:

```javascript
const EQUIPMENT_CATEGORIES = {
  magnet: {
    catches: ["metallic"],
    attachmentType: "magnetic",
    failureMode: "slip", // Magnet slides off item
    dragBehavior: "passive", // Item doesn't generate forces
    requiresWait: false, // Instant attachment on cast
  },
  rod: {
    catches: ["fish"],
    attachmentType: "bite",
    failureMode: "escape", // Fish spits hook or line snaps
    dragBehavior: "active", // Fish generates its own forces
    requiresWait: true, // Must wait for fish to bite
  },
};
```

### 2.2 Equipment Database

Each equipment type has tiers with different capabilities:

```javascript
const EQUIPMENT_DATABASE = {
  magnet: {
    tier1: {
      id: "magnet_basic",
      name: "Basic Magnet",
      tier: 1,
      maxPullForce: 50,
      slipResistance: 1.0,
      effectiveMassRange: { min: 0.5, max: 30 },
      struggleMassRange: { min: 30, max: 50 },
      // Above struggleMassRange.max: won't overcome static friction
      lineStrength: 80,
      cost: 0, // Starter equipment
      description: "A basic neodymium magnet. Good for light to medium items.",
    },
    tier2: {
      id: "magnet_heavy",
      name: "Heavy Duty Magnet",
      tier: 2,
      maxPullForce: 80,
      slipResistance: 1.15,
      effectiveMassRange: { min: 5, max: 50 },
      struggleMassRange: { min: 50, max: 80 },
      lineStrength: 120,
      cost: 500,
      description:
        "Reinforced magnet with stronger pull. Handles heavier salvage.",
    },
    tier3: {
      id: "magnet_industrial",
      name: "Industrial Magnet",
      tier: 3,
      maxPullForce: 120,
      slipResistance: 1.3,
      effectiveMassRange: { min: 15, max: 80 },
      struggleMassRange: { min: 80, max: 120 },
      lineStrength: 180,
      cost: 1500,
      description:
        "Industrial-grade electromagnet. For serious salvage operations.",
    },
  },
  rod: {
    tier1: {
      id: "rod_basic",
      name: "Basic Fishing Rod",
      tier: 1,
      maxPullForce: 30,
      lineStrength: 50,
      effectiveMassRange: { min: 0.5, max: 5 },
      struggleMassRange: { min: 5, max: 10 },
      waitTimeRange: { min: 5, max: 15 }, // Seconds to wait for bite
      biteChancePerSecond: 0.1,
      cost: 0,
      description: "A simple fishing rod. Good for small fish.",
    },
    tier2: {
      id: "rod_sport",
      name: "Sport Fishing Rod",
      tier: 2,
      maxPullForce: 50,
      lineStrength: 80,
      effectiveMassRange: { min: 2, max: 12 },
      struggleMassRange: { min: 12, max: 20 },
      waitTimeRange: { min: 4, max: 12 },
      biteChancePerSecond: 0.12,
      cost: 800,
      description: "Quality rod with better line. Handles fighting fish.",
    },
    tier3: {
      id: "rod_deep",
      name: "Deep Water Rod",
      tier: 3,
      maxPullForce: 100,
      lineStrength: 150,
      effectiveMassRange: { min: 5, max: 30 },
      struggleMassRange: { min: 30, max: 50 },
      waitTimeRange: { min: 6, max: 20 },
      biteChancePerSecond: 0.08, // Bigger fish are rarer
      cost: 2000,
      description: "Heavy-duty rod for trophy fish. Built for the big ones.",
    },
  },
};
```

### 2.3 Player Equipment State

```javascript
// Example player equipment state structure
const playerEquipment = {
  // Currently equipped
  equipped: {
    type: "magnet", // 'magnet' or 'rod'
    tierId: "magnet_basic",
  },

  // Owned equipment
  owned: {
    magnet: ["magnet_basic"], // Array of owned tier IDs
    rod: ["rod_basic"],
  },

  // Consumables (for rod)
  bait: {
    worms: 10,
    lures: 2,
  },
};
```

### 2.4 Equipment Switching

Player can switch equipment type and tier:

```javascript
function equipItem(type, tierId) {
  // Validate ownership
  if (!playerEquipment.owned[type].includes(tierId)) {
    return { success: false, reason: "not_owned" };
  }

  // Can't switch mid-drag
  if (gameState.phase === "drag" || gameState.phase === "lift") {
    return { success: false, reason: "busy" };
  }

  playerEquipment.equipped = { type, tierId };

  return { success: true };
}

function getEquippedEquipment() {
  const { type, tierId } = playerEquipment.equipped;
  return EQUIPMENT_DATABASE[type][tierId.split("_")[1]]; // e.g., 'magnet_basic' -> tier1
}
```

---

## Part 3: Metallic Items (Magnet Targets)

### 3.1 Item Properties

```javascript
const METALLIC_ITEM_SCHEMA = {
  // Identity
  id: "string", // Unique instance ID
  type: "string", // Reference to database entry

  // Physics
  mass: "number", // kg
  dragFactor: "number", // Water resistance coefficient

  // Position and motion
  position: { x: "number", y: "number" },
  velocity: { x: "number", y: "number" },
  isMoving: "boolean", // Has overcome static friction

  // Magnet attachment
  magneticStrength: "number", // How well magnet grips (affects slip)
  surfaceCondition: "string", // 'clean' | 'rusty' | 'sludge'
  attachmentPoint: "string", // 'center' | 'edge' | 'corner'

  // Slip system
  slipAccumulation: "number",
  slipLimit: "number",

  // Game properties
  category: "string",
  rarity: "string",
  baseValue: "number",

  // State
  attached: "boolean",
  dropCount: "number",
  quality: "number", // 100 - (dropCount × penalty)
};
```

### 3.2 Item Database

```javascript
const METALLIC_ITEM_DATABASE = {
  tin_can: {
    mass: 0.5,
    dragFactor: 0.3,
    magneticStrength: 0.3,
    baseSlipLimit: 100,
    category: "trash",
    rarity: "common",
    baseValue: 2,
  },
  wrench: {
    mass: 1.5,
    dragFactor: 0.25,
    magneticStrength: 0.8,
    baseSlipLimit: 90,
    category: "tool",
    rarity: "common",
    baseValue: 15,
  },
  bicycle: {
    mass: 15,
    dragFactor: 1.2,
    magneticStrength: 0.7,
    baseSlipLimit: 80,
    category: "vehicle",
    rarity: "common",
    baseValue: 45,
  },
  shopping_trolley: {
    mass: 12,
    dragFactor: 2.0, // Catches lots of water
    magneticStrength: 0.6,
    baseSlipLimit: 75,
    category: "trash",
    rarity: "common",
    baseValue: 10,
  },
  safe_small: {
    mass: 40,
    dragFactor: 0.9,
    magneticStrength: 0.9,
    baseSlipLimit: 60,
    category: "container",
    rarity: "rare",
    baseValue: 200,
    isContainer: true,
  },
  safe_large: {
    mass: 80,
    dragFactor: 1.1,
    magneticStrength: 0.85,
    baseSlipLimit: 50,
    category: "container",
    rarity: "epic",
    baseValue: 500,
    isContainer: true,
  },
  engine_block: {
    mass: 100,
    dragFactor: 0.9,
    magneticStrength: 0.95,
    baseSlipLimit: 45,
    category: "vehicle",
    rarity: "rare",
    baseValue: 300,
  },
  gold_bar: {
    mass: 12,
    dragFactor: 0.2, // Small, streamlined
    magneticStrength: 0.4, // Gold isn't very magnetic
    baseSlipLimit: 40,
    category: "treasure",
    rarity: "legendary",
    baseValue: 2000,
  },
};
```

### 3.3 Item Instance Creation

```javascript
function createMetallicItem(typeId, position) {
  const template = METALLIC_ITEM_DATABASE[typeId];

  // Roll surface condition based on rarity
  const surfaceCondition = rollSurfaceCondition(template.rarity);

  // Roll attachment point
  const attachmentPoint = rollAttachmentPoint();

  // Calculate slip limit based on attachment
  const slipLimit = calculateSlipLimit(template.baseSlipLimit, attachmentPoint);

  return {
    id: generateUniqueId(),
    type: typeId,

    // Physics
    mass: template.mass,
    dragFactor: template.dragFactor,
    position: { ...position },
    velocity: { x: 0, y: 0 },
    isMoving: false,

    // Attachment
    magneticStrength: template.magneticStrength,
    surfaceCondition,
    attachmentPoint,

    // Slip
    slipAccumulation: 0,
    slipLimit,

    // Game
    category: template.category,
    rarity: template.rarity,
    baseValue: template.baseValue,
    isContainer: template.isContainer || false,

    // State
    attached: true,
    dropCount: 0,
    quality: 100,
  };
}

function rollSurfaceCondition(rarity) {
  const roll = Math.random();
  // Rarer items more likely to be clean
  const cleanChance =
    rarity === "legendary"
      ? 0.6
      : rarity === "epic"
      ? 0.4
      : rarity === "rare"
      ? 0.3
      : 0.2;

  if (roll < cleanChance) return "clean";
  if (roll < cleanChance + 0.4) return "rusty";
  return "sludge";
}

function rollAttachmentPoint() {
  const roll = Math.random();
  if (roll < 0.3) return "center";
  if (roll < 0.7) return "edge";
  return "corner";
}

function calculateSlipLimit(baseLimit, attachmentPoint) {
  const multipliers = {
    center: 1.2, // Better grip
    edge: 1.0, // Normal
    corner: 0.7, // Worse grip
  };
  return Math.floor(baseLimit * multipliers[attachmentPoint]);
}
```

### 3.4 Slip System

Slip accumulates based on tension changes (jerky input):

```javascript
const SLIP_CONSTANTS = {
  SURFACE_MULTIPLIERS: {
    clean: 1.0,
    rusty: 1.5,
    sludge: 2.5,
  },
};

let lastTension = 0;

function updateSlip(item, tension, equipment, deltaTime) {
  // Slip only accumulates on tension INCREASE
  if (tension > lastTension) {
    const tensionIncrease = tension - lastTension;

    // Inverse relationship: increases at high tension cost LESS
    // (rewards commitment to high tension)
    const tensionPenalty = 1 - (tension / 100) * 0.5;

    // Surface condition multiplier
    const surfaceMultiplier =
      SLIP_CONSTANTS.SURFACE_MULTIPLIERS[item.surfaceCondition];

    // Equipment resistance bonus
    const resistanceBonus = equipment.slipResistance || 1.0;

    // Calculate slip
    const slipGain =
      (tensionIncrease * tensionPenalty * surfaceMultiplier) / resistanceBonus;

    item.slipAccumulation += slipGain;
  }

  lastTension = tension;

  // Check for detachment
  if (item.slipAccumulation >= item.slipLimit) {
    return { detached: true };
  }

  return {
    detached: false,
    slipPercent: item.slipAccumulation / item.slipLimit,
  };
}
```

---

## Part 4: Fish System

### 4.1 Fish Properties

```javascript
const FISH_SCHEMA = {
  // Identity
  id: "string",
  species: "string",
  size: "string", // 'small' | 'medium' | 'large' | 'trophy'

  // Physics
  mass: "number",
  dragFactor: "number",
  position: { x: "number", y: "number" },
  velocity: { x: "number", y: "number" },
  isMoving: "boolean", // Always true for fish

  // AI properties
  baseStrength: "number",
  maxEnergy: "number",
  temperament: "string", // 'calm' | 'skittish' | 'aggressive'

  // AI state
  state: "string", // 'hooked' | 'fighting' | 'tired' | 'landed'
  energy: "number",
  panicLevel: "number",

  // Movement
  targetDirection: { x: "number", y: "number" },
  directionChangeTimer: "number",
  currentForce: { x: "number", y: "number" },

  // Line interaction
  lineStress: "number",

  // Game properties
  baseValue: "number",

  // State
  attached: "boolean",
};
```

### 4.2 Fish Database

```javascript
const FISH_DATABASE = {
  carp: {
    mass: 2,
    dragFactor: 0.4,
    baseStrength: 20,
    maxEnergy: 80,
    temperament: "calm",
    panicThreshold: 70,
    directionChangeFrequency: 2.5,
    baseValue: 15,
    sizes: {
      small: {
        massMultiplier: 0.6,
        strengthMultiplier: 0.6,
        valueMultiplier: 0.5,
      },
      medium: {
        massMultiplier: 1.0,
        strengthMultiplier: 1.0,
        valueMultiplier: 1.0,
      },
      large: {
        massMultiplier: 1.5,
        strengthMultiplier: 1.4,
        valueMultiplier: 2.0,
      },
      trophy: {
        massMultiplier: 2.5,
        strengthMultiplier: 2.0,
        valueMultiplier: 5.0,
      },
    },
  },
  bass: {
    mass: 3,
    dragFactor: 0.35,
    baseStrength: 35,
    maxEnergy: 100,
    temperament: "skittish",
    panicThreshold: 50,
    directionChangeFrequency: 1.5,
    baseValue: 25,
    sizes: {
      small: {
        massMultiplier: 0.5,
        strengthMultiplier: 0.5,
        valueMultiplier: 0.4,
      },
      medium: {
        massMultiplier: 1.0,
        strengthMultiplier: 1.0,
        valueMultiplier: 1.0,
      },
      large: {
        massMultiplier: 1.6,
        strengthMultiplier: 1.5,
        valueMultiplier: 2.5,
      },
      trophy: {
        massMultiplier: 2.8,
        strengthMultiplier: 2.2,
        valueMultiplier: 6.0,
      },
    },
  },
  pike: {
    mass: 5,
    dragFactor: 0.3,
    baseStrength: 50,
    maxEnergy: 120,
    temperament: "aggressive",
    panicThreshold: 40,
    directionChangeFrequency: 0.8,
    baseValue: 40,
    sizes: {
      small: {
        massMultiplier: 0.6,
        strengthMultiplier: 0.6,
        valueMultiplier: 0.5,
      },
      medium: {
        massMultiplier: 1.0,
        strengthMultiplier: 1.0,
        valueMultiplier: 1.0,
      },
      large: {
        massMultiplier: 1.8,
        strengthMultiplier: 1.7,
        valueMultiplier: 3.0,
      },
      trophy: {
        massMultiplier: 3.0,
        strengthMultiplier: 2.5,
        valueMultiplier: 8.0,
      },
    },
  },
  catfish: {
    mass: 8,
    dragFactor: 0.5,
    baseStrength: 40,
    maxEnergy: 150,
    temperament: "calm",
    panicThreshold: 60,
    directionChangeFrequency: 2.0,
    baseValue: 35,
    sizes: {
      small: {
        massMultiplier: 0.5,
        strengthMultiplier: 0.5,
        valueMultiplier: 0.4,
      },
      medium: {
        massMultiplier: 1.0,
        strengthMultiplier: 1.0,
        valueMultiplier: 1.0,
      },
      large: {
        massMultiplier: 2.0,
        strengthMultiplier: 1.8,
        valueMultiplier: 3.5,
      },
      trophy: {
        massMultiplier: 3.5,
        strengthMultiplier: 2.8,
        valueMultiplier: 10.0,
      },
    },
  },
  sturgeon: {
    mass: 25,
    dragFactor: 0.6,
    baseStrength: 80,
    maxEnergy: 200,
    temperament: "aggressive",
    panicThreshold: 50,
    directionChangeFrequency: 1.2,
    baseValue: 100,
    sizes: {
      small: {
        massMultiplier: 0.4,
        strengthMultiplier: 0.4,
        valueMultiplier: 0.3,
      },
      medium: {
        massMultiplier: 1.0,
        strengthMultiplier: 1.0,
        valueMultiplier: 1.0,
      },
      large: {
        massMultiplier: 2.0,
        strengthMultiplier: 1.8,
        valueMultiplier: 4.0,
      },
      trophy: {
        massMultiplier: 4.0,
        strengthMultiplier: 3.0,
        valueMultiplier: 15.0,
      },
    },
  },
};
```

### 4.3 Temperament System

```javascript
const TEMPERAMENT_MODIFIERS = {
  calm: {
    panicBuildRate: 0.7,
    panicDecayRate: 1.3,
    energyDrainRate: 0.8,
    directionChangeMod: 1.5, // Slower direction changes
    strengthWhenCalm: 0.3,
    strengthWhenPanicked: 0.9,
  },
  skittish: {
    panicBuildRate: 1.5,
    panicDecayRate: 0.8,
    energyDrainRate: 1.2,
    directionChangeMod: 0.6, // Erratic
    strengthWhenCalm: 0.5,
    strengthWhenPanicked: 1.0,
  },
  aggressive: {
    panicBuildRate: 1.0,
    panicDecayRate: 0.5, // Stays angry
    energyDrainRate: 1.0,
    directionChangeMod: 0.8,
    strengthWhenCalm: 0.7, // Strong even when calm
    strengthWhenPanicked: 1.2, // Exceeds base strength
  },
};
```

### 4.4 Fish Instance Creation

Fish are spawned when the player gets a bite, not pre-existing in the water:

```javascript
function createFish(species, size, hookPosition) {
  const template = FISH_DATABASE[species];
  const sizeData = template.sizes[size];
  const temperament = TEMPERAMENT_MODIFIERS[template.temperament];

  return {
    id: generateUniqueId(),
    species,
    size,

    // Physics (fish spawns at hook position)
    mass: template.mass * sizeData.massMultiplier,
    dragFactor: template.dragFactor,
    position: { ...hookPosition },
    velocity: { x: 0, y: 0 },
    isMoving: true, // Fish are always "moving"

    // AI properties
    baseStrength: template.baseStrength * sizeData.strengthMultiplier,
    maxEnergy: template.maxEnergy,
    temperament: template.temperament,
    panicThreshold: template.panicThreshold,

    // AI state
    state: "hooked",
    energy: template.maxEnergy,
    panicLevel: 0,

    // Movement
    targetDirection: { x: 0, y: 1 }, // Initially try to swim away
    directionChangeTimer:
      template.directionChangeFrequency * temperament.directionChangeMod,
    directionChangeFrequency:
      template.directionChangeFrequency * temperament.directionChangeMod,
    currentForce: { x: 0, y: 0 },

    // Line interaction
    lineStress: 0,

    // Game
    baseValue: template.baseValue * sizeData.valueMultiplier,

    // State
    attached: true,
  };
}
```

### 4.5 Fish AI Update

```javascript
function updateFishAI(fish, tension, deltaTime) {
  const temperament = TEMPERAMENT_MODIFIERS[fish.temperament];

  // Skip if fish is tired
  if (fish.state === "tired") {
    fish.currentForce = { x: 0, y: 0 };
    return;
  }

  // Update panic level based on tension
  if (tension > fish.panicThreshold) {
    const panicIncrease =
      (tension - fish.panicThreshold) * temperament.panicBuildRate * deltaTime;
    fish.panicLevel += panicIncrease;
  } else {
    const panicDecrease = temperament.panicDecayRate * 20 * deltaTime;
    fish.panicLevel -= panicDecrease;
  }
  fish.panicLevel = clamp(fish.panicLevel, 0, 100);

  // Update state based on panic
  if (fish.panicLevel > 50 && fish.state === "hooked") {
    fish.state = "fighting";
  } else if (fish.panicLevel < 20 && fish.state === "fighting") {
    fish.state = "hooked";
  }

  // Direction changes
  fish.directionChangeTimer -= deltaTime;
  if (fish.directionChangeTimer <= 0) {
    // Pick new random direction
    const angle = Math.random() * Math.PI * 2;
    fish.targetDirection = {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };

    // More panic = more frequent changes
    const panicFrequencyMod = 1 - (fish.panicLevel / 100) * 0.7;
    fish.directionChangeTimer =
      fish.directionChangeFrequency * panicFrequencyMod + Math.random() * 0.5;
  }

  // Calculate force magnitude
  const energyFactor = fish.energy / fish.maxEnergy;
  const panicFactor = fish.panicLevel / 100;
  const strengthWhenCalm = temperament.strengthWhenCalm;
  const strengthWhenPanicked = temperament.strengthWhenPanicked;
  const strengthFactor =
    strengthWhenCalm + (strengthWhenPanicked - strengthWhenCalm) * panicFactor;

  const forceMagnitude = fish.baseStrength * energyFactor * strengthFactor;

  // Apply force in target direction
  fish.currentForce = {
    x: fish.targetDirection.x * forceMagnitude,
    y: fish.targetDirection.y * forceMagnitude,
  };

  // Energy depletion when fighting
  if (fish.state === "fighting") {
    fish.energy -= temperament.energyDrainRate * 5 * deltaTime;
  }

  // Check for exhaustion
  if (fish.energy <= 0) {
    fish.energy = 0;
    fish.state = "tired";
    fish.currentForce = { x: 0, y: 0 };
  }
}
```

### 4.6 Line Stress System

For fish, instead of slip, we track line stress:

```javascript
function updateLineStress(fish, tension, equipment, deltaTime) {
  const pullForce = (tension / 100) * equipment.maxPullForce;
  const fishForce = magnitude(fish.currentForce);

  // Stress builds when forces oppose each other
  // Fish pulling away while you're pulling hard = high stress
  const pullDirection = normalize(subtract(getAvatarPosition(), fish.position));
  const fishDirection = normalize(fish.currentForce);
  const opposition = -dotProduct(pullDirection, fishDirection); // 1 = opposite, -1 = same

  if (opposition > 0) {
    // Forces are opposing
    const combinedForce = pullForce + fishForce * opposition;
    const stressGain =
      (combinedForce / equipment.lineStrength) * 10 * deltaTime;
    fish.lineStress += stressGain;
  } else {
    // Forces are aligned, stress decays
    fish.lineStress -= 5 * deltaTime;
  }

  fish.lineStress = Math.max(0, fish.lineStress);

  // Check for line break
  if (fish.lineStress >= 100) {
    return { lineSnapped: true };
  }

  return {
    lineSnapped: false,
    stressPercent: fish.lineStress,
  };
}
```

---

## Part 5: Wait Sequence (Fishing)

When using rod equipment, player must wait for a fish to bite before the drag phase begins.

### 5.1 Wait Phase State

```javascript
const WAIT_PHASE_STATE = {
  isWaiting: true,
  waitTime: 0,
  maxWaitTime: 0, // From equipment
  nibbleTimer: 0,
  nibbleCount: 0,
  biteOccurred: false,
};
```

### 5.2 Wait Phase Logic

```javascript
function initializeWaitPhase(equipment, castPosition) {
  const waitRange = equipment.waitTimeRange;
  const maxWait =
    waitRange.min + Math.random() * (waitRange.max - waitRange.min);

  return {
    isWaiting: true,
    waitTime: 0,
    maxWaitTime: maxWait,
    biteChancePerSecond: equipment.biteChancePerSecond,
    castPosition: { ...castPosition },
    nibbleTimer: 2 + Math.random() * 3, // First nibble after 2-5 seconds
    nibbleCount: 0,
    biteOccurred: false,
  };
}

function updateWaitPhase(waitState, deltaTime) {
  if (!waitState.isWaiting) return waitState;

  waitState.waitTime += deltaTime;

  // Check for timeout (no fish interested)
  if (waitState.waitTime >= waitState.maxWaitTime) {
    return {
      ...waitState,
      isWaiting: false,
      result: "timeout",
    };
  }

  // Nibble events (visual/audio feedback that fish are interested)
  waitState.nibbleTimer -= deltaTime;
  if (waitState.nibbleTimer <= 0 && waitState.nibbleCount < 3) {
    waitState.nibbleCount++;
    waitState.nibbleTimer = 1 + Math.random() * 2;

    // Trigger nibble event (for UI/audio)
    triggerNibbleEvent();
  }

  // Check for bite (only after at least one nibble)
  if (waitState.nibbleCount > 0) {
    const biteRoll = Math.random();
    if (biteRoll < waitState.biteChancePerSecond * deltaTime) {
      // Fish bites!
      return {
        ...waitState,
        isWaiting: false,
        biteOccurred: true,
        result: "bite",
      };
    }
  }

  return waitState;
}
```

### 5.3 Bite Event and Fish Spawn

```javascript
function handleBiteEvent(waitState, equipment, location) {
  // Determine fish species based on location and equipment
  const possibleFish = getPossibleFishForLocation(location);
  const species = selectRandomFish(possibleFish);

  // Determine size (weighted toward smaller)
  const size = rollFishSize(equipment);

  // Create fish at cast position
  const fish = createFish(species, size, waitState.castPosition);

  // Check if equipment can handle this fish
  const fishMass = fish.mass;
  const canHandle = fishMass <= equipment.struggleMassRange.max;

  if (!canHandle) {
    // Fish is too big, escapes immediately with dramatic effect
    return {
      success: false,
      reason: "too_big",
      fish, // Still return fish for UI feedback
    };
  }

  return {
    success: true,
    fish,
  };
}

function rollFishSize(equipment) {
  const roll = Math.random();

  // Better equipment increases trophy chance slightly
  const tierBonus = (equipment.tier - 1) * 0.02;

  if (roll < 0.5) return "small";
  if (roll < 0.8) return "medium";
  if (roll < 0.95 - tierBonus) return "large";
  return "trophy";
}
```

---

## Part 6: Integration - Game Phase Flow

### 6.1 Phase Definitions

```javascript
const GAME_PHASES = {
  IDLE: "idle", // Ready to cast
  CASTING: "casting", // Cast animation playing
  WAITING: "waiting", // Rod only: waiting for bite
  ATTACHING: "attaching", // Magnet settling, detecting item
  DRAG: "drag", // Main drag phase
  LIFT: "lift", // Vertical lift phase
  REVEAL: "reveal", // Item/fish revealed
  COMPLETE: "complete", // Retrieval complete
};
```

### 6.2 Phase Transition Logic

```javascript
function handlePhaseTransition(currentPhase, event, gameState) {
  const equipment = getEquippedEquipment();
  const equipmentCategory = EQUIPMENT_CATEGORIES[equipment.type];

  switch (currentPhase) {
    case GAME_PHASES.IDLE:
      if (event === "cast") {
        return {
          nextPhase: GAME_PHASES.CASTING,
          data: { targetPosition: gameState.castTarget },
        };
      }
      break;

    case GAME_PHASES.CASTING:
      if (event === "cast_complete") {
        if (equipmentCategory.requiresWait) {
          // Rod: go to waiting phase
          return {
            nextPhase: GAME_PHASES.WAITING,
            data: initializeWaitPhase(equipment, gameState.castTarget),
          };
        } else {
          // Magnet: go to attaching phase
          return {
            nextPhase: GAME_PHASES.ATTACHING,
            data: { landPosition: gameState.castTarget },
          };
        }
      }
      break;

    case GAME_PHASES.WAITING:
      if (event === "bite") {
        const biteResult = handleBiteEvent(
          gameState.waitState,
          equipment,
          gameState.location,
        );
        if (biteResult.success) {
          return {
            nextPhase: GAME_PHASES.DRAG,
            data: {
              target: biteResult.fish,
              targetType: "fish",
            },
          };
        } else {
          // Fish escaped
          return {
            nextPhase: GAME_PHASES.IDLE,
            data: { escaped: true, reason: biteResult.reason },
          };
        }
      }
      if (event === "timeout" || event === "cancel") {
        return { nextPhase: GAME_PHASES.IDLE };
      }
      break;

    case GAME_PHASES.ATTACHING:
      if (event === "item_found") {
        return {
          nextPhase: GAME_PHASES.DRAG,
          data: {
            target: gameState.attachedItem,
            targetType: "metallic",
          },
        };
      }
      if (event === "nothing_found") {
        return { nextPhase: GAME_PHASES.IDLE };
      }
      break;

    case GAME_PHASES.DRAG:
      if (event === "reached_shore") {
        return {
          nextPhase: GAME_PHASES.LIFT,
          data: { target: gameState.currentTarget },
        };
      }
      if (
        event === "detached" ||
        event === "escaped" ||
        event === "line_snapped"
      ) {
        return {
          nextPhase: GAME_PHASES.IDLE,
          data: { failureReason: event },
        };
      }
      break;

    case GAME_PHASES.LIFT:
      if (event === "lift_complete") {
        return {
          nextPhase: GAME_PHASES.REVEAL,
          data: { target: gameState.currentTarget },
        };
      }
      if (event === "dropped") {
        return {
          nextPhase: GAME_PHASES.IDLE,
          data: { dropped: true },
        };
      }
      break;

    case GAME_PHASES.REVEAL:
      if (event === "collected") {
        return {
          nextPhase: GAME_PHASES.COMPLETE,
          data: { target: gameState.currentTarget },
        };
      }
      break;

    case GAME_PHASES.COMPLETE:
      if (event === "continue") {
        return { nextPhase: GAME_PHASES.IDLE };
      }
      break;
  }

  return null; // No transition
}
```

---

## Part 7: UI Feedback Requirements

### 7.1 Tension Bar (Vertical)

Display requirements:

- Vertical bar showing 0-100% tension
- Color zones: Grey (0-40%), Green (40-75%), Red (75-100%)
- Current tension indicator
- Smooth animation following tension value

### 7.2 Heat/Pressure Indicator

Display requirements:

- Only visible when heat > 0
- Pulses faster as heat approaches 100%
- Visual warning (screen edge glow, bar flash) at high heat

### 7.3 Equipment-Specific Indicators

**Magnet mode:**

- Slip meter (0-100% of slip limit)
- Color zones: Green (0-50%), Yellow (50-80%), Red (80-100%)
- Attachment point indicator (optional: center/edge/corner icon)

**Rod mode:**

- Line stress meter (0-100%)
- Fish energy indicator (shows how tired the fish is)
- Fish panic indicator (optional: shows fish behavior state)

### 7.4 Wait Phase Indicators (Rod only)

- Bobber/float visual at cast position
- Nibble animation when fish are interested
- Bite alert (visual + audio) when fish bites

### 7.5 Speed/Feedback

- Speed lines or water trail behind moving item/fish
- Item/fish sprite movement in world space
- Rope visual connecting avatar to target

---

## Part 8: Audio Hooks

Events that should trigger audio:

**Tension/Drag:**

- Tension zone changes (enter working, enter redline)
- Heat building (escalating whine)
- Item moving through water (whoosh intensity based on speed)

**Magnet:**

- Magnet attach sound
- Slip warning (when approaching limit)
- Detachment sound

**Fishing:**

- Cast splash
- Nibble sounds (small splashes)
- Bite alert (dramatic)
- Fish fighting (splashing, thrashing)
- Line stress warning
- Line snap sound
- Fish landed celebration

**Current/Environment:**

- Current flow ambient
- Current surge warning

---

## Part 9: Implementation Notes

### 9.1 Frame Rate Independence

All physics calculations must use deltaTime:

```javascript
velocity += acceleration * deltaTime;
position += velocity * deltaTime;
```

### 9.2 Vector Utility Functions Needed

```javascript
function magnitude(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function normalize(v) {
  const mag = magnitude(v);
  if (mag < 0.0001) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(v, s) {
  return { x: v.x * s, y: v.y * s };
}

function dotProduct(a, b) {
  return a.x * b.x + a.y * b.y;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
```

### 9.3 State Management

The physics system should expose:

- Current tension
- Current target (item or fish)
- Target position and velocity
- Equipment-specific metrics (slip or line stress)
- Heat level

These should integrate with the existing Zustand store pattern.

### 9.4 Testing Approach

1. First implement core physics with a test item (fixed mass, dragFactor)
2. Verify tension builds and decays correctly
3. Verify item moves toward avatar with appropriate acceleration
4. Verify terminal velocity emerges naturally
5. Then add equipment switching
6. Then add fish AI
7. Then add wait sequence

---

## Summary

This system provides:

1. **Pure physics simulation** - no arbitrary caps, behavior emerges from forces
2. **Two equipment types** - magnet (passive targets) and rod (active fish AI)
3. **Upgradeable equipment** - three tiers each with different capabilities
4. **Fish AI** - temperament-based behavior, energy/panic systems
5. **Wait sequence** - fishing requires patience before drag phase
6. **Equipment-appropriate failure modes** - slip for magnets, line stress for fish

The core physics engine is shared. The difference between equipment types is:

- What forces are in play (fish add their own)
- What failure mode applies (slip vs line stress)
- Whether a wait phase is needed
