/**
 * Detachable filter system for applying visual effects to images and videos.
 * 
 * These filters work with both FFmpeg (video) and can be converted to 
 * canvas-based operations (images).
 */

export type FilterName = 'none' | 'winter' | 'autumn' | 'spring' | 'summer' | 'night' | 'sepia' | 'vintage';

export interface FilterConfig {
  name: FilterName;
  description: string;
  /** FFmpeg filter_complex string for video */
  ffmpegFilter: string;
  /** Canvas-based color adjustment parameters */
  canvasAdjustments: {
    brightness: number;      // -100 to 100
    contrast: number;        // -100 to 100
    saturation: number;      // 0 to 2 (1 = normal)
    hue: number;             // -180 to 180 degrees
    colorOverlay?: {         // Optional color overlay
      r: number;
      g: number;
      b: number;
      opacity: number;       // 0 to 1
    };
    temperature?: number;    // -100 (cool) to 100 (warm)
  };
}

export const FILTERS: Record<FilterName, FilterConfig> = {
  none: {
    name: 'none',
    description: 'No filter applied',
    ffmpegFilter: '',
    canvasAdjustments: {
      brightness: 0,
      contrast: 0,
      saturation: 1,
      hue: 0,
    },
  },
  
  winter: {
    name: 'winter',
    description: 'Cool blue tones with slight desaturation',
    // FFmpeg: increase blue, decrease warmth, add slight brightness
    ffmpegFilter: 'colorbalance=bs=0.15:bm=0.1:bh=0.05:rs=-0.1:gs=-0.05,eq=brightness=0.05:saturation=0.85',
    canvasAdjustments: {
      brightness: 5,
      contrast: 5,
      saturation: 0.85,
      hue: -10,
      temperature: -30,
      colorOverlay: {
        r: 200,
        g: 220,
        b: 255,
        opacity: 0.08,
      },
    },
  },
  
  autumn: {
    name: 'autumn',
    description: 'Warm orange and golden tones',
    ffmpegFilter: 'colorbalance=rs=0.15:rm=0.1:rh=0.05:gs=0.05:bs=-0.1:bm=-0.1,eq=saturation=1.2:contrast=1.05',
    canvasAdjustments: {
      brightness: 0,
      contrast: 8,
      saturation: 1.2,
      hue: 15,
      temperature: 40,
      colorOverlay: {
        r: 255,
        g: 180,
        b: 100,
        opacity: 0.06,
      },
    },
  },
  
  spring: {
    name: 'spring',
    description: 'Fresh, vibrant greens and soft tones',
    ffmpegFilter: 'colorbalance=gs=0.1:gm=0.08:rs=0.05,eq=brightness=0.08:saturation=1.15',
    canvasAdjustments: {
      brightness: 8,
      contrast: 3,
      saturation: 1.15,
      hue: 5,
      temperature: 10,
      colorOverlay: {
        r: 220,
        g: 255,
        b: 220,
        opacity: 0.05,
      },
    },
  },
  
  summer: {
    name: 'summer',
    description: 'Bright, warm golden hour feel',
    ffmpegFilter: 'colorbalance=rs=0.1:rm=0.08:gs=0.05:bs=-0.05,eq=brightness=0.1:saturation=1.1:contrast=1.05',
    canvasAdjustments: {
      brightness: 10,
      contrast: 5,
      saturation: 1.1,
      hue: 10,
      temperature: 25,
      colorOverlay: {
        r: 255,
        g: 240,
        b: 200,
        opacity: 0.07,
      },
    },
  },
  
  night: {
    name: 'night',
    description: 'Dark blue moonlit atmosphere',
    ffmpegFilter: 'colorbalance=bs=0.25:bm=0.2:bh=0.15:rs=-0.15:gs=-0.1,eq=brightness=-0.15:saturation=0.7:contrast=1.1',
    canvasAdjustments: {
      brightness: -15,
      contrast: 10,
      saturation: 0.7,
      hue: -20,
      temperature: -50,
      colorOverlay: {
        r: 50,
        g: 80,
        b: 150,
        opacity: 0.15,
      },
    },
  },
  
  sepia: {
    name: 'sepia',
    description: 'Classic sepia/vintage brown tones',
    ffmpegFilter: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
    canvasAdjustments: {
      brightness: 0,
      contrast: 5,
      saturation: 0.3,
      hue: 30,
      temperature: 30,
      colorOverlay: {
        r: 210,
        g: 180,
        b: 140,
        opacity: 0.2,
      },
    },
  },
  
  vintage: {
    name: 'vintage',
    description: 'Faded retro film look',
    ffmpegFilter: 'curves=vintage,eq=saturation=0.9:contrast=0.95',
    canvasAdjustments: {
      brightness: 5,
      contrast: -5,
      saturation: 0.9,
      hue: 5,
      temperature: 15,
      colorOverlay: {
        r: 250,
        g: 240,
        b: 230,
        opacity: 0.1,
      },
    },
  },
};

