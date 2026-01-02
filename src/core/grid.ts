import { createCanvas } from '@napi-rs/canvas';

export const SCALE = 4;

export const GRID_CONFIG = {
  tileWidth: 100 * SCALE,
  grassHeight: 15 * SCALE,
  soilHeight: 40 * SCALE,
  // These will be set dynamically based on grid size
  gridSize: 0,
  canvasWidth: 0,
  canvasHeight: 0,
};

export const COLORS = {
    grass: {
        top: '#E8F0F8',
        sideLight: '#D4E2ED',
        sideDark: '#C5D6E3',
        tuft: '#B8CCDB',
        gridStroke: '#CDE0EC'
    },
    soil: {
        sideLight: '#8B9298',
        sideDark: '#6E757A',
    }
};

export interface GridPosition {
  gridX: number;
  gridY: number;
  pixelX: number;
  pixelY: number;
}

/**
 * Draws a filled polygon.
 */
export function drawPoly(ctx: any, points: {x: number, y: number}[], color: string, strokeColor?: string) {
  if (points.length === 0) return;
  
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.closePath();
  
  ctx.fillStyle = color;
  ctx.fill();

  ctx.strokeStyle = strokeColor || color;
  ctx.lineWidth = 1 * SCALE;
  ctx.stroke();
}

export function drawShadow(ctx: any, centerX: number, centerY: number, contentWidth?: number) {
  ctx.beginPath();
  // Use content width if provided, otherwise use default
  const radiusX = contentWidth ? contentWidth / 2 : GRID_CONFIG.tileWidth / 4.5;
  const radiusY = radiusX / 2.5; // Maintain proportional height
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(40, 60, 20, 0.066)'; // A dark, semi-transparent green
  ctx.fill();
}

function drawTuft(ctx: any, centerX: number, centerY: number) {
  ctx.strokeStyle = COLORS.grass.tuft;
  ctx.lineWidth = 2 * SCALE;
  ctx.lineCap = 'round';
  
  const size = 6 * SCALE;
  
  ctx.beginPath();
  ctx.moveTo(centerX - size, centerY - size/2);
  ctx.lineTo(centerX, centerY + size/2);
  ctx.lineTo(centerX + size, centerY - size/2);
  ctx.stroke();
}

/**
 * Detects the actual bottom and horizontal center of the tree content.
 * Returns { xOffset, yPadding, contentWidth } where:
 * - yPadding: number of transparent pixels from the bottom of the image
 * - xOffset: horizontal offset from image center to content center
 * - contentWidth: actual width of the content at the bottom in pixels
 */
export function detectTreeContentPosition(image: any): { xOffset: number, yPadding: number, contentWidth: number } {
  // Create a temporary canvas to read pixel data
  const tempCanvas = createCanvas(image.width, image.height);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(image, 0, 0);
  
  const imageData = tempCtx.getImageData(0, 0, image.width, image.height);
  const data = imageData.data;
  
  // Find all rows with visible pixels and calculate their average darkness
  const candidateRows: { y: number, darkness: number }[] = [];
  
  for (let y = image.height - 1; y >= 0; y--) {
    let hasPixels = false;
    let totalDarkness = 0;
    let pixelCount = 0;
    
    for (let x = 0; x < image.width; x++) {
      const index = (y * image.width + x) * 4;
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      const alpha = data[index + 3] ?? 0;
      
      if (alpha > 245) { // Has visible content
        hasPixels = true;
        // Calculate darkness (0 = black, 765 = white)
        // We invert it so higher = darker
        const brightness = r + g + b;
        const darkness = (765 - brightness) * (alpha / 255); // Weight by opacity
        totalDarkness += darkness;
        pixelCount++;
      }
    }
    
    if (hasPixels && pixelCount > 0) {
      const avgDarkness = totalDarkness / pixelCount;
      candidateRows.push({ y, darkness: avgDarkness });
      
      // Only consider bottom 30% of image to avoid scanning entire tree
      if (candidateRows.length > image.height * 0.3) break;
    }
  }
  
  // If no opaque pixels found, return zeros
  if (candidateRows.length === 0) {
    return { xOffset: 0, yPadding: 0, contentWidth: 0 };
  }
  
  // Find the darkest row among candidates
  let darkestRow = candidateRows[0]!;
  for (const candidate of candidateRows) {
    if (candidate.darkness > darkestRow.darkness) {
      darkestRow = candidate;
    }
  }
  
  const bottomY = darkestRow.y;
  const yPadding = image.height - bottomY - 1;
  
  // Now scan that darkest bottom row to find leftmost and rightmost pixels
  let leftmost = image.width;
  let rightmost = -1;
  
  for (let x = 0; x < image.width; x++) {
    const index = (bottomY * image.width + x) * 4;
    const alpha = data[index + 3] ?? 0;
    
    if (alpha > 245) {
      if (x < leftmost) leftmost = x;
      if (x > rightmost) rightmost = x;
    }
  }
  
  // Calculate the center of the content in that bottom row
  const contentCenterX = (leftmost + rightmost) / 2;
  const imageCenterX = image.width / 2;
  const xOffset = contentCenterX - imageCenterX;
  const contentWidth = rightmost - leftmost + 1;
  
  return { xOffset, yPadding, contentWidth };
}

