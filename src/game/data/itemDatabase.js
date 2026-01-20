/**
 * Item Database
 * All retrievable items with their properties
 *
 * Properties:
 * - id: unique identifier
 * - name: display name
 * - weight: kg (affects tension build rate)
 * - slipRate: base slip rate multiplier (1.0 = normal)
 * - value: base monetary value
 * - rarity: spawn weight (higher = more common)
 * - surfaceCondition: affects slip ('clean' | 'rusty' | 'sludge')
 * - icon: emoji for UI display (temporary until sprites)
 * - description: flavor text
 */

export const ITEMS = {
  // Light items (0-10kg)
  "glass-bottle": {
    id: "glass-bottle",
    name: "Glass Bottle",
    weight: 2,
    slipRate: 1.8, // High slip - smooth surface
    value: 5,
    rarity: 100, // Very common
    surfaceCondition: "clean",
    icon: "🍾",
    description: "An empty glass bottle. Common litter in waterways.",
  },

  "tin-can": {
    id: "tin-can",
    name: "Tin Can",
    weight: 1,
    slipRate: 1.2, // Medium slip
    value: 3,
    rarity: 120,
    surfaceCondition: "rusty",
    icon: "🥫",
    description: "A rusty tin can. Probably held beans once.",
  },

  "old-boot": {
    id: "old-boot",
    name: "Old Boot",
    weight: 5,
    slipRate: 1.0, // Normal slip - textured surface
    value: 8,
    rarity: 80,
    surfaceCondition: "sludge",
    icon: "🥾",
    description: "A waterlogged boot. Someone's walking home unevenly.",
  },

  // Medium items (10-30kg)
  bicycle: {
    id: "bicycle",
    name: "Rusty Bicycle",
    weight: 15,
    slipRate: 0.8, // Lower slip - frame provides grip points
    value: 45,
    rarity: 40,
    surfaceCondition: "rusty",
    icon: "🚲",
    description:
      "An old bicycle. Wheels are bent, but the frame might be salvageable.",
  },

  "shopping-cart": {
    id: "shopping-cart",
    name: "Shopping Cart",
    weight: 25,
    slipRate: 0.6, // Low slip - wire frame, good grip
    value: 30,
    rarity: 50,
    surfaceCondition: "rusty",
    icon: "🛒",
    description: "A shopping cart. Someone really didn't want to return it.",
  },

  "traffic-cone": {
    id: "traffic-cone",
    name: "Traffic Cone",
    weight: 12,
    slipRate: 1.4, // Higher slip - smooth plastic
    value: 20,
    rarity: 60,
    surfaceCondition: "clean",
    icon: "🚧",
    description: "A bright orange traffic cone. How did this get here?",
  },

  // Heavy items (30-60kg)
  "metal-toolbox": {
    id: "metal-toolbox",
    name: "Metal Toolbox",
    weight: 35,
    slipRate: 0.9, // Medium slip
    value: 85,
    rarity: 25,
    surfaceCondition: "rusty",
    icon: "🧰",
    description:
      "A heavy metal toolbox. Locked shut - might contain tools inside.",
  },

  "car-wheel": {
    id: "car-wheel",
    name: "Car Wheel",
    weight: 45,
    slipRate: 0.7, // Lower slip - rim has edges
    value: 60,
    rarity: 30,
    surfaceCondition: "rusty",
    icon: "🛞",
    description:
      "A complete car wheel with tire. Someone's vehicle is missing a wheel.",
  },

  "metal-chair": {
    id: "metal-chair",
    name: "Metal Chair",
    weight: 32,
    slipRate: 0.8, // Lower slip - legs provide grip
    value: 40,
    rarity: 35,
    surfaceCondition: "rusty",
    icon: "🪑",
    description:
      "A rusty metal chair. Seen better days, but still structurally sound.",
  },

  // Rare/Valuable items
  "safe-small": {
    id: "safe-small",
    name: "Small Safe",
    weight: 50,
    slipRate: 0.5, // Very low slip - heavy, good grip
    value: 200, // Base value, contents add more
    rarity: 8, // Rare
    surfaceCondition: "rusty",
    icon: "🔒",
    description:
      "A small safe! Locked tight. This could contain something valuable...",
    container: true,
    containerLoot: ["money-bundle", "jewelry", "documents", "empty"],
  },

  "antique-lamp": {
    id: "antique-lamp",
    name: "Antique Lamp",
    weight: 18,
    slipRate: 1.3, // Higher slip - decorative surface
    value: 150,
    rarity: 12,
    surfaceCondition: "sludge",
    icon: "🪔",
    description:
      "An ornate antique lamp. Might be worth something to a collector.",
  },

  "vintage-radio": {
    id: "vintage-radio",
    name: "Vintage Radio",
    weight: 22,
    slipRate: 1.1, // Medium slip
    value: 120,
    rarity: 15,
    surfaceCondition: "rusty",
    icon: "📻",
    description:
      "A vintage radio from the 1950s. Waterlogged, but might still have value.",
  },

  // Heavy junk
  "engine-block": {
    id: "engine-block",
    name: "Engine Block",
    weight: 65,
    slipRate: 0.4, // Very low slip - lots of grip points
    value: 80,
    rarity: 10,
    surfaceCondition: "rusty",
    icon: "⚙️",
    description:
      "A massive engine block. Heavy as hell, but scrap metal is worth something.",
  },

  anchor: {
    id: "anchor",
    name: "Small Anchor",
    weight: 55,
    slipRate: 0.6, // Low slip
    value: 95,
    rarity: 10,
    surfaceCondition: "rusty",
    icon: "⚓",
    description: "A small boat anchor. Someone's boat is drifting somewhere.",
  },

  "street-sign": {
    id: "street-sign",
    name: "Street Sign",
    weight: 28,
    slipRate: 0.9, // Medium slip
    value: 35,
    rarity: 40,
    surfaceCondition: "rusty",
    icon: "🪧",
    description: "A bent street sign. Probably flew off in a storm.",
  },
};

// Helper function to get item by ID
export const getItem = (itemId) => ITEMS[itemId];

// Helper function to get all items as array
export const getAllItems = () => Object.values(ITEMS);

// Helper function to get items by rarity threshold
export const getItemsByRarity = (minRarity = 0) => {
  return Object.values(ITEMS).filter((item) => item.rarity >= minRarity);
};
