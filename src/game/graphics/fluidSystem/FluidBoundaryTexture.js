/**
 * FluidBoundaryTexture.js
 * Renders water object mask sprites to an off-screen texture for particle collision detection.
 * The boundary texture acts as a collision map where particles bounce off sprite masks.
 * Uses SCREEN SPACE coordinates matching the isometric projection used for particle rendering.
 */

import {
  RenderTexture,
  Graphics,
  Container,
  Sprite,
  Mesh,
  Geometry,
} from "pixi.js";
import { projectToScreen, screenToWorld } from "../../mechanics/projection.js";
import { WORLD_X, WORLD_Y, WORLD_Z } from "../../mechanics/worldConstants.js";

export class FluidBoundaryTexture {
  /**
   * @param {Object} config
   * @param {number} config.width - Texture width in pixels (matches velocity field resolution)
   * @param {number} config.height - Texture height in pixels
   * @param {import("pixi.js").Renderer} config.renderer - PixiJS renderer
   * @param {import("pixi.js").Container} config.waterObjectMasksContainer - Container with mask sprites
   * @param {Object} config.viewport - Viewport for world-to-screen projection
   * @param {import("pixi.js").Container} config.debugContainer - Optional container for debug visualization
   */
  constructor(config) {
    this.width = config.width;
    this.height = config.height;
    this.renderer = config.renderer;
    this.waterObjectMasksContainer = config.waterObjectMasksContainer;
    this.viewport = config.viewport;
    this.debugContainer = config.debugContainer;

    // Calculate actual screen bounds of water surface by projecting world bounds
    this.screenBounds = this._calculateWaterSurfaceScreenBounds();

    // Create off-screen render texture for boundaries
    this.boundaryTexture = RenderTexture.create({
      width: this.width,
      height: this.height,
    });

    // Cache for pixel data (CPU-based collision detection)
    this.pixelData = null;

    // Debug sprite to visualize boundary texture on screen
    this.debugSprite = null;

    // Initialize boundary texture asynchronously
    this._initializeAsync();
  }