export interface DrawIsoBlockOptions {
  hasShadow?: boolean;
  shadowWidth?: number;
  drawTufts?: boolean;
  gridX?: number;
  gridY?: number;
}

/**
 * Generate wavy points along an isometric edge for seamless tiling.
 * The wave pattern is based on the edge position so adjacent tiles connect seamlessly.
 */
function generateWavyEdge(
  startX: number, startY: number,
  endX: number, endY: number,
  waveAmplitude: number,
  waveFrequency: number,
  segments: number = 12
): {x: number, y: number}[] {
  const points: {x: number, y: number}[] = [];
  
  // Direction vector along the edge
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  // Normalized direction
  const dirX = dx / length;
  const dirY = dy / length;
  
  // Perpendicular vector (pointing "down" in isometric view)
  const perpX = -dirY;
  const perpY = dirX;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const baseX = startX + dx * t;
    const baseY = startY + dy * t;
    
    // Use sine wave for smooth, loopable pattern
    // Phase is based on absolute position along the edge for seamless tiling
    const phase = t * Math.PI * 2 * waveFrequency;
    const waveOffset = Math.sin(phase) * waveAmplitude;
    
    points.push({
      x: baseX + perpX * waveOffset,
      y: baseY + perpY * waveOffset
    });
  }
  
  return points;
}

// Shared wave parameters for consistent grass-soil transition
const WAVE_AMPLITUDE = 3 * SCALE;
const WAVE_FREQUENCY = 2; // Number of complete waves along the edge
const WAVE_SEGMENTS = 16;

/**
 * Draw a polygon with a wavy bottom edge for grass-soil transition.
 */
function drawWavyGrassSide(
  ctx: any,
  topLeft: {x: number, y: number},
  topRight: {x: number, y: number},
  bottomRight: {x: number, y: number},
  bottomLeft: {x: number, y: number},
  color: string,
  strokeColor?: string
) {
  // Generate wavy points for the bottom edge (from bottomLeft to bottomRight)
  const wavyBottom = generateWavyEdge(
    bottomLeft.x, bottomLeft.y,
    bottomRight.x, bottomRight.y,
    WAVE_AMPLITUDE,
    WAVE_FREQUENCY,
    WAVE_SEGMENTS
  );
  
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y);
  
  // Draw straight line down to start of wavy edge
  ctx.lineTo(wavyBottom[wavyBottom.length - 1]!.x, wavyBottom[wavyBottom.length - 1]!.y);
  
  // Draw wavy bottom edge (reverse direction)
  for (let i = wavyBottom.length - 2; i >= 0; i--) {
    ctx.lineTo(wavyBottom[i]!.x, wavyBottom[i]!.y);
  }
  
  // Close back to top
  ctx.lineTo(topLeft.x, topLeft.y);
  ctx.closePath();
  
  ctx.fillStyle = color;
  ctx.fill();
  
  ctx.strokeStyle = strokeColor || color;
  ctx.lineWidth = 1 * SCALE;
  ctx.stroke();
}

