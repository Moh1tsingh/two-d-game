import { createNoise2D } from "simplex-noise";
import { create } from "zustand";

export enum TileType {
  GRASS = 0,
  DIRT = 1,
  WATER = 2,
  STONE = 3,
}

export const TILE_IMAGES = {
  [TileType.GRASS]: "/assets/grass2.png",
  [TileType.DIRT]: "/assets/dirt.png",
  [TileType.STONE]: "/assets/rock.png",
  [TileType.WATER]: "/assets/water.png",
};

interface GameState {
  worldMap: TileType[][];
  generateWorld: (width: number, height: number) => void;
}

const WORLD_SIZE_TILE_WIDTH = 150;
const WORLD_SIZE_TILE_HEIGHT = 150;

const generateRealisticWorld = (
  width: number,
  height: number
): TileType[][] => {
  const map: TileType[][] = [];

  // Create noise function (this generates smooth, natural-looking values)
  const elevationNoise = createNoise2D();
  const moistureNoise = createNoise2D();
  const riverNoise = createNoise2D();

  for (let y = 0; y < height; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < width; x++) {
      // Get noise value (-1 to 1) for this position
      const elevation = elevationNoise(x * 0.05, y * 0.05);
      const moisture = moistureNoise(x * 0.1, y * 0.1);
      const river = riverNoise(x * 0.15, y * 0.02);
      // Convert noise to tile types
      // Different thresholds = different terrain
      let tile: TileType;
      // Create rivers (thin water features)
      if (river > 0.35 && river < 0.45) {
        tile = TileType.WATER;
      }
      // Create lakes (large water bodies in low areas)
      else if (elevation < -0.25) {
        tile = TileType.WATER;
      }
      // Stone mountains (high elevation)
      else if (elevation > 0.5) {
        tile = TileType.STONE;
      }
      // Dirt paths/beaches (medium-low elevation, near water)
      else if (elevation < 0.1 && moisture < 0) {
        tile = TileType.DIRT;
      }
      // Grass (everything else)
      else {
        tile = TileType.GRASS;
      }
      row.push(tile);
    }
    map.push(row);
  }

  // Second pass: Smooth out single-tile irregularities (optional but makes it cleaner)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const current = map[y][x];

      // Count neighbors of same type
      let sameNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (map[y + dy][x + dx] === current) sameNeighbors++;
        }
      }

      // If very isolated, change to most common neighbor
      if (sameNeighbors <= 2 && current !== TileType.WATER) {
        // Simple smoothing: change to grass if isolated
        map[y][x] = TileType.GRASS;
      }
    }
  }

  return map;
};

export const useGameStore = create<GameState>((set) => ({
  worldMap: generateRealisticWorld(
    WORLD_SIZE_TILE_WIDTH,
    WORLD_SIZE_TILE_HEIGHT
  ), //25x19 for 800x600  for Bigger world kind of infinite wala scene -> 50x50
  generateWorld: (width, height) =>
    set({ worldMap: generateRealisticWorld(width, height) }),
}));