  /**
   * Calculate screen bounds of the water surface area.
   * Projects the four corners of the water world bounds to screen space.
   * @private
   * @returns {{minX: number, maxX: number, minY: number, maxY: number, width: number, height: number}}
   */
  _calculateWaterSurfaceScreenBounds() {
    // Project four corners of water surface world bounds
    const corners = [
      projectToScreen(
        WORLD_X.MIN,
        WORLD_Y.WATER_NEAR,
        WORLD_Z.WATER_SURFACE,
        this.viewport,
      ),
      projectToScreen(
        WORLD_X.MAX,
        WORLD_Y.WATER_NEAR,
        WORLD_Z.WATER_SURFACE,
        this.viewport,
      ),
      projectToScreen(
        WORLD_X.MIN,
        WORLD_Y.WATER_FAR,
        WORLD_Z.WATER_SURFACE,
        this.viewport,
      ),
      projectToScreen(
        WORLD_X.MAX,
        WORLD_Y.WATER_FAR,
        WORLD_Z.WATER_SURFACE,
        this.viewport,
      ),
    ];

    // Find min/max screen coordinates
    const minX = Math.min(...corners.map((c) => c.x));
    const maxX = Math.max(...corners.map((c) => c.x));
    const minY = Math.min(...corners.map((c) => c.y));
    const maxY = Math.max(...corners.map((c) => c.y));

    // Debug: Show where local center (0,0) maps to in UV space
    console.log(
      "[FluidBoundary] Local surface (0,0) maps to UV(0.5, 0.5) | bounds: " +
        (maxX - minX).toFixed(0) +
        "x" +
        (maxY - minY).toFixed(0),
    );

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Initialize boundary texture and extract pixel data.
   * @private
   */
  async _initializeAsync() {
    await this._renderBoundaries();
  }

  /**
   * Render water object mask sprites to the boundary texture.
   * Creates a collision map where white = obstacle, black = free space.
   * @private
   */
  async _renderBoundaries() {
    if (
      !this.waterObjectMasksContainer ||
      this.waterObjectMasksContainer.children.length === 0
    ) {
      // Create empty white texture (no obstacles)
      const graphics = new Graphics();
      graphics.rect(0, 0, this.width, this.height);
      graphics.fill({ color: 0xffffff, alpha: 1.0 }); // WHITE = clear
      this.renderer.render({
        container: graphics,
        target: this.boundaryTexture,
      });
      graphics.destroy();
      return;
    }

    // CRITICAL: Clear texture to WHITE first (white = no obstacle, black = obstacle)
    const clearGraphics = new Graphics();
    clearGraphics.rect(0, 0, this.width, this.height);
    clearGraphics.fill({ color: 0xffffff, alpha: 1.0 });
    this.renderer.render({
      container: clearGraphics,
      target: this.boundaryTexture,
    });
    clearGraphics.destroy();

    // Create a temporary container to render masks in texture UV space
    const renderContainer = new Container();

    console.log(
      "[FluidBoundary] Rendering",
      this.waterObjectMasksContainer.children.length,
      "masks to texture...",
    );

    // Debug: Draw circles at the four corners of the texture
    const cornerRadius = 10;
    const corners = [
      { x: cornerRadius, y: cornerRadius, label: "TL" }, // Top-left
      { x: this.width - cornerRadius, y: cornerRadius, label: "TR" }, // Top-right
      { x: cornerRadius, y: this.height - cornerRadius, label: "BL" }, // Bottom-left
      {
        x: this.width - cornerRadius,
        y: this.height - cornerRadius,
        label: "BR",
      }, // Bottom-right
    ];

    for (const corner of corners) {
      const circle = new Graphics();
      circle.circle(0, 0, cornerRadius);
      circle.fill({ color: 0xff0000, alpha: 1.0 }); // Red corners
      circle.x = corner.x;
      circle.y = corner.y;
      renderContainer.addChild(circle);
      console.log(`  Corner ${corner.label}: Tex(${corner.x}, ${corner.y})`);
    }

    // Render obstacle masks using local surface coordinates stored on each sprite
    for (const maskSprite of this.waterObjectMasksContainer.children) {
      // Use the worldPosition property that was set when the sprite was created
      // This contains LOCAL surface coordinates where (0,0) = center of water surface
      const localPos = maskSprite.worldPosition;

      if (
        !localPos ||
        !Number.isFinite(localPos.x) ||
        !Number.isFinite(localPos.y)
      ) {
        console.warn(
          "[FluidBoundary] Invalid or missing worldPosition on mask sprite",
        );
        continue;
      }

      // Convert local surface coordinates to UV texture coordinates
      // Local: (0,0) = center of water surface
      // UV: (0.5, 0.5) = center of texture
      // Water surface dimensions in world space
      const surfaceWidth = WORLD_X.MAX - WORLD_X.MIN; // 12 units
      const surfaceDepth = WORLD_Y.WATER_FAR - WORLD_Y.WATER_NEAR; // 8 units

      // Map from local surface coords (center = 0,0) to UV coords (center = 0.5,0.5)
      const localU = 0.5 + localPos.x / surfaceWidth; // -6 to +6 → 0 to 1
      const localV = 0.5 + localPos.y / surfaceDepth; // -4 to +4 → 0 to 1

      const texX = localU * this.width;
      const texY = localV * this.height;

      // Draw collision shape in world space
      // TODO: Get actual object size in world units - for now use a fixed radius
      const worldRadius = 0.5; // 0.5 world units radius
      const texRadiusX =
        (worldRadius / (WORLD_X.MAX - WORLD_X.MIN)) * this.width;
      const texRadiusY =
        (worldRadius / (WORLD_Y.WATER_FAR - WORLD_Y.WATER_NEAR)) * this.height;
      const texRadius = (texRadiusX + texRadiusY) / 2; // Average for circle

      const graphics = new Graphics();
      graphics.circle(0, 0, texRadius);
      graphics.fill({ color: 0x000000, alpha: 1.0 }); // Solid black
      graphics.x = texX;
      graphics.y = texY;

      console.log(
        `  Local(${localPos.x.toFixed(1)}, ${localPos.y.toFixed(1)}) → UV(${localU.toFixed(2)}, ${localV.toFixed(2)}) → Tex(${texX.toFixed(0)}, ${texY.toFixed(0)}) r=${texRadius.toFixed(0)}`,
      );

      renderContainer.addChild(graphics);
    }

    // Render the container to the boundary texture
    this.renderer.render({
      container: renderContainer,
      target: this.boundaryTexture,
    });

    // Ensure GPU completes the render before extracting pixels
    this.renderer.gl.flush();

    console.log("[FluidBoundary] Rendered container to boundary texture");

    renderContainer.destroy({ children: true });

    // Extract pixel data for CPU collision detection
    await this._extractPixelData();

    // Debug: Save boundary texture as image for inspection
    try {
      const debugCanvas = await this.renderer.extract.canvas({
        target: this.boundaryTexture,
      });
      const debugUrl = debugCanvas.toDataURL();
      console.log("[FluidBoundary] Texture preview:", debugUrl);
    } catch (e) {
      console.warn("[FluidBoundary] Could not generate debug image:", e);
    }

    // Create debug sprite to show boundary texture on screen
    this._createDebugSprite();
  }

  /**
   * Create a debug sprite that shows the boundary texture overlaid on screen.
   * Uses a Mesh to properly map the texture to the isometric water surface shape.
   * @private
   */
  _createDebugSprite() {
    if (!this.debugContainer) {
      console.log(
        "[FluidBoundary] No debug container provided, skipping debug sprite",
      );
      return;
    }

    // Get the four corners of the water surface in screen space
    const corners = [
      projectToScreen(
        WORLD_X.MIN,
        WORLD_Y.WATER_NEAR,
        WORLD_Z.WATER_SURFACE,
        this.viewport,
      ), // Top-left
      projectToScreen(
        WORLD_X.MAX,
        WORLD_Y.WATER_NEAR,
        WORLD_Z.WATER_SURFACE,
        this.viewport,
      ), // Top-right
      projectToScreen(
        WORLD_X.MAX,
        WORLD_Y.WATER_FAR,
        WORLD_Z.WATER_SURFACE,
        this.viewport,
      ), // Bottom-right
      projectToScreen(
        WORLD_X.MIN,
        WORLD_Y.WATER_FAR,
        WORLD_Z.WATER_SURFACE,
        this.viewport,
      ), // Bottom-left
    ];

    // Create mesh geometry - vertices in screen space
    const vertices = new Float32Array([
      corners[0].x,
      corners[0].y, // Top-left
      corners[1].x,
      corners[1].y, // Top-right
      corners[3].x,
      corners[3].y, // Bottom-left
      corners[2].x,
      corners[2].y, // Bottom-right
    ]);

    // UV coordinates - map texture corners to mesh corners
    const uvs = new Float32Array([
      0,
      0, // Top-left texture corner
      1,
      0, // Top-right texture corner
      0,
      1, // Bottom-left texture corner
      1,
      1, // Bottom-right texture corner
    ]);

    // Indices for two triangles forming a quad
    const indices = new Uint16Array([
      0,
      1,
      2, // First triangle
      2,
      1,
      3, // Second triangle
    ]);

    // Create mesh geometry using PixiJS v8 MeshGeometry
    const geometry = new Geometry({
      attributes: {
        aPosition: {
          buffer: vertices,
          size: 2,
          type: "float32",
        },
        aUV: {
          buffer: uvs,
          size: 2,
          type: "float32",
        },
      },
      indexBuffer: indices,
    });

    this.debugSprite = new Mesh({
      geometry: geometry,
      texture: this.boundaryTexture,
    });
    this.debugSprite.alpha = 1.0;

    this.debugContainer.addChild(this.debugSprite);

    console.log("[FluidBoundary] Debug mesh created with corners:", corners);
  }

  /**
   * Extract pixel data from boundary texture for CPU-based collision detection.
   * @private
   */
  async _extractPixelData() {
    try {
      // PixiJS v8: Use canvas extraction for reliable pixel data
      const canvas = await this.renderer.extract.canvas({
        target: this.boundaryTexture,
        frame: { x: 0, y: 0, width: this.width, height: this.height },
      });

      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, this.width, this.height);
      this.pixelData = imageData.data; // Uint8ClampedArray

      // Debug: Sample center pixel to verify it's not all white
      const centerX = Math.floor(this.width / 2);
      const centerY = Math.floor(this.height / 2);
      const centerIdx = (centerY * this.width + centerX) * 4;
      const centerPixel = {
        r: this.pixelData[centerIdx],
        g: this.pixelData[centerIdx + 1],
        b: this.pixelData[centerIdx + 2],
        a: this.pixelData[centerIdx + 3],
      };
      console.log(
        "[FluidBoundary] Pixel data extracted. Center pixel:",
        centerPixel,
      );
    } catch (error) {
      console.error("[FluidBoundary] Failed to extract pixel data:", error);
      this.pixelData = new Uint8ClampedArray(this.width * this.height * 4); // Empty fallback
    }
  }