/**
 * Draw a soil side polygon with a wavy top edge that matches the grass bottom.
 */
function drawWavySoilSide(
  ctx: any,
  topLeft: {x: number, y: number},
  topRight: {x: number, y: number},
  bottomRight: {x: number, y: number},
  bottomLeft: {x: number, y: number},
  color: string,
  strokeColor?: string
) {
  // Generate wavy points for the top edge (from topLeft to topRight)
  // This must match exactly with the grass bottom edge
  const wavyTop = generateWavyEdge(
    topLeft.x, topLeft.y,
    topRight.x, topRight.y,
    WAVE_AMPLITUDE,
    WAVE_FREQUENCY,
    WAVE_SEGMENTS
  );
  
  ctx.beginPath();
  
  // Start from first wavy point and draw wavy top edge
  ctx.moveTo(wavyTop[0]!.x, wavyTop[0]!.y);
  for (let i = 1; i < wavyTop.length; i++) {
    ctx.lineTo(wavyTop[i]!.x, wavyTop[i]!.y);
  }
  
  // Draw straight lines for right side, bottom, and left side
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomLeft.x, bottomLeft.y);
  ctx.lineTo(wavyTop[0]!.x, wavyTop[0]!.y);
  ctx.closePath();
  
  ctx.fillStyle = color;
  ctx.fill();
  
  ctx.strokeStyle = strokeColor || color;
  ctx.lineWidth = 1 * SCALE;
  ctx.stroke();
}

export function drawIsoBlock(ctx: any, pos: GridPosition, options: DrawIsoBlockOptions = {}) {
  const { gridX, gridY, pixelX, pixelY } = pos;
  const { hasShadow = false, shadowWidth, drawTufts = false } = options;

  const w = GRID_CONFIG.tileWidth;
  const h = GRID_CONFIG.tileWidth / 2;

  // The `pixelX` and `pixelY` from `pos` represent the true center of the tile's top face.
  // We need to calculate the corner points relative to this center.
  const topPointY = pixelY - (h / 2);
  const soilY = topPointY + GRID_CONFIG.grassHeight;

    // Right Face (Soil) - with wavy top to match grass bottom
    drawWavySoilSide(ctx,
        { x: pixelX, y: soilY + h },
        { x: pixelX + w / 2, y: soilY + h / 2 },
        { x: pixelX + w / 2, y: soilY + h / 2 + GRID_CONFIG.soilHeight },
        { x: pixelX, y: soilY + h + GRID_CONFIG.soilHeight },
        COLORS.soil.sideDark
    );

    // Left Face (Soil) - with wavy top to match grass bottom
    drawWavySoilSide(ctx,
        { x: pixelX - w / 2, y: soilY + h / 2 },
        { x: pixelX, y: soilY + h },
        { x: pixelX, y: soilY + h + GRID_CONFIG.soilHeight },
        { x: pixelX - w / 2, y: soilY + h / 2 + GRID_CONFIG.soilHeight },
        COLORS.soil.sideLight
    );

  // Right Face (Grass) - with wavy bottom
  drawWavyGrassSide(ctx,
    { x: pixelX, y: topPointY + h },
    { x: pixelX + w / 2, y: topPointY + h / 2 },
    { x: pixelX + w / 2, y: topPointY + h / 2 + GRID_CONFIG.grassHeight },
    { x: pixelX, y: topPointY + h + GRID_CONFIG.grassHeight },
    COLORS.grass.sideDark
  );

  // Left Face (Grass) - with wavy bottom
  drawWavyGrassSide(ctx,
    { x: pixelX - w / 2, y: topPointY + h / 2 },
    { x: pixelX, y: topPointY + h },
    { x: pixelX, y: topPointY + h + GRID_CONFIG.grassHeight },
    { x: pixelX - w / 2, y: topPointY + h / 2 + GRID_CONFIG.grassHeight },
    COLORS.grass.sideLight
  );

  // Top Face
  const topVerts = [
    { x: pixelX, y: topPointY },
    { x: pixelX + w / 2, y: topPointY + h / 2 },
    { x: pixelX, y: topPointY + h },
    { x: pixelX - w / 2, y: topPointY + h / 2 }
  ];
  drawPoly(ctx, topVerts, COLORS.grass.top, COLORS.grass.gridStroke);

  // Draw shadow if requested
  if (hasShadow) {
    drawShadow(ctx, pixelX, pixelY, shadowWidth);
  }

  // Random Details - draw tufts if enabled and no shadow (meaning no tree)
  if (drawTufts && !hasShadow) {
    const seed = Math.sin(gridX! * 12.9898 + gridY! * 78.233) * 43758.5453;
    if ((seed - Math.floor(seed)) > 0.5) { // 50% chance
      const randX = (seed * 10) % (20 * SCALE) - (10 * SCALE);
      const randY = (seed * 20) % (10 * SCALE) - (5 * SCALE);
      drawTuft(ctx, pixelX + randX, pixelY + randY);
    }
  }
}