/**
 * Get filter by name
 */
export function getFilter(name: FilterName): FilterConfig {
  return FILTERS[name] || FILTERS.none;
}

/**
 * Get FFmpeg filter string for video processing.
 * Can be inserted into the filter_complex chain.
 * 
 * @param filterName - Name of the filter to apply
 * @param inputLabel - The input label in the filter chain (e.g., '[out]')
 * @param outputLabel - The output label in the filter chain (e.g., '[filtered]')
 */
export function getFFmpegFilterString(
  filterName: FilterName,
  inputLabel: string = '[out]',
  outputLabel: string = '[filtered]'
): string {
  const filter = getFilter(filterName);
  
  if (!filter.ffmpegFilter) {
    return ''; // No filter to apply
  }
  
  return `${inputLabel}${filter.ffmpegFilter}${outputLabel}`;
}

/**
 * Apply filter adjustments to a canvas context.
 * Call this after drawing all content but before encoding.
 * 
 * @param ctx - Canvas 2D rendering context
 * @param width - Canvas width
 * @param height - Canvas height
 * @param filterName - Name of the filter to apply
 */
export function applyCanvasFilter(
  ctx: any,
  width: number,
  height: number,
  filterName: FilterName
): void {
  const filter = getFilter(filterName);
  const adj = filter.canvasAdjustments;
  
  if (filterName === 'none') return;
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Apply adjustments pixel by pixel
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]!;
    let g = data[i + 1]!;
    let b = data[i + 2]!;
    const a = data[i + 3]!;
    
    // Skip fully transparent pixels
    if (a === 0) continue;
    
    // Apply temperature shift (cool = more blue, warm = more red/yellow)
    if (adj.temperature !== undefined && adj.temperature !== 0) {
      const tempFactor = adj.temperature / 100;
      if (tempFactor > 0) {
        // Warm: increase red, slightly increase green, decrease blue
        r = Math.min(255, r + tempFactor * 30);
        g = Math.min(255, g + tempFactor * 10);
        b = Math.max(0, b - tempFactor * 20);
      } else {
        // Cool: decrease red, increase blue
        r = Math.max(0, r + tempFactor * 20);
        b = Math.min(255, b - tempFactor * 30);
      }
    }
    
    // Apply saturation
    if (adj.saturation !== 1) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + adj.saturation * (r - gray);
      g = gray + adj.saturation * (g - gray);
      b = gray + adj.saturation * (b - gray);
    }
    
    // Apply brightness
    if (adj.brightness !== 0) {
      const brightFactor = adj.brightness * 2.55; // Convert -100..100 to -255..255
      r += brightFactor;
      g += brightFactor;
      b += brightFactor;
    }
    
    // Apply contrast
    if (adj.contrast !== 0) {
      const contrastFactor = (259 * (adj.contrast + 255)) / (255 * (259 - adj.contrast));
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }
    
    // Apply color overlay (blend)
    if (adj.colorOverlay && adj.colorOverlay.opacity > 0) {
      const overlay = adj.colorOverlay;
      r = r * (1 - overlay.opacity) + overlay.r * overlay.opacity;
      g = g * (1 - overlay.opacity) + overlay.g * overlay.opacity;
      b = b * (1 - overlay.opacity) + overlay.b * overlay.opacity;
    }
    
    // Clamp values
    data[i] = Math.max(0, Math.min(255, Math.round(r)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
  }
  
  // Put modified data back
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Get all available filter names
 */
export function getAvailableFilters(): FilterName[] {
  return Object.keys(FILTERS) as FilterName[];
}