  /**
   * Convert screen coordinates to texture UV coordinates (0-1 range).
   * Converts screen → world → local surface → UV.
   * @param {number} screenX - Screen X coordinate
   * @param {number} screenY - Screen Y coordinate
   * @returns {{u: number, v: number}}
   */
  screenToUV(screenX, screenY) {
    // Convert screen position to world position at water surface Z
    const worldPos = screenToWorld(
      screenX,
      screenY,
      WORLD_Z.WATER_SURFACE,
      this.viewport,
    );

    // Convert world position to local surface coordinates (relative to center)
    const surfaceWidth = WORLD_X.MAX - WORLD_X.MIN; // 12 units
    const surfaceDepth = WORLD_Y.WATER_FAR - WORLD_Y.WATER_NEAR; // 8 units
    const surfaceCenterX = (WORLD_X.MIN + WORLD_X.MAX) / 2; // -2
    const surfaceCenterY = (WORLD_Y.WATER_NEAR + WORLD_Y.WATER_FAR) / 2; // 4

    const localX = worldPos.x - surfaceCenterX; // World → Local
    const localY = worldPos.y - surfaceCenterY;

    // Map from local surface coords (center = 0,0) to UV coords (center = 0.5,0.5)
    const u = 0.5 + localX / surfaceWidth;
    const v = 0.5 + localY / surfaceDepth;

    return { u: Math.max(0, Math.min(1, u)), v: Math.max(0, Math.min(1, v)) };
  }