/**
 * Calculate canvas dimensions for a given grid size
 */
export function calculateCanvasDimensions(gridSize: number): { width: number, height: number } {
  const totalGridWidth = (gridSize * 2) * (GRID_CONFIG.tileWidth / 2);
  const calculatedWidth = totalGridWidth + (100 * SCALE);
  const calculatedHeight = (gridSize) * (GRID_CONFIG.tileWidth / 2) + (GRID_CONFIG.soilHeight + GRID_CONFIG.grassHeight) * 2 + (200 * SCALE);
  // Use the larger dimension to create a square canvas
  const canvasSize = Math.max(calculatedWidth, calculatedHeight);
  return { width: canvasSize, height: canvasSize };
}

/**
 * Generate grid positions for a given grid size
 */
export function generateGridPositions(gridSize: number, canvasWidth: number): GridPosition[] {
  const positions: GridPosition[] = [];
  const startX = canvasWidth / 2;
  const startY = 150 * SCALE;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const isoX = (x - y) * (GRID_CONFIG.tileWidth / 2);
      const isoY = (x + y) * (GRID_CONFIG.tileWidth / 4);
      const pixelX = startX + isoX;
      const pixelY = startY + isoY + (GRID_CONFIG.tileWidth / 4);
      positions.push({
        gridX: x,
        gridY: y,
        pixelX: Math.round(pixelX),
        pixelY: Math.round(pixelY)
      });
    }
  }

  return positions;
}

/**
 * Sort positions for proper isometric rendering (back to front)
 */
export function sortPositionsForRendering(positions: GridPosition[]): GridPosition[] {
  return [...positions].sort((a, b) => {
    return (a.gridY + a.gridX) - (b.gridY + b.gridX);
  });
}

/**
 * Calculate tree drawing position
 */
export function calculateTreeDrawPosition(
  pos: GridPosition,
  imageWidth: number,
  imageHeight: number,
  offsets: { xOffset: number, yPadding: number },
  treeScale: number
): { drawX: number, drawY: number, drawWidth: number, drawHeight: number } {
  const drawWidth = imageWidth * treeScale;
  const drawHeight = imageHeight * treeScale;
  const xOffsetScaled = offsets.xOffset * treeScale;
  const yPaddingScaled = offsets.yPadding * treeScale;
  const drawX = pos.pixelX - (drawWidth / 2) - xOffsetScaled;
  const drawY = pos.pixelY - drawHeight + yPaddingScaled;
  
  return { drawX, drawY, drawWidth, drawHeight };
}
