"use client";

import { useEffect, useRef, useState } from "react";
import useKeyboard from "../hooks/useKeyboard";
import { OBJECT_SPRITES, ObjectType, TILE_IMAGES, TileType, useGameStore } from "../store/gameStore";

export const TILE_SIZE = 64;
const PLAYER_SIZE = 64;
const PLAYER_SPEED = 4; // Pixels per frame
const SPRINT_SPEED = 6;

// Player animation configuration
const SPRITE_SIZE = 32; // Size of each sprite in the sheet
const ANIMATION_SPEED = 8; // Lower = faster animation

const SOLID_TILES = new Set([TileType.WATER, TileType.STONE]);

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysPressed = useKeyboard();
  const worldMap = useGameStore((state) => state.worldMap);
  const objects = useGameStore((state) => state.objects);
  const objectSpriteSheetRef = useRef<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const tileImagesRef = useRef<Record<TileType, HTMLImageElement>>({} as any);
  const playerImageRef = useRef<HTMLImageElement | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const cameraRef = useRef({ x: 0, y: 0 });
  const playerPositionRef = useRef({
    x: 400,
    y: 300,
  });

  // Animation state
  const playerDirectionRef = useRef<"down" | "up" | "left" | "right">("down");
  const animationFrameRef = useRef(0);
  const frameCounterRef = useRef(0);

  useEffect(() => {
    const loadImages = async () => {
      const imagePromises = Object.entries(TILE_IMAGES).map(([type, src]) => {
        return new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.src = src;
          img.onload = () => {
            tileImagesRef.current[type as unknown as TileType] = img;
            resolve();
          };
          img.onerror = reject;
        });
      });

      const playerPromise = new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.src = "/assets/characters.png";
        img.onload = () => {
          playerImageRef.current = img;
          resolve();
        };
        img.onerror = reject;
      });

      const objectSheetPromise = new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.src = '/assets/objects/objects.png';
        img.onload = () => {
          objectSpriteSheetRef.current = img;
          resolve();
        };
        img.onerror = reject;
      });



      try {
        await Promise.all([...imagePromises, playerPromise, objectSheetPromise]);
        setImagesLoaded(true);
        console.log("All tile images loaded!");
      } catch (error) {
        console.error("Failed to load images:", error);
      }
    };
    loadImages();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    handleResize();
    playerPositionRef.current = {
      x: window.innerWidth / 2 + PLAYER_SIZE / 2,
      y: window.innerHeight / 2 + PLAYER_SIZE / 2,
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const WORLD_WIDTH = worldMap[0].length * TILE_SIZE;
    const WORLD_HEIGHT = worldMap.length * TILE_SIZE;

    const checkTileCollision = (x: number, y: number) => {
      // Player visual size is 48x48, but hitbox should be smaller
      // Based on your sprite, the body looks like it's:
      // - Starts about 24px down from top (skip the hair)
      // - About 32px wide, centered horizontally (8px margin on each side)
      // - About 24px tall (from shoulders to feet)

      const hitboxOffsetX = 24; // Start 8px from left
      const hitboxOffsetY = 24; // Start 24px from top (below hair)
      const hitboxWidth = 32; // 32px wide
      const hitboxHeight = 24; // 24px tall

      const corners = [
        { x: x + hitboxOffsetX, y: y + hitboxOffsetY }, // Top-left of body
        { x: x + hitboxOffsetX + hitboxWidth - 1, y: y + hitboxOffsetY }, // Top-right of body
        { x: x + hitboxOffsetX, y: y + hitboxOffsetY + hitboxHeight - 1 }, // Bottom-left (feet)
        {
          x: x + hitboxOffsetX + hitboxWidth - 1,
          y: y + hitboxOffsetY + hitboxHeight - 1,
        }, // Bottom-right (feet)
      ];

      for (const corner of corners) {
        let tileX = Math.floor(corner.x / TILE_SIZE);
        let tileY = Math.floor(corner.y / TILE_SIZE);
        if (
          tileY >= 0 &&
          tileY < worldMap.length &&
          tileX >= 0 &&
          tileX < worldMap[0].length
        ) {
          const tile = worldMap[tileY][tileX];
          if (SOLID_TILES.has(tile)) return true;
        }
      }
      return false;
    };

    const checkObjectCollision = (x: number, y: number) => {
      const hitboxOffsetX = 8;
      const hitboxOffsetY = 24;
      const hitboxWidth = 32;
      const hitboxHeight = 24;

      const playerBounds = {
        x: x + hitboxOffsetX,
        y: y + hitboxOffsetY,
        width: hitboxWidth,
        height: hitboxHeight,
      };

      for (const obj of objects) {
        if (!obj.solid) continue;

        // Simple bounding box collision
        const objBounds = {
          x: obj.x,
          y: obj.y,
          width: TILE_SIZE,
          height: TILE_SIZE,
        };

        if (
          playerBounds.x < objBounds.x + objBounds.width &&
          playerBounds.x + playerBounds.width > objBounds.x &&
          playerBounds.y < objBounds.y + objBounds.height &&
          playerBounds.y + playerBounds.height > objBounds.y
        ) {
          return true;
        }
      }

      return false;
    };

    const checkCollision = (x: number, y: number) => {
      return checkTileCollision(x, y) || checkObjectCollision(x, y);
    };

    let animationFrameId: number;

    const gameLoop = () => {
      const playerPosition = playerPositionRef.current;
      const camera = cameraRef.current;

      let oldX = playerPosition.x;
      let oldY = playerPosition.y;

      let newX = playerPosition.x;
      let newY = playerPosition.y;

      let isMoving = false;
      let isRunning = false;
      if (keysPressed.current.has("shift")) {
        isRunning = true;
      }
      if (keysPressed.current.has("w") || keysPressed.current.has("arrowup")) {
        playerPosition.y -= isRunning ? SPRINT_SPEED : PLAYER_SPEED;
        playerDirectionRef.current = "up";
        isMoving = true;
      }
      if (
        keysPressed.current.has("s") ||
        keysPressed.current.has("arrowdown")
      ) {
        playerPosition.y += isRunning ? SPRINT_SPEED : PLAYER_SPEED;
        playerDirectionRef.current = "down";
        isMoving = true;
      }
      if (
        keysPressed.current.has("a") ||
        keysPressed.current.has("arrowleft")
      ) {
        playerPosition.x -= isRunning ? SPRINT_SPEED : PLAYER_SPEED;
        playerDirectionRef.current = "left";
        isMoving = true;
      }
      if (
        keysPressed.current.has("d") ||
        keysPressed.current.has("arrowright")
      ) {
        playerPosition.x += isRunning ? SPRINT_SPEED : PLAYER_SPEED;
        playerDirectionRef.current = "right";
        isMoving = true;
      }

      // Update animation
      if (isMoving) {
        frameCounterRef.current++;
        if (frameCounterRef.current >= ANIMATION_SPEED) {
          frameCounterRef.current = 0;
          animationFrameRef.current = (animationFrameRef.current + 1) % 2; // Cycle through 3 frames
        }
      } else {
        animationFrameRef.current = 0; // Standing still = frame 0
        frameCounterRef.current = 0;
      }

      // Keep player within canvas bounds
      newX = Math.max(0, Math.min(playerPosition.x, WORLD_WIDTH - PLAYER_SIZE));
      newY = Math.max(
        0,
        Math.min(playerPosition.y, WORLD_HEIGHT - PLAYER_SIZE)
      );

      // Try moving both X and Y
      playerPosition.x = newX;
      playerPosition.y = newY;

      if (checkCollision(playerPosition.x, playerPosition.y)) {
        playerPosition.y = oldY;
        
        if (checkCollision(playerPosition.x, playerPosition.y)) {
          playerPosition.x = oldX;
          playerPosition.y = newY;
          
          if (checkCollision(playerPosition.x, playerPosition.y)) {
            playerPosition.y = oldY;
          }
        }
      }

      camera.x = playerPosition.x - canvasSize.width / 2 + TILE_SIZE / 2;
      camera.y = playerPosition.y - canvasSize.height / 2 + TILE_SIZE / 2;

      camera.x = Math.max(
        0,
        Math.min(camera.x, WORLD_WIDTH - canvasSize.width)
      );
      camera.y = Math.max(
        0,
        Math.min(camera.y, WORLD_HEIGHT - canvasSize.height)
      );

      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

      const startTileX = Math.floor(camera.x / TILE_SIZE);
      const startTileY = Math.floor(camera.y / TILE_SIZE);
      const endTileX = Math.min(
        startTileX + Math.ceil(canvasSize.width / TILE_SIZE) + 1,
        worldMap[0].length
      );
      const endTileY = Math.min(
        startTileY + Math.ceil(canvasSize.height / TILE_SIZE) + 1,
        worldMap.length
      );

      for (let y = startTileY; y < endTileY; y++) {
        for (let x = startTileX; x < endTileX; x++) {
          let tile = worldMap[y][x];

          const screenX = x * TILE_SIZE - camera.x;
          const screenY = y * TILE_SIZE - camera.y;

          const tileImage = tileImagesRef.current[tile];
          if (tileImage) {
            // Adjusting the source images because all have diff sizes and required portions lie in different places

            let sourceX = 0,
              sourceY = 0,
              sourceSize = 16;

            if (tile === TileType.GRASS) {
              sourceX = 12;
              sourceY = 12;
              sourceSize = 32;
            }
            if (tile === TileType.STONE) {
              sourceX = 68;
              sourceY = 2;
              sourceSize = 24;
            }

            if (tile === TileType.DIRT) {
              sourceX = 3;
              sourceY = 3;
              sourceSize = 42;
            }

            ctx.drawImage(
              tileImage,
              sourceX,
              sourceY,
              sourceSize,
              sourceSize,
              screenX,
              screenY,
              TILE_SIZE,
              TILE_SIZE
            );
          }
          // Draw tile border for grid effect
          // ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
          // ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }
      }

      

      const playerPositionX = playerPosition.x - camera.x;
      const playerPositionY = playerPosition.y - camera.y;

      //  player
      if (playerImageRef.current) {
        // 2nd character starts at column 4 (X = 4 * 16 = 64)
        const characterStartCol = 4;
        // const characterStartCol = 7; //For Girl Character and other cols for other characters

        let spriteX = 0;
        let spriteY = 0;

        const direction = playerDirectionRef.current;
        const frame = Math.min(animationFrameRef.current, 2);

        // Character layout:
        // Row 0 (Y=0):  down/front frames at columns 4,5,6
        // Row 1 (Y=16): left frames at columns 4,5,6
        // Row 2 (Y=32): right frames at columns 4,5,6
        // Row 3 (Y=48): up/back frames at columns 4,5,6

        if (direction === "down") {
          spriteX = (characterStartCol + frame) * 16; // Columns 4,5,6
          spriteY = 0; // Row 0
        } else if (direction === "left") {
          spriteX = (characterStartCol + frame) * 16; // Columns 4,5,6
          spriteY = 16; // Row 1
        } else if (direction === "right") {
          spriteX = (characterStartCol + frame) * 16; // Columns 4,5,6
          spriteY = 32; // Row 2
        } else if (direction === "up") {
          spriteX = (characterStartCol + frame) * 16; // Columns 4,5,6
          spriteY = 48; // Row 3
        }

        ctx.drawImage(
          playerImageRef.current,
          spriteX,
          spriteY,
          16,
          16,
          playerPositionX,
          playerPositionY,
          PLAYER_SIZE,
          PLAYER_SIZE
        );
      }

      if (objectSpriteSheetRef.current) {
        for (const obj of objects) {
          const screenX = obj.x - camera.x;
          const screenY = obj.y - camera.y;

          // Only draw if visible
          if (
            screenX + TILE_SIZE < 0 ||
            screenX > canvasSize.width ||
            screenY + TILE_SIZE < 0 ||
            screenY > canvasSize.height
          ) {
            continue;
          }

          const sprite = OBJECT_SPRITES[obj.type];
          let objectSize = TILE_SIZE;
          let objectOffsetX = 0;
          let objectOffsetY = 0;
          if(obj.type === ObjectType.TREE){
            objectSize = 192;
            objectOffsetX = -objectSize/2 + 32;
            objectOffsetY = -objectSize/2 - 40;
          }
          if(obj.type === ObjectType.ROCK){
            objectSize = 0;
            objectOffsetX = -objectSize/2 +16;
            objectOffsetY = -objectSize/2 + 16;
          }
          if(obj.type === ObjectType.BUSH){
            objectSize = 0;
            objectOffsetX = -objectSize/2;
            objectOffsetY = -objectSize/2;
          }
          if(obj.type === ObjectType.CROP){
            objectSize = 0;
            objectOffsetX = -objectSize/2;
            objectOffsetY = -objectSize/2;
          }
          if(obj.type === ObjectType.FENCE){
            objectSize = 0;
            objectOffsetX = -objectSize/2;
            objectOffsetY = -objectSize/2;
          }
          if(obj.type === ObjectType.TREE){
            ctx.drawImage(
              objectSpriteSheetRef.current,
              sprite.x, sprite.y, sprite.width, sprite.height, // Source from sheet
              screenX+objectOffsetX, screenY+objectOffsetY, objectSize, objectSize // Draw at tile size
            );
          }
          
        }
      }
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [worldMap, canvasSize, keysPressed, imagesLoaded, objects]);
  // Show loading message while images load
  if (!imagesLoaded) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-900 text-white">
        <p>Loading assets...</p>
      </div>
    );
  }
  return (
    <canvas
      ref={canvasRef}
      width={canvasSize.width}
      height={canvasSize.height}
      className="block border-2 border-gray-800"
      tabIndex={0} // Makes canvas focusable for keyboard events
    />
  );
}
