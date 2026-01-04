import { createNoise2D } from "simplex-noise";
import { create } from "zustand";

export enum TileType {
  GRASS = 0,
  DIRT = 1,
  WATER = 2,
  STONE = 3,
}

const TILE_SIZE = 64

export enum ObjectType {
  TREE = "tree",
  ROCK = "rock",
  BUSH = "bush",
  FENCE = "fence",
  CROP = "crop",
}

export interface GameObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  solid: boolean;
  growthStage?: number;
}

// Object sprite coordinates from the sprite sheet
export interface SpriteData {
  sheet: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const OBJECT_SPRITES: Record<ObjectType, SpriteData> = {
  [ObjectType.TREE]: { 
    sheet: '/assets/objects/objects.png', 
    x: 220, y: 0, // Top-left area, row 3 (0-indexed)
    width: 96, height: 96 
  },
  [ObjectType.ROCK]: { 
    sheet: '/assets/objects/objects.png', 
    x: 0, y: 112, // Medium rock
    width: 48, height: 32 
  },
  [ObjectType.BUSH]: { 
    sheet: '/assets/objects/objects.png', 
    x: 0, y: 96, // Small green bush bottom-left
    width: 16, height: 16 
  },
  [ObjectType.CROP]: { 
    sheet: '/assets/objects/objects.png', 
    x: 96, y: 128, // Yellow bush as crop
    width: 32, height: 32 
  },
  [ObjectType.FENCE]: { 
    sheet: '/assets/objects/objects.png', 
    x: 96, y: 192, // Placeholder
    width: 16, height: 16 
  },
};
export const TILE_IMAGES = {
  [TileType.GRASS]: "/assets/grass2.png",
  [TileType.DIRT]: "/assets/sand.png",
  // [TileType.DIRT]: "/assets/dirt.png",
  [TileType.STONE]: "/assets/GrassTile.png",
  [TileType.WATER]: "/assets/water.png",
};

interface GameState {
  worldMap: TileType[][];
  objects: GameObject[];
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

const generateGameObjects = (
  worldMap: TileType[][],
  tileSize: number
): GameObject[] => {
  const objects: GameObject[] = [];
  let width = worldMap.length;
  let height = worldMap[0].length;

  const treeNoise = createNoise2D();

  let objectId = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = worldMap[y][x];
      // Trees on grass (forests)
      if (tile === TileType.GRASS) {
        const treeChance = treeNoise(x * 0.2, y * 0.2);
        if (treeChance > 0.6 && treeChance < 0.65) {
          objects.push({
            id: `obj_${objectId++}`,
            type: ObjectType.TREE,
            x: x * tileSize,
            y: y * tileSize,
            solid: true,
          });
        }
      }
    }
  }

  return objects;
};

export const useGameStore = create<GameState>((set) => {
  const worldMap = generateRealisticWorld(150, 150);
  const objects = generateGameObjects(worldMap, TILE_SIZE);

  return {
    worldMap,
    objects,
    generateWorld(width, height) {
      const newMap = generateRealisticWorld(width, height);
      const newObjects = generateGameObjects(worldMap, TILE_SIZE);
      set({ worldMap: newMap, objects: newObjects });
    },
    addObjects: (obj: GameObject) =>
      set((state) => ({
        objects: [...state.objects, obj],
      })),
    removeObjets: (id: string) =>
      set((state) => ({
        objects: state.objects.filter((object: GameObject) => object.id !== id),
      })),
  };
});