  /**
   * Sample boundary texture at screen position (CPU-based).
   * Returns true if position is inside an obstacle.
   * @param {number} screenX - Screen X coordinate
   * @param {number} screenY - Screen Y coordinate
   * @returns {boolean} - True if obstacle, false if clear
   */
  isObstacle(screenX, screenY) {
    if (!this.pixelData) {
      console.warn(
        "[FluidBoundary] No pixel data available for collision detection!",
      );
      return false;
    }

    // Convert screen coords to texture pixel coordinates
    const uv = this.screenToUV(screenX, screenY);
    const px = Math.floor(uv.u * (this.width - 1));
    const py = Math.floor(uv.v * (this.height - 1));

    // Read pixel from RGBA data (4 bytes per pixel)
    const index = (py * this.width + px) * 4;

    if (index < 0 || index >= this.pixelData.length) {
      console.warn("[FluidBoundary] Index out of bounds:", {
        screenX,
        screenY,
        uv,
        px,
        py,
        index,
        maxIndex: this.pixelData.length,
      });
      return false;
    }

    const r = this.pixelData[index];
    const g = this.pixelData[index + 1];
    const b = this.pixelData[index + 2];
    const a = this.pixelData[index + 3];

    // Mask sprites are BLACK pixels on transparency
    // If pixel is dark (black mask) and opaque, it's an obstacle
    const brightness = (r + g + b) / 3;
    return brightness < 128 && a > 128; // Dark pixels = obstacles
  }

  /**
   * Update boundary texture (if water objects change).
   */
  update() {
    // For now, boundaries are static
    // Future: Re-render if water objects move/change
  }

  /**
   * Get the boundary texture for GPU-based collision detection.
   * @returns {RenderTexture}
   */
  getTexture() {
    return this.boundaryTexture;
  }

  /**
   * Cleanup resources.
   */
  destroy() {
    if (this.boundaryTexture) {
      this.boundaryTexture.destroy();
      this.boundaryTexture = null;
    }
    if (this.debugSprite) {
      this.debugSprite.destroy();
      this.debugSprite = null;
    }
  }
}
