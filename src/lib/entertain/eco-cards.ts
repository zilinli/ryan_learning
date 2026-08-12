/**
 * Eco Tower — organism card data.
 * Trophic levels and food chain info for ecosystem simulation.
 */

export type TrophicLevel = "producer" | "primary_consumer" | "secondary_consumer" | "tertiary_consumer" | "apex_predator";

export type OrganismCard = {
  id: string;
  name: string;
  trophicLevel: TrophicLevel;
  /** Organism ids this one eats */
  eats: string[];
  /** Which biome it belongs to */
  biome: string;
  emoji: string;
};

export const ORGANISMS: OrganismCard[] = [
  // Grassland biome
  { id: "grass", name: "Grass", trophicLevel: "producer", eats: [], biome: "grassland", emoji: "🌱" },
  { id: "grasshopper", name: "Grasshopper", trophicLevel: "primary_consumer", eats: ["grass"], biome: "grassland", emoji: "🦗" },
  { id: "mouse", name: "Mouse", trophicLevel: "primary_consumer", eats: ["grass"], biome: "grassland", emoji: "🐁" },
  { id: "snake", name: "Snake", trophicLevel: "secondary_consumer", eats: ["mouse", "grasshopper"], biome: "grassland", emoji: "🐍" },
  { id: "hawk", name: "Hawk", trophicLevel: "apex_predator", eats: ["snake", "mouse"], biome: "grassland", emoji: "🦅" },

  // Forest biome
  { id: "tree", name: "Oak Tree", trophicLevel: "producer", eats: [], biome: "forest", emoji: "🌳" },
  { id: "caterpillar", name: "Caterpillar", trophicLevel: "primary_consumer", eats: ["tree"], biome: "forest", emoji: "🐛" },
  { id: "squirrel", name: "Squirrel", trophicLevel: "primary_consumer", eats: ["tree"], biome: "forest", emoji: "🐿" },
  { id: "owl", name: "Owl", trophicLevel: "secondary_consumer", eats: ["caterpillar", "squirrel"], biome: "forest", emoji: "🦉" },
  { id: "fox", name: "Fox", trophicLevel: "tertiary_consumer", eats: ["squirrel", "owl"], biome: "forest", emoji: "🦊" },

  // Ocean biome
  { id: "algae", name: "Phytoplankton", trophicLevel: "producer", eats: [], biome: "ocean", emoji: "🟢" },
  { id: "krill", name: "Krill", trophicLevel: "primary_consumer", eats: ["algae"], biome: "ocean", emoji: "🦐" },
  { id: "fish", name: "Small Fish", trophicLevel: "secondary_consumer", eats: ["krill"], biome: "ocean", emoji: "🐟" },
  { id: "seal", name: "Seal", trophicLevel: "tertiary_consumer", eats: ["fish"], biome: "ocean", emoji: "🦭" },
  { id: "orca", name: "Orca", trophicLevel: "apex_predator", eats: ["seal", "fish"], biome: "ocean", emoji: "🐋" },

  // Desert biome
  { id: "cactus", name: "Cactus", trophicLevel: "producer", eats: [], biome: "desert", emoji: "🌵" },
  { id: "ant", name: "Ant", trophicLevel: "primary_consumer", eats: ["cactus"], biome: "desert", emoji: "🐜" },
  { id: "lizard", name: "Lizard", trophicLevel: "secondary_consumer", eats: ["ant"], biome: "desert", emoji: "🦎" },
  { id: "scorpion", name: "Scorpion", trophicLevel: "secondary_consumer", eats: ["ant", "lizard"], biome: "desert", emoji: "🦂" },
  { id: "vulture", name: "Vulture", trophicLevel: "apex_predator", eats: ["lizard", "scorpion"], biome: "desert", emoji: "🦅" },
];

/** Get organisms by biome */
export function organismsByBiome(biome: string): OrganismCard[] {
  return ORGANISMS.filter((o) => o.biome === biome);
}

/** Get all available biomes */
export const BIOMES = ["grassland", "forest", "ocean", "desert"] as const;

export function pickBiome(): string {
  return BIOMES[Math.floor(Math.random() * BIOMES.length)];
}
