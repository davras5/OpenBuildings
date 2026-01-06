/**
 * OpenBuildings.ch - 3D Mode Module
 * Lazy-loaded module for 3D terrain and fill-extrusion functionality
 */

// Module-level references (set during init)
let map = null;
let state = null;
let config = null;

/**
 * Initialize the 3D mode module with required dependencies
 * @param {Object} deps - Dependencies from main app
 * @param {Object} deps.map - MapLibre map instance
 * @param {Object} deps.state - Application state
 * @param {Object} deps.config - MAP_CONFIG constants
 * @param {Object} deps.colorSchemes - COLOR_SCHEMES object
 * @param {Object} deps.polygonLayerConfigs - Layer configuration
 * @param {Function} deps.buildColorExpression - Landcover color expression builder
 * @param {Function} deps.buildBuildingColorExpression - Building color expression builder
 * @param {Function} deps.updateLandcoverStyles - Style update function
 * @param {Function} deps.updateUrlParams - URL parameter update function
 * @param {Function} deps.debugWarn - Debug warning function
 */
export function init(deps) {
  map = deps.map;
  state = deps.state;
  config = deps.config;

  // Store other dependencies in module scope
  Object.assign(moduleDeps, deps);
}

// Store additional dependencies
const moduleDeps = {};

/**
 * Setup terrain source for 3D mode
 * Called lazily when 3D mode is first activated
 */
function ensureTerrainSource() {
  if (map.getSource('terrain-dem')) return;

  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 15
  });
}

/**
 * Convert landcover layer between flat fill and 3D fill-extrusion
 * @param {boolean} is3D - Whether to use 3D fill-extrusion or flat fill
 */
function setLandcoverLayerType(is3D) {
  if (!map.getLayer('landcovers-fill')) return;

  try {
    const beforeLayer = map.getLayer('landcovers-outline') ? 'landcovers-outline' : undefined;
    const layerConfig = moduleDeps.polygonLayerConfigs.landcovers;

    // Get current color scheme expressions
    const scheme = moduleDeps.colorSchemes[state.colorScheme];
    const colorExpression = moduleDeps.buildColorExpression(scheme, 'colors');

    // Higher opacity when color scheme is active
    const activeOpacity = scheme ? 0.65 : layerConfig.fillOpacity;

    map.removeLayer('landcovers-fill');
    map.addLayer({
      id: 'landcovers-fill',
      type: is3D ? 'fill-extrusion' : 'fill',
      source: 'landcovers',
      'source-layer': 'landcovers',
      minzoom: 12,
      paint: is3D ? {
        'fill-extrusion-color': colorExpression,
        // Multiply by terrain exaggeration to match the exaggerated terrain
        'fill-extrusion-height': 10 * config.terrainExaggeration,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': scheme ? 0.85 : 0.8
      } : {
        'fill-color': colorExpression,
        'fill-opacity': activeOpacity
      }
    }, beforeLayer);

    // Update outline color to match
    const outlineExpression = moduleDeps.buildColorExpression(scheme, 'outlineColors');
    if (map.getLayer('landcovers-outline')) {
      map.setPaintProperty('landcovers-outline', 'line-color', outlineExpression);
    }
  } catch (err) {
    if (moduleDeps.debugWarn) {
      moduleDeps.debugWarn(`Failed to ${is3D ? 'add' : 'restore'} landcover fill:`, err);
    }
  }
}

/**
 * Convert buildings layer between flat fill and 3D fill-extrusion
 * @param {boolean} is3D - Whether to use 3D fill-extrusion or flat fill
 */
function setBuildingsLayerType(is3D) {
  if (!map.getLayer('buildings-fill')) return;

  try {
    const beforeLayer = map.getLayer('buildings-outline') ? 'buildings-outline' : undefined;

    // Get current color expressions from the building color expression builder
    const buildingColorExpr = moduleDeps.buildBuildingColorExpression
      ? moduleDeps.buildBuildingColorExpression('colors')
      : '#64748b';

    // Selection colors - cyan to contrast with all color schemes
    const selectedFillColor = '#06b6d4';   // cyan-500
    const currentSelection = state.selectedBuilding || -1;

    map.removeLayer('buildings-fill');
    map.addLayer({
      id: 'buildings-fill',
      type: is3D ? 'fill-extrusion' : 'fill',
      source: 'buildings',
      'source-layer': 'buildings',
      minzoom: 10,
      paint: is3D ? {
        'fill-extrusion-color': [
          'case',
          ['==', ['get', 'id'], currentSelection], selectedFillColor,
          buildingColorExpr
        ],
        // Use height from data if available, otherwise default to 10 meters
        // Multiply by terrain exaggeration to match the exaggerated terrain
        'fill-extrusion-height': ['*', ['coalesce', ['get', 'height_mean_m'], 10], config.terrainExaggeration],
        'fill-extrusion-base': 0,
        // Note: fill-extrusion-opacity doesn't support data expressions in MapLibre
        'fill-extrusion-opacity': 0.85
      } : {
        'fill-color': [
          'case',
          ['==', ['get', 'id'], currentSelection], selectedFillColor,
          buildingColorExpr
        ],
        'fill-opacity': [
          'case',
          ['==', ['get', 'id'], currentSelection], 0.7,
          0.5
        ]
      }
    }, beforeLayer);
  } catch (err) {
    if (moduleDeps.debugWarn) {
      moduleDeps.debugWarn(`Failed to ${is3D ? 'add' : 'restore'} buildings fill:`, err);
    }
  }
}

