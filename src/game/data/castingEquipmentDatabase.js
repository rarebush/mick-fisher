export const CASTING_EQUIPMENT = [
  {
    id: "hand",
    label: "Hand Throw",
    minAccuracyRadius: 0,
    maxAccuracyRadius: 24,
    aspectRatioX: 1,
    aspectRatioY: 1,
  },
  {
    id: "slingshot",
    label: "Slingshot",
    minAccuracyRadius: 6,
    maxAccuracyRadius: 42,
    aspectRatioX: 1.35,
    aspectRatioY: 0.75,
  },
  {
    id: "catapult",
    label: "Catapult",
    minAccuracyRadius: 12,
    maxAccuracyRadius: 70,
    aspectRatioX: 0.8,
    aspectRatioY: 1.25,
  },
  {
    id: "counterweight-rig",
    label: "Counterweight Rig",
    minAccuracyRadius: 10,
    maxAccuracyRadius: 58,
    aspectRatioX: 1.6,
    aspectRatioY: 0.6,
  },
  {
    id: "training-reel",
    label: "Training Reel",
    minAccuracyRadius: 4,
    maxAccuracyRadius: 36,
    aspectRatioX: 0.65,
    aspectRatioY: 1.45,
  },
];

export function getCastingEquipmentById(id) {
  return (
    CASTING_EQUIPMENT.find((equipment) => equipment.id === id) ||
    CASTING_EQUIPMENT[0]
  );
}