/**
 * Animate both terrain exaggeration and camera pitch together
 * Uses the same easing curve for perfect synchronization
 * @param {Object} options
 * @param {number} options.fromExaggeration - Starting exaggeration value
 * @param {number} options.toExaggeration - Target exaggeration value
 * @param {number} options.fromPitch - Starting pitch value
 * @param {number} options.toPitch - Target pitch value
 * @param {number} options.duration - Animation duration in ms
 * @returns {Promise} Resolves when animation completes
 */
function animateTerrainAndCamera({ fromExaggeration, toExaggeration, fromPitch, toPitch, duration }) {
  return new Promise((resolve) => {
    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentExaggeration = fromExaggeration + (toExaggeration - fromExaggeration) * eased;
      const currentPitch = fromPitch + (toPitch - fromPitch) * eased;

      try {
        map.setTerrain({ source: 'terrain-dem', exaggeration: currentExaggeration });
        map.setPitch(currentPitch);
      } catch (err) {
        if (moduleDeps.debugWarn) {
          moduleDeps.debugWarn('Failed to animate terrain/camera:', err);
        }
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}

/**
 * Setup 3D mode: add terrain, sky layer, convert landcover, set pitch
 * @param {boolean} animate - Whether to animate the transition
 */
export async function setup3DMode(animate = true) {
  // Ensure terrain source exists (lazy-loaded)
  ensureTerrainSource();

  // Set initial terrain with no exaggeration if animating
  if (animate) {
    map.setTerrain({ source: 'terrain-dem', exaggeration: 0 });
  }

  // Note: Sky layer is not supported in MapLibre GL JS (Mapbox-only feature)

  // Convert landcover and buildings to fill-extrusion for 3D view
  setLandcoverLayerType(true);
  setBuildingsLayerType(true);

  if (animate) {
    // Animate terrain and camera together with same easing
    await animateTerrainAndCamera({
      fromExaggeration: 0,
      toExaggeration: config.terrainExaggeration,
      fromPitch: map.getPitch(),
      toPitch: config.pitch3D,
      duration: config.standardDuration
    });
  } else {
    // Instant - for initial page load from URL params
    map.setTerrain({ source: 'terrain-dem', exaggeration: config.terrainExaggeration });
    map.setPitch(config.pitch3D);
  }
}

/**
 * Exit 3D mode: remove sky layer, flatten terrain, reset pitch
 * @param {boolean} animate - Whether to animate the transition
 */
export async function exit3DMode(animate = true) {
  if (animate) {
    // Animate terrain and camera together with same easing
    await animateTerrainAndCamera({
      fromExaggeration: config.terrainExaggeration,
      toExaggeration: 0,
      fromPitch: map.getPitch(),
      toPitch: 0,
      duration: config.standardDuration
    });
  } else {
    map.setTerrain({ source: 'terrain-dem', exaggeration: 0 });
    map.setPitch(0);
  }

  // Convert landcover and buildings back to flat fill
  setLandcoverLayerType(false);
  setBuildingsLayerType(false);
}

/**
 * Toggle 3D mode on/off
 * @param {HTMLButtonElement} button - The 3D toggle button element
 */
export async function toggle3D(button) {
  state.is3DMode = !state.is3DMode;

  // Disable button during transition to prevent double-clicks
  button.disabled = true;
  button.textContent = '...';

  if (state.is3DMode) {
    await setup3DMode(true);
    button.textContent = '2D';
  } else {
    await exit3DMode(true);
    button.textContent = '3D';
  }

  button.disabled = false;

  if (moduleDeps.updateUrlParams) {
    moduleDeps.updateUrlParams();
  }
}

/**
 * Setup terrain for style change recovery
 * Called when basemap style changes and 3D mode needs to be restored
 */
export function setupTerrainAfterStyleChange() {
  ensureTerrainSource();
  map.setTerrain({ source: 'terrain-dem', exaggeration: config.terrainExaggeration });
}

/**
 * Update button text based on current state
 * @param {HTMLButtonElement} button - The 3D toggle button element
 */
export function updateButtonState(button) {
  button.textContent = state.is3DMode ? '2D' : '3D';
}
