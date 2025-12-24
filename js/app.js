/**
 * OpenBuildings.ch - Main Application
 * Swiss building data visualization
 */

// ============================================
// CONFIGURATION
// ============================================

/** @type {boolean} Enable debug logging (set to false in production) */
const DEBUG = false;

/** @type {string} Supabase project URL */
const SUPABASE_URL = 'https://awnypgafushbsvqlsjyg.supabase.co';

/** @type {string} Supabase anonymous/public key (RLS enforced on backend) */
const SUPABASE_ANON_KEY = 'sb_publishable_PdbeSmuL6XQEaXyaKqhOYQ_fpzIByJQ';

/** @type {string} Protomaps API key for basemap tiles */
const PROTOMAPS_KEY = '4d819871947c1005';

/** @type {string} Vector tile server endpoint */
const TILE_SERVER = `${SUPABASE_URL}/functions/v1/tiles`;

/** @type {number[]} Switzerland bounding box [west, south, east, north] */
const SWITZERLAND_BOUNDS = [5.9559, 45.818, 10.4921, 47.8084];

/** @type {Object} Map view configuration constants */
const MAP_CONFIG = {
  // Zoom levels
  defaultZoom: 7,
  detailZoom: 14,
  searchZoom: 17,

  // Animation durations (ms)
  quickDuration: 300,
  standardDuration: 1000,
  flyDuration: 1500,

  // 3D settings
  pitch3D: 60,
  terrainExaggeration: 1.5,

  // Fit bounds padding
  boundsPadding: 40
};

/** @type {Object} UI timing constants */
const UI_TIMING = {
  clickDebounce: 100,        // Delay to prevent double-handling of clicks
  searchDebounce: 300,       // Delay before triggering search API
  toastDuration: 4000,       // How long toasts are displayed
  toastFadeOut: 300          // Toast fade-out animation duration
};

// ============================================
// Debug Logging Utilities
// ============================================

/** Log debug messages (only when DEBUG is true) */
function debugLog(...args) {
  if (DEBUG) console.log('[OpenBuildings]', ...args);
}

/** Log debug warnings (only when DEBUG is true) */
function debugWarn(...args) {
  if (DEBUG) console.warn('[OpenBuildings]', ...args);
}

// ============================================
// Formatting Helpers
// ============================================

/**
 * Format a numeric value with unit
 * @param {number|null} value - The value to format
 * @param {string} unit - The unit (e.g., 'm²', 'm³', 'm')
 * @param {number} [decimals=0] - Number of decimal places
 * @returns {string} Formatted value with unit or 'Keine Angaben'
 */
function formatWithUnit(value, unit, decimals = 0) {
  if (value == null || isNaN(value)) return 'Keine Angaben';
  const formatted = decimals > 0
    ? value.toLocaleString('de-CH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(value).toLocaleString('de-CH');
  return `${formatted} ${unit}`;
}

/**
 * Format a year value
 * @param {number|null} value - The year value
 * @returns {string} Formatted year or 'Keine Angaben'
 */
function formatYear(value) {
  if (value == null || isNaN(value)) return 'Keine Angaben';
  return value.toString();
}

/** Building status labels and colors (GSTAT) - using GWR codes */
const BUILDING_STATUS = {
  title: 'Gebäude (Status)',
  property: 'status',  // property name in vector tiles
  labels: {
    '1004': 'Bestehend',
    '1003': 'Im Bau',
    '1002': 'Bewilligt',
    '1001': 'Projektiert',
    '1005': 'Nicht nutzbar',
    '1007': 'Abgebrochen',
    '1008': 'Nicht realisiert'
  },
  colors: {
    '1004': '#22c55e',  // existing - green
    '1003': '#f59e0b',  // under_construction - amber
    '1002': '#3b82f6',  // approved - blue
    '1001': '#8b5cf6',  // planned - purple
    '1005': '#94a3b8',  // unusable - slate
    '1007': '#ef4444',  // demolished - red
    '1008': '#64748b'   // not_realized - gray
  },
  outlineColors: {
    '1004': '#16a34a',
    '1003': '#d97706',
    '1002': '#2563eb',
    '1001': '#7c3aed',
    '1005': '#64748b',
    '1007': '#dc2626',
    '1008': '#475569'
  },
  defaultColor: '#475569',
  defaultOutline: '#334155',
  missingLabel: 'Keine Angaben'
};

/** Building status labels (GSTAT) - legacy, for panel display */
const BUILDING_STATUS_LABELS = {
  planned: 'Projektiert',
  approved: 'Bewilligt',
  under_construction: 'Im Bau',
  existing: 'Bestehend',
  unusable: 'Nicht nutzbar',
  demolished: 'Abgebrochen',
  not_realized: 'Nicht realisiert'
};

/** Building category labels (GKAT) */
const BUILDING_CATEGORY_LABELS = {
  provisional: 'Provisional Dwelling',
  single_family: 'Single-Family House',
  row_house: 'Row House',
  multi_family: 'Multi-Family House',
  residential_mixed: 'Residential (Mixed Use)',
  residential_commercial: 'Residential/Commercial',
  commercial_only: 'Commercial Only'
};

/** Construction period labels (GBAUP) - using GWR codes, German */
const CONSTRUCTION_PERIOD_LABELS = {
  '8011': 'vor 1919',
  '8012': '1919–1945',
  '8013': '1946–1960',
  '8014': '1961–1970',
  '8015': '1971–1980',
  '8016': '1981–1985',
  '8017': '1986–1990',
  '8018': '1991–1995',
  '8019': '1996–2000',
  '8020': '2001–2005',
  '8021': '2006–2010',
  '8022': '2011–2015',
  '8023': 'ab 2016'
};

/** Color schemes for landcover visualization - using GWR codes */
const COLOR_SCHEMES = {
  none: null,
  category: {
    property: 'building_category',
    title: 'Gebäudekategorie',
    labels: {
      '1010': 'Provisorische Unterkunft',
      '1020': 'Einfamilienhaus',
      '1025': 'Reihenhaus',
      '1030': 'Mehrfamilienhaus',
      '1040': 'Wohngebäude mit Nebennutzung',
      '1060': 'Gebäude mit Wohnnutzung',
      '1080': 'Gebäude ohne Wohnnutzung'
    },
    colors: {
      '1010': '#94a3b8',  // provisional - slate
      '1020': '#22c55e',  // single_family - green
      '1025': '#84cc16',  // row_house - lime
      '1030': '#3b82f6',  // multi_family - blue
      '1040': '#8b5cf6',  // residential_mixed - purple
      '1060': '#f59e0b',  // residential_commercial - amber
      '1080': '#ef4444'   // commercial_only - red
    },
    outlineColors: {
      '1010': '#64748b',  // darker slate
      '1020': '#16a34a',  // darker green
      '1025': '#65a30d',  // darker lime
      '1030': '#2563eb',  // darker blue
      '1040': '#7c3aed',  // darker purple
      '1060': '#d97706',  // darker amber
      '1080': '#dc2626'   // darker red
    },
    defaultColor: '#64748b',
    defaultOutline: '#475569',
    missingLabel: 'Keine Angaben'
  },
  period: {
    property: 'building_construction_period',
    title: 'Bauperiode',
    labels: CONSTRUCTION_PERIOD_LABELS,
    colors: {
      '8011': '#92400e',  // before 1919
      '8012': '#b45309',  // 1919-1945
      '8013': '#d97706',  // 1946-1960
      '8014': '#f59e0b',  // 1961-1970
      '8015': '#fbbf24',  // 1971-1980
      '8016': '#a3e635',  // 1981-1985
      '8017': '#4ade80',  // 1986-1990
      '8018': '#22d3ee',  // 1991-1995
      '8019': '#38bdf8',  // 1996-2000
      '8020': '#60a5fa',  // 2001-2005
      '8021': '#818cf8',  // 2006-2010
      '8022': '#a78bfa',  // 2011-2015
      '8023': '#c084fc'   // 2016 onwards
    },
    outlineColors: {
      '8011': '#78350f',  // darker
      '8012': '#92400e',
      '8013': '#b45309',
      '8014': '#d97706',
      '8015': '#eab308',
      '8016': '#84cc16',
      '8017': '#22c55e',
      '8018': '#06b6d4',
      '8019': '#0ea5e9',
      '8020': '#3b82f6',
      '8021': '#6366f1',
      '8022': '#8b5cf6',
      '8023': '#a855f7'
    },
    defaultColor: '#64748b',
    defaultOutline: '#475569',
    missingLabel: 'Keine Angaben'
  }
};

/** Parcel status labels */
const PARCEL_STATUS_LABELS = {
  legally_valid: 'Legally Valid',
  in_progress: 'In Progress',
  projected: 'Projected'
};

/** Parcel type labels (LTYP) */
const PARCEL_TYPE_LABELS = {
  property: 'Property',
  sdp_on_parcel: 'Permanent Right',
  mining_right: 'Mining Right'
};

/** Landcover type labels (from DM.01-AV-CH) */
const LANDCOVER_TYPE_LABELS = {
  building: 'Building',
  hardened_area: 'Hardened Area',
  greenhouse: 'Greenhouse',
  perennial_culture_shelter: 'Perennial Culture Shelter',
  reservoir: 'Reservoir',
  other_hardened: 'Other Hardened',
  railway: 'Railway',
  road_path: 'Road/Path',
  field_meadow_pasture: 'Field/Meadow/Pasture',
  vineyard: 'Vineyard',
  other_intensive_culture: 'Other Intensive Culture',
  garden: 'Garden',
  moor: 'Moor',
  other_humusised: 'Other Humusised',
  standing_water: 'Standing Water',
  flowing_water: 'Flowing Water',
  reed_belt: 'Reed Belt',
  closed_forest: 'Closed Forest',
  dense_wooded_pasture: 'Dense Wooded Pasture',
  open_wooded_pasture: 'Open Wooded Pasture',
  other_wooded: 'Other Wooded',
  rock: 'Rock',
  glacier_firn: 'Glacier/Firn',
  gravel_sand: 'Gravel/Sand',
  quarry_dump: 'Quarry/Dump',
  other_unvegetated: 'Other Unvegetated'
};

/**
 * Get human-readable label for an enum value
 * @param {Object} labelMap - The label mapping object
 * @param {string|null} value - The enum value
 * @returns {string} Human-readable label or formatted value
 */
function getEnumLabel(labelMap, value) {
  if (!value) return 'Keine Angaben';
  return labelMap[value] || value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format an address from building data
 * @param {Object} building - Building data object
 * @returns {string|null} Formatted address or null if no address data
 */
function formatAddress(building) {
  const parts = [];
  if (building.street) {
    parts.push(building.street + (building.street_nr ? ' ' + building.street_nr : ''));
  }
  if (building.postal_code || building.city) {
    parts.push([building.postal_code, building.city].filter(Boolean).join(' '));
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

// ============================================
// Wait for DOM and scripts to load
// ============================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // ============================================
  // Fatal Error Handler (for initialization failures)
  // ============================================
  const loadingOverlay = document.getElementById('loadingOverlay');

  function showFatalError(message) {
    if (loadingOverlay) {
      loadingOverlay.innerHTML = `
        <div style="text-align: center; padding: 24px; max-width: 400px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" style="margin-bottom: 16px;">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <h2 style="margin: 0 0 8px 0; font-size: 1.25rem; color: #0f172a;">Failed to Load</h2>
          <p style="margin: 0 0 16px 0; color: #64748b; font-size: 0.875rem;">${message}</p>
          <button onclick="location.reload()" style="
            padding: 8px 16px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 0.875rem;
            cursor: pointer;
          ">Reload Page</button>
        </div>
      `;
    }
    console.error('Fatal initialization error:', message);
  }

  // ============================================
  // Dependency Checks
  // ============================================
  if (typeof maplibregl === 'undefined') {
    showFatalError('Map library failed to load. Please check your internet connection and try again.');
    return;
  }

  if (typeof window.supabase === 'undefined') {
    showFatalError('Database connection failed to load. Please check your internet connection and try again.');
    return;
  }

  // ============================================
  // Main Initialization (wrapped in try-catch)
  // ============================================
  try {

  // ============================================
  // Toast Notification System
  // ============================================
  const toastContainer = document.getElementById('toastContainer');

  function showToast(message, type = 'error', duration = UI_TIMING.toastDuration) {
    const icons = {
      error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
      info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `${icons[type] || icons.info}<span class="toast-message">${message}</span>`;

    toastContainer.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto-remove after duration
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), UI_TIMING.toastFadeOut);
    }, duration);
  }

  // ============================================
  // Initialize Supabase
  // ============================================
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ============================================
  // Initialize Map (MapLibre GL JS with Swisstopo basemaps)
  // ============================================
  // Parse URL params BEFORE creating map to set initial view correctly
  const urlParams = getUrlParams();
  const initialCenter = (urlParams.lon !== null && urlParams.lat !== null)
    ? [urlParams.lon, urlParams.lat]
    : [8.2275, 46.8182]; // Switzerland center
  const initialZoom = urlParams.zoom !== null ? urlParams.zoom : MAP_CONFIG.defaultZoom;

  const map = new maplibregl.Map({
    container: 'map',
    style: `https://api.protomaps.com/styles/v2/white.json?key=${PROTOMAPS_KEY}`,
    center: initialCenter,
    zoom: initialZoom,
    maxBounds: [[5.5, 45.5], [11.0, 48.0]] // Restrict to Switzerland region
  });

  // Custom zoom controls
  document.getElementById('zoomInBtn').addEventListener('click', () => {
    map.zoomIn({ duration: MAP_CONFIG.quickDuration });
  });
  document.getElementById('zoomOutBtn').addEventListener('click', () => {
    map.zoomOut({ duration: MAP_CONFIG.quickDuration });
  });

  // Add scale control to custom footer container
  const scaleControl = new maplibregl.ScaleControl({ unit: 'metric' });
  const scaleContainer = document.getElementById('scaleContainer');

  // Mount scale control after map loads
  map.on('load', () => {
    scaleControl.onAdd(map);
    scaleContainer.appendChild(scaleControl._container);
  });

  // Mouse coordinates display (throttled with requestAnimationFrame)
  const mouseCoordsDisplay = document.getElementById('mouseCoords');
  let pendingMouseCoords = null;
  let mouseAnimationFrame = null;

  map.on('mousemove', (e) => {
    pendingMouseCoords = e.lngLat;
    if (!mouseAnimationFrame) {
      mouseAnimationFrame = requestAnimationFrame(() => {
        if (pendingMouseCoords) {
          const lat = pendingMouseCoords.lat.toFixed(5);
          const lng = pendingMouseCoords.lng.toFixed(5);
          mouseCoordsDisplay.textContent = `WGS 84 | Koordinaten: ${lat}, ${lng}`;
        }
        mouseAnimationFrame = null;
      });
    }
  });

  map.on('mouseout', () => {
    if (mouseAnimationFrame) {
      cancelAnimationFrame(mouseAnimationFrame);
      mouseAnimationFrame = null;
    }
    pendingMouseCoords = null;
    mouseCoordsDisplay.textContent = 'WGS 84 | Koordinaten: –';
  });

  // ============================================
  // State (selection only - data now served via vector tiles)
  // ============================================

  // ============================================
  // DOM Elements
  // ============================================
  // Note: loadingOverlay is declared at the top of init() for error handling
  const buildingPanel = document.getElementById('buildingPanel');
  const panelBuildingName = document.getElementById('panelBuildingName');
  const panelBuildingLocation = document.getElementById('panelBuildingLocation');
  const panelMetrics = document.getElementById('panelMetrics');
  const closePanelBtn = document.getElementById('closePanelBtn');

  // ============================================
  // URL Parameters
  // ============================================
  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      zoom: params.get('zoom') ? parseFloat(params.get('zoom')) : null,
      lon: params.get('lon') ? parseFloat(params.get('lon')) : null,
      lat: params.get('lat') ? parseFloat(params.get('lat')) : null,
      building: params.get('building') ? parseInt(params.get('building')) : null,
      parcel: params.get('parcel') ? parseInt(params.get('parcel')) : null,
      landcover: params.get('landcover') ? parseInt(params.get('landcover')) : null,
      is3D: params.get('3d') === 'true',
      marker: params.get('marker') === 'true'
    };
  }

  function updateUrlParams() {
    const params = new URLSearchParams();
    const center = map.getCenter();
    const zoom = map.getZoom();

    params.set('zoom', zoom.toFixed(2));
    params.set('lon', center.lng.toFixed(5));
    params.set('lat', center.lat.toFixed(5));

    if (state.selectedBuilding) params.set('building', state.selectedBuilding);
    if (state.selectedParcel) params.set('parcel', state.selectedParcel);
    if (state.selectedLandcover) params.set('landcover', state.selectedLandcover);
    if (state.is3DMode) params.set('3d', 'true');

    window.history.replaceState({}, '', `?${params.toString()}`);
  }

  // Application state
  const state = {
    selectedBuilding: null,
    selectedParcel: null,
    selectedLandcover: null,
    markerClickHandled: false,
    is3DMode: false,
    searchMarker: null,
    colorScheme: 'none'
  };

  /**
   * Create a search marker element (blue pin with white center)
   * @returns {HTMLDivElement} The marker element
   */
  function createSearchMarkerElement() {
    const el = document.createElement('div');
    el.innerHTML = `
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" fill="#2563eb"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
      </svg>
    `;
    el.style.cssText = 'cursor: pointer; transform: translate(-50%, -100%);';
    return el;
  }

  // ============================================
  // Layer Event Handlers (named functions for cleanup)
  // ============================================
  // Shared cursor handlers to avoid duplication
  const cursorHandlers = {
    mouseenter: () => { map.getCanvas().style.cursor = 'pointer'; },
    mouseleave: () => { map.getCanvas().style.cursor = ''; }
  };

  // Storing handlers allows us to remove them when layers are re-added
  const layerHandlers = {
    parcels: cursorHandlers,
    landcovers: cursorHandlers,
    buildings: {
      click: (e) => {
        state.markerClickHandled = true;
        const props = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates;
        selectBuilding(props.id, coords);
        setTimeout(() => { state.markerClickHandled = false; }, UI_TIMING.clickDebounce);
      },
      ...cursorHandlers
    }
  };

  /**
   * Add or remove layer event handlers
   * @param {'add'|'remove'} action - Whether to add or remove handlers
   * @param {string} layerName - Name in layerHandlers object (parcels, landcover, buildings)
   * @param {string} layerId - Map layer ID to attach handlers to
   */
  function manageLayerHandlers(action, layerName, layerId) {
    const handlers = layerHandlers[layerName];
    if (!handlers) return;

    const method = action === 'add' ? 'on' : 'off';
    Object.entries(handlers).forEach(([event, handler]) => {
      map[method](event, layerId, handler);
    });
    debugLog(`${action === 'add' ? 'Added' : 'Removed'} handlers for ${layerId}`);
  }

  // ============================================
  // Functions
  // ============================================

  // LRU cache for parsed WKB geometries (max 100 entries)
  const wkbCache = new Map();
  const WKB_CACHE_MAX_SIZE = 100;

  function cacheWkbResult(hex, result) {
    // Evict oldest entry if at capacity
    if (wkbCache.size >= WKB_CACHE_MAX_SIZE) {
      const firstKey = wkbCache.keys().next().value;
      wkbCache.delete(firstKey);
    }
    wkbCache.set(hex, result);
  }

  // Simple EWKB parser for Point and Polygon (with caching)
  function wkbToGeoJSON(hex) {
    // Check cache first
    if (wkbCache.has(hex)) {
      // Move to end for LRU behavior
      const cached = wkbCache.get(hex);
      wkbCache.delete(hex);
      wkbCache.set(hex, cached);
      return cached;
    }
    try {
      let pos = 0;

      // Helper to read bytes as little-endian double
      function readDouble() {
        const bytes = [];
        for (let i = 0; i < 8; i++) {
          bytes.push(parseInt(hex.substr(pos + i * 2, 2), 16));
        }
        pos += 16;
        const buffer = new ArrayBuffer(8);
        const view = new DataView(buffer);
        bytes.forEach((b, i) => view.setUint8(i, b));
        return view.getFloat64(0, true);
      }

      // Helper to read uint32 little-endian
      function readUInt32() {
        const bytes = [];
        for (let i = 0; i < 4; i++) {
          bytes.push(parseInt(hex.substr(pos + i * 2, 2), 16));
        }
        pos += 8;
        return bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
      }

      // Skip byte order (1 byte)
      pos += 2;

      // Read type (4 bytes) - includes SRID flag
      const type = readUInt32();
      const geomType = type & 0xFF;
      const hasSRID = (type & 0x20000000) !== 0;

      // Skip SRID if present (4 bytes)
      if (hasSRID) {
        pos += 8;
      }

      // Point (type 1)
      if (geomType === 1) {
        const x = readDouble();
        const y = readDouble();
        const result = { type: 'Point', coordinates: [x, y] };
        cacheWkbResult(hex, result);
        return result;
      }

      // Polygon (type 3)
      if (geomType === 3) {
        const numRings = readUInt32();
        const rings = [];

        for (let r = 0; r < numRings; r++) {
          const numPoints = readUInt32();
          const ring = [];

          for (let p = 0; p < numPoints; p++) {
            const x = readDouble();
            const y = readDouble();
            ring.push([x, y]);
          }
          rings.push(ring);
        }

        const result = { type: 'Polygon', coordinates: rings };
        cacheWkbResult(hex, result);
        return result;
      }

      debugWarn('Unsupported geometry type:', geomType);
      return null;

    } catch (err) {
      debugWarn('WKB decode error:', err);
      return null;
    }
  }

  // NOTE: fetchBuildings() and fetchParcels() removed - data now served via vector tiles

  // Layer configurations for polygon layers (parcels, landcover)
  const polygonLayerConfigs = {
    parcels: {
      name: 'parcels',
      fillColor: '#1e3a5f',      // Deep Blue default
      outlineColor: '#1e3a5f',
      selectedColor: '#059669',  // Green when selected
      fillOpacity: 0.1,
      selectedFillOpacity: 0.25,
      getSelectedId: () => state.selectedParcel
    },
    landcovers: {
      name: 'landcovers',
      fillColor: '#8b5cf6',      // Purple default
      outlineColor: '#7c3aed',   // Darker purple for outline
      selectedColor: '#059669',  // Green when selected
      fillOpacity: 0.2,
      selectedFillOpacity: 0.4,
      getSelectedId: () => state.selectedLandcover
    }
  };

  /**
   * Add a polygon vector tile layer (parcels or landcover)
   * @param {string} layerName - Name of the layer config to use
   */
  function addPolygonLayer(layerName) {
    const config = polygonLayerConfigs[layerName];
    if (!config) return;

    const { name, fillColor, outlineColor, selectedColor, fillOpacity, selectedFillOpacity, getSelectedId } = config;

    // Skip if source already exists
    if (map.getSource(name)) return;

    // Remove any existing handlers (prevents memory leaks on style change)
    manageLayerHandlers('remove', name, `${name}-fill`);

    // Add vector tile source
    map.addSource(name, {
      type: 'vector',
      tiles: [`${TILE_SERVER}/${name}/{z}/{x}/{y}.pbf`],
      minzoom: 10,
      maxzoom: 14,
      bounds: SWITZERLAND_BOUNDS
    });

    // Add fill layer
    map.addLayer({
      id: `${name}-fill`,
      type: 'fill',
      source: name,
      'source-layer': name,
      minzoom: 12,
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'id'], getSelectedId() || -1], selectedColor,
          fillColor
        ],
        'fill-opacity': [
          'case',
          ['==', ['get', 'id'], getSelectedId() || -1], selectedFillOpacity,
          fillOpacity
        ]
      }
    });

    // Add outline layer
    map.addLayer({
      id: `${name}-outline`,
      type: 'line',
      source: name,
      'source-layer': name,
      minzoom: 12,
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'id'], getSelectedId() || -1], selectedColor,
          outlineColor
        ],
        'line-width': [
          'case',
          ['==', ['get', 'id'], getSelectedId() || -1], 3,
          1.5
        ]
      }
    });

    // Add hover effect (using named handlers for cleanup)
    manageLayerHandlers('add', name, `${name}-fill`);
  }

  // Convenience wrappers for backward compatibility
  function addParcelsLayer() {
    addPolygonLayer('parcels');
  }

  function addLandcoverLayer() {
    addPolygonLayer('landcovers');
  }

  async function addSwitzerlandBorder() {
    if (map.getSource('switzerland-border')) return;

    try {
      const response = await fetch('assets/ch.geojson');
      if (!response.ok) throw new Error('Failed to fetch border data');
      const geojson = await response.json();

      map.addSource('switzerland-border', {
        type: 'geojson',
        data: geojson
      });

      // Add border line (solid, dark grey - Mapbox style)
      map.addLayer({
        id: 'switzerland-border-line',
        type: 'line',
        source: 'switzerland-border',
        paint: {
          'line-color': '#374151',
          'line-width': 1.5
        }
      });
    } catch (err) {
      debugWarn('Failed to load Switzerland border:', err);
      // Non-critical feature, no toast needed - border is decorative
    }
  }

  /**
   * Build MapLibre expression for building status colors
   * @param {string} colorKey - 'colors' or 'outlineColors'
   * @returns {Array} MapLibre match expression
   */
  function buildBuildingStatusColorExpression(colorKey = 'colors') {
    const colorMap = BUILDING_STATUS[colorKey];
    const defaultVal = colorKey === 'colors' ? BUILDING_STATUS.defaultColor : BUILDING_STATUS.defaultOutline;
    const matchExpression = ['match', ['get', BUILDING_STATUS.property]];

    Object.entries(colorMap).forEach(([key, color]) => {
      matchExpression.push(key, color);
    });

    matchExpression.push(defaultVal); // fallback for null/missing
    return matchExpression;
  }

  function addBuildingsLayer() {
    // Skip if source already exists
    if (map.getSource('buildings')) return;

    // Remove any existing handlers (prevents memory leaks on style change)
    manageLayerHandlers('remove', 'buildings', 'unclustered-point');

    // Add vector tile source (streams data on-demand)
    map.addSource('buildings', {
      type: 'vector',
      tiles: [`${TILE_SERVER}/buildings/{z}/{x}/{y}.pbf`],
      minzoom: 0,
      maxzoom: 14,
      bounds: SWITZERLAND_BOUNDS
    });

    // Heatmap layer for low zoom (visual clustering alternative)
    map.addLayer({
      id: 'buildings-heat',
      type: 'heatmap',
      source: 'buildings',
      'source-layer': 'buildings',
      maxzoom: 12,
      paint: {
        'heatmap-weight': 1,
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 12, 2],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 3, 12, 15],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 12, 0],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)',
          0.2, '#c7d2fe',  // Light indigo
          0.4, '#818cf8',  // Indigo
          0.6, '#4f46e5',  // Darker indigo
          0.8, '#3730a3',  // Deep indigo
          1, '#1e3a5f'     // Deep Blue (brand color)
        ]
      }
    });

    // Build status color expression for buildings
    const buildingColorExpr = buildBuildingStatusColorExpression('colors');
    const buildingOutlineExpr = buildBuildingStatusColorExpression('outlineColors');

    // Circle layer for individual buildings (visible at zoom 10+)
    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'buildings',
      'source-layer': 'buildings',
      minzoom: 10,
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          10, 2,
          14, ['case', ['==', ['get', 'id'], state.selectedBuilding || -1], 10, 7]
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'id'], state.selectedBuilding || -1], '#059669', // Leaf green when selected
          buildingColorExpr
        ],
        'circle-stroke-width': [
          'interpolate', ['linear'], ['zoom'],
          10, 0,
          12, ['case', ['==', ['get', 'id'], state.selectedBuilding || -1], 3, 2]
        ],
        'circle-stroke-color': [
          'case',
          ['==', ['get', 'id'], state.selectedBuilding || -1], '#1e3a5f', // Deep Blue
          buildingOutlineExpr
        ],
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 12, 1]
      }
    });

    // Add click and hover handlers (using named handlers for cleanup)
    manageLayerHandlers('add', 'buildings', 'unclustered-point');
  }

  // Track previous selection to avoid unnecessary paint updates
  let lastRenderedBuildingSelection = undefined;

  function updateBuildingStyles() {
    if (!map.getLayer('unclustered-point')) return;

    // Skip update if selection hasn't changed
    const currentSelection = state.selectedBuilding || -1;
    if (lastRenderedBuildingSelection === currentSelection) return;
    lastRenderedBuildingSelection = currentSelection;

    // Get status-based color expressions
    const buildingColorExpr = buildBuildingStatusColorExpression('colors');
    const buildingOutlineExpr = buildBuildingStatusColorExpression('outlineColors');

    // Batch all paint property updates (MapLibre batches synchronous calls internally)
    map.setPaintProperty('unclustered-point', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], currentSelection], 10,
      7
    ]);
    map.setPaintProperty('unclustered-point', 'circle-color', [
      'case',
      ['==', ['get', 'id'], currentSelection], '#059669', // Leaf green when selected
      buildingColorExpr
    ]);
    map.setPaintProperty('unclustered-point', 'circle-stroke-width', [
      'case',
      ['==', ['get', 'id'], currentSelection], 3,
      2
    ]);
    map.setPaintProperty('unclustered-point', 'circle-stroke-color', [
      'case',
      ['==', ['get', 'id'], currentSelection], '#1e3a5f', // Deep Blue
      buildingOutlineExpr
    ]);
  }

  /**
   * Select a feature and update state/UI accordingly
   * @param {'building'|'parcel'|'landcovers'} featureType - Type of feature
   * @param {number} id - Feature ID
   * @param {Array} [coords] - Optional coordinates (for buildings from click events)
   */
  async function selectFeature(featureType, id, coords = null) {
    // Clear all selections, then set the selected one
    state.selectedBuilding = featureType === 'building' ? id : null;
    state.selectedParcel = featureType === 'parcel' ? id : null;
    state.selectedLandcover = featureType === 'landcovers' ? id : null;

    updateUrlParams();
    updateBuildingStyles();
    updateParcelStyles();
    updateLandcoverStyles();

    // For buildings with coords, fetch directly; otherwise use showSelectedPanel
    if (featureType === 'building' && coords) {
      await fetchAndShowFeature('building', id, coords);
    } else {
      await showSelectedPanel();
    }
  }

  // Convenience wrappers for backward compatibility
  async function selectBuilding(id, coords = null) {
    await selectFeature('building', id, coords);
  }

  async function selectParcel(id) {
    await selectFeature('parcel', id);
  }

  async function selectLandcover(id) {
    await selectFeature('landcovers', id);
  }

  // Single function to show panel based on what's selected (from URL params)
  async function showSelectedPanel() {
    updateBuildingStyles();
    updateParcelStyles();
    updateLandcoverStyles();

    if (state.selectedBuilding) {
      await fetchAndShowFeature('building', state.selectedBuilding);
    } else if (state.selectedLandcover) {
      await fetchAndShowFeature('landcovers', state.selectedLandcover);
    } else if (state.selectedParcel) {
      await fetchAndShowFeature('parcel', state.selectedParcel);
    }
  }

  // LRU cache for fetched features (max 50 entries per type)
  const featureCache = {
    building: new Map(),
    parcel: new Map(),
    landcovers: new Map()
  };
  const FEATURE_CACHE_MAX_SIZE = 50;

  function getCachedFeature(type, id) {
    const cache = featureCache[type];
    if (cache.has(id)) {
      // Move to end for LRU behavior
      const data = cache.get(id);
      cache.delete(id);
      cache.set(id, data);
      return data;
    }
    return null;
  }

  function setCachedFeature(type, id, data) {
    const cache = featureCache[type];
    // Evict oldest entry if at capacity
    if (cache.size >= FEATURE_CACHE_MAX_SIZE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(id, data);
  }

  // Feature fetch configurations
  const featureConfigs = {
    building: {
      table: 'buildings',
      select: `id, label, egid, geog,
        street, street_nr, postal_code, city,
        status, category,
        construction_year,
        floors_above, floors_below,
        area_footprint_m2, area_floor_total_m2,
        volume_total_m3,
        height_mean_m, height_max_m,
        heating_source,
        heritage_category`,
      showPanel: showBuildingPanel,
      errorMsg: 'Failed to load building details. Please try again.'
    },
    parcel: {
      table: 'parcels',
      select: `id, label, egrid, parcel_number,
        status, type,
        area_m2, area_ggf_m2,
        zone_main, zone_type,
        municipality_name`,
      showPanel: showParcelPanel,
      errorMsg: 'Failed to load parcel details. Please try again.'
    },
    landcovers: {
      table: 'landcovers',
      select: `id, label, type, egid, status,
        area_m2,
        volume_total_m3,
        height_mean_m, height_max_m`,
      showPanel: showLandcoverPanel,
      errorMsg: 'Failed to load landcover details. Please try again.'
    }
  };

  /**
   * Fetch feature from Supabase and show panel (with caching)
   * @param {'building'|'parcel'|'landcover'} featureType - Type of feature
   * @param {number} id - Feature ID
   * @param {Array} [coords] - Optional coordinates (for buildings from click events)
   */
  async function fetchAndShowFeature(featureType, id, coords = null) {
    const config = featureConfigs[featureType];
    if (!config) return;

    // Check cache first
    const cached = getCachedFeature(featureType, id);
    if (cached) {
      displayFeatureData(featureType, cached, coords, config);
      return;
    }

    try {
      const { data, error } = await db
        .from(config.table)
        .select(config.select)
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        // Cache the result
        setCachedFeature(featureType, id, data);
        displayFeatureData(featureType, data, coords, config);
      }
    } catch (err) {
      console.error(`Error fetching ${featureType}:`, err);
      showToast(config.errorMsg, 'error');
    }
  }

  /**
   * Display feature data in the appropriate panel
   */
  function displayFeatureData(featureType, data, coords, config) {
    if (featureType === 'building') {
      let lon, lat;
      if (coords) {
        [lon, lat] = coords;
      } else if (data.geog) {
        const geojson = wkbToGeoJSON(data.geog);
        if (geojson) {
          lon = geojson.coordinates[0];
          lat = geojson.coordinates[1];
        }
      }
      config.showPanel({ ...data, lon, lat });
    } else {
      config.showPanel(data);
    }
  }

  // Track previous polygon selections to avoid unnecessary paint updates
  const lastRenderedPolygonSelection = { parcels: undefined, landcovers: undefined };

  /**
   * Update polygon layer styles based on selection state
   * @param {'parcels'|'landcover'} layerName - Name of the layer to update
   */
  function updatePolygonStyles(layerName) {
    if (!map.getLayer(`${layerName}-fill`)) return;

    const config = polygonLayerConfigs[layerName];
    const selectedId = config.getSelectedId();

    // Skip update if selection hasn't changed
    if (lastRenderedPolygonSelection[layerName] === selectedId) return;
    lastRenderedPolygonSelection[layerName] = selectedId;

    // Landcover in 3D mode uses fill-extrusion-opacity, otherwise fill-opacity
    const is3DLandcover = layerName === 'landcovers' && state.is3DMode;
    const opacityProp = is3DLandcover ? 'fill-extrusion-opacity' : 'fill-opacity';

    // Adjust opacity values for 3D mode (higher visibility needed)
    const selectedOpacity = is3DLandcover ? 0.6 : config.selectedFillOpacity;
    const defaultOpacity = is3DLandcover ? 0.4 : config.fillOpacity;

    if (selectedId) {
      map.setPaintProperty(`${layerName}-fill`, opacityProp, [
        'case',
        ['==', ['get', 'id'], selectedId], selectedOpacity,
        defaultOpacity
      ]);
      map.setPaintProperty(`${layerName}-outline`, 'line-width', [
        'case',
        ['==', ['get', 'id'], selectedId], 3,
        1.5
      ]);
    } else {
      map.setPaintProperty(`${layerName}-fill`, opacityProp, defaultOpacity);
      map.setPaintProperty(`${layerName}-outline`, 'line-width', 1.5);
    }
  }

  // Convenience wrappers for backward compatibility
  function updateParcelStyles() {
    updatePolygonStyles('parcels');
  }

  function updateLandcoverStyles() {
    updatePolygonStyles('landcovers');
  }

  // ============================================
  // Panel Display (unified for all feature types)
  // ============================================

  /**
   * Display the details panel with given content
   * @param {Object} config - Panel configuration
   * @param {string} config.title - Panel title
   * @param {string} config.type - Feature type (Gebäude, Parzelle, Bodenbedeckung)
   * @param {Array<{label: string, value: string|number, isCategory?: boolean}>} config.metrics - Metrics to display
   */
  function showPanel({ title, type, metrics }) {
    panelBuildingName.textContent = title;
    panelBuildingLocation.textContent = type;

    panelMetrics.innerHTML = metrics.map(m => {
      if (m.isCategory) {
        return `<div class="metric-category">${m.label}</div>`;
      }
      return `
        <div class="metric-row">
          <span class="metric-label">${m.label}</span>
          <span class="metric-value">${m.value}</span>
        </div>
      `;
    }).join('') + `
      <a href="https://github.com/davras5/OpenBuildings/blob/main/documentation/DATAMODEL.md" target="_blank" class="metric-docs-link">Dokumentation Merkmalkatalog</a>
    `;

    buildingPanel.classList.add('open');
  }

  /** Show building panel with details */
  function showBuildingPanel(building) {
    const address = formatAddress(building);

    // Fixed set of attributes organized by 5 groups (matching DATAMODEL.md)
    const metrics = [
      // 1. General / Allgemein - The "What" and "When"
      { label: 'Allgemein', isCategory: true },
      { label: 'EGID', value: building.egid || 'Keine Angaben' },
      { label: 'Status', value: getEnumLabel(BUILDING_STATUS_LABELS, building.status) },
      { label: 'Kategorie', value: getEnumLabel(BUILDING_CATEGORY_LABELS, building.category) },
      { label: 'Baujahr', value: formatYear(building.construction_year) },

      // 2. Location / Standort - The "Where"
      { label: 'Standort', isCategory: true },
      { label: 'Adresse', value: address || 'Keine Angaben' },

      // 3. Dimensions / Dimensionen - The "How Big"
      { label: 'Dimensionen', isCategory: true },
      { label: 'Geschosse', value: formatFloors(building.floors_above, building.floors_below) },
      { label: 'Grundfläche', value: formatWithUnit(building.area_footprint_m2, 'm²') },
      { label: 'Geschossfläche', value: formatWithUnit(building.area_floor_total_m2, 'm²') },
      { label: 'Volumen', value: formatWithUnit(building.volume_total_m3, 'm³') },
      { label: 'Höhe', value: formatWithUnit(building.height_max_m, 'm', 1) },

      // 4. Features / Eigenschaften - The "Details"
      { label: 'Eigenschaften', isCategory: true },
      { label: 'Wärmequelle', value: getEnumLabel({}, building.heating_source) },
      { label: 'Schutzkategorie', value: formatHeritage(building.heritage_category) }
    ];

    showPanel({
      title: building.label || (address ? address.split(',')[0] : null) || building.egid || `Gebäude #${building.id}`,
      type: 'Gebäude',
      metrics
    });
  }

  /** Format floors display */
  function formatFloors(above, below) {
    if (above == null && below == null) return 'Keine Angaben';
    const floorsAbove = above || 0;
    const floorsBelow = below || 0;
    let text = `${floorsAbove} oberirdisch`;
    if (floorsBelow > 0) text += `, ${floorsBelow} unterirdisch`;
    return text;
  }

  /** Format heritage category */
  function formatHeritage(category) {
    if (!category) return 'Keine Angaben';
    return category === 'a' ? 'Kategorie A (national)' : 'Kategorie B (regional)';
  }

  /** Show parcel panel with details */
  function showParcelPanel(parcel) {
    const zoneText = [parcel.zone_main, parcel.zone_type].filter(Boolean).join(' – ') || 'Keine Angaben';

    // Fixed set of attributes organized by 5 groups (matching DATAMODEL.md)
    const metrics = [
      // 1. General / Allgemein - The "What" and "When"
      { label: 'Allgemein', isCategory: true },
      { label: 'E-GRID', value: parcel.egrid || 'Keine Angaben' },
      { label: 'Status', value: getEnumLabel(PARCEL_STATUS_LABELS, parcel.status) },
      { label: 'Typ', value: getEnumLabel(PARCEL_TYPE_LABELS, parcel.type) },
      { label: 'Parzellennummer', value: parcel.parcel_number || 'Keine Angaben' },

      // 2. Location / Standort - The "Where"
      { label: 'Standort', isCategory: true },
      { label: 'Gemeinde', value: parcel.municipality_name || 'Keine Angaben' },

      // 3. Dimensions / Dimensionen - The "How Big"
      { label: 'Dimensionen', isCategory: true },
      { label: 'Fläche', value: formatWithUnit(parcel.area_m2, 'm²') },
      { label: 'Gebäudegrundfläche', value: formatWithUnit(parcel.area_ggf_m2, 'm²') },

      // 4. Features / Eigenschaften - The "Details"
      { label: 'Eigenschaften', isCategory: true },
      { label: 'Zone', value: zoneText }
    ];

    showPanel({
      title: parcel.label || (parcel.parcel_number ? `Parzelle ${parcel.parcel_number}` : null) || parcel.egrid || `Parzelle #${parcel.id}`,
      type: 'Parzelle',
      metrics
    });
  }

  /** Show landcover panel with details */
  function showLandcoverPanel(landcover) {
    const isBuilding = landcover.type === 'building';
    const typeLabel = getEnumLabel(LANDCOVER_TYPE_LABELS, landcover.type);

    // Fixed set of attributes organized by 5 groups (matching DATAMODEL.md)
    const metrics = [
      // 1. General / Allgemein - The "What" and "When"
      { label: 'Allgemein', isCategory: true },
      { label: 'EGID', value: landcover.egid || 'Keine Angaben' },
      { label: 'Typ', value: typeLabel },
      { label: 'Status', value: getEnumLabel({}, landcover.status) },

      // 2. Location / Standort - The "Where"
      // (parcel_id and building_id would be shown here if fetched)

      // 3. Dimensions / Dimensionen - The "How Big"
      { label: 'Dimensionen', isCategory: true },
      { label: 'Fläche', value: formatWithUnit(landcover.area_m2, 'm²') },
      { label: 'Volumen', value: isBuilding ? formatWithUnit(landcover.volume_total_m3, 'm³') : 'Keine Angaben' },
      { label: 'Max. Höhe', value: isBuilding ? formatWithUnit(landcover.height_max_m, 'm', 1) : 'Keine Angaben' },
      { label: 'Mittl. Höhe', value: isBuilding ? formatWithUnit(landcover.height_mean_m, 'm', 1) : 'Keine Angaben' }

      // 4. Features / Eigenschaften - The "Details"
      // (Reserved for future material/usage properties)
    ];

    const title = landcover.label || (isBuilding && landcover.egid ? `Gebäude ${landcover.egid}` : typeLabel) || `Bodenbedeckung #${landcover.id}`;

    showPanel({
      title,
      type: 'Bodenbedeckung',
      metrics
    });
  }

  // Close panel
  function closeBuildingPanel() {
    buildingPanel.classList.remove('open');
    state.selectedBuilding = null;
    state.selectedParcel = null;
    state.selectedLandcover = null;
    updateBuildingStyles();
    updateParcelStyles();
    updateLandcoverStyles();
    updateUrlParams();
  }

  // Panel close button
  closePanelBtn.addEventListener('click', closeBuildingPanel);

  async function flyToBuilding(id) {
    try {
      const { data, error } = await db
        .from('buildings')
        .select('id, label, egid, geog')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data && data.geog) {
        const geojson = wkbToGeoJSON(data.geog);
        if (geojson) {
          const [lon, lat] = geojson.coordinates;

          map.flyTo({
            center: [lon, lat],
            zoom: MAP_CONFIG.detailZoom,
            duration: MAP_CONFIG.flyDuration
          });

          showBuildingPanel({
            id: data.id,
            label: data.label,
            egid: data.egid,
            lon,
            lat
          });
        }
      }
    } catch (err) {
      console.error('Error flying to building:', err);
      showToast('Failed to navigate to building. Please try again.', 'error');
    }
  }

  function goHome() {
    map.fitBounds(SWITZERLAND_BOUNDS, {
      padding: MAP_CONFIG.boundsPadding,
      duration: MAP_CONFIG.standardDuration
    });
  }

  // ============================================
  // Initialize
  // ============================================
  // Note: urlParams is parsed earlier, before map creation, to set initial view correctly

  // Apply URL params for initial selection
  if (urlParams.building) state.selectedBuilding = urlParams.building;
  if (urlParams.parcel) state.selectedParcel = urlParams.parcel;
  if (urlParams.landcover) state.selectedLandcover = urlParams.landcover;
  if (urlParams.is3D) state.is3DMode = true;

  // Create search marker if marker param is true and coordinates provided
  if (urlParams.marker && urlParams.lon !== null && urlParams.lat !== null) {
    state.searchMarker = new maplibregl.Marker({ element: createSearchMarkerElement() })
      .setLngLat([urlParams.lon, urlParams.lat])
      .addTo(map);
  }

  map.on('load', async () => {
    // Add Switzerland border first (below other layers)
    await addSwitzerlandBorder();

    // Add vector tile layers (no data fetching needed!)
    // Layer order: parcels (bottom) -> landcover (middle) -> buildings (top)
    addParcelsLayer();
    addLandcoverLayer();
    addBuildingsLayer();

    // Always load terrain with exaggeration=0 for smooth 2D/3D transitions
    // This ensures objects are already positioned on the terrain mesh
    map.addSource('terrain-dem', {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15
    });
    map.setTerrain({ source: 'terrain-dem', exaggeration: 0 });

    // Unified click handler for parcels and landcover (respects layer hierarchy)
    // Buildings have their own handler with state.markerClickHandled flag
    map.on('click', (e) => {
      // Skip if a building marker was clicked (handled by building layer)
      if (state.markerClickHandled) return;

      // Query features at click point - check in priority order (top to bottom)
      const landcoverFeatures = map.queryRenderedFeatures(e.point, { layers: ['landcovers-fill'] });
      const parcelFeatures = map.queryRenderedFeatures(e.point, { layers: ['parcels-fill'] });

      // Select based on layer hierarchy: landcover (middle) > parcels (bottom)
      if (landcoverFeatures.length > 0) {
        selectLandcover(landcoverFeatures[0].properties.id);
      } else if (parcelFeatures.length > 0) {
        selectParcel(parcelFeatures[0].properties.id);
      }
    });

    // If no URL params, fit to Switzerland
    if (!urlParams.zoom) {
      map.fitBounds(SWITZERLAND_BOUNDS, { padding: MAP_CONFIG.boundsPadding, duration: MAP_CONFIG.standardDuration });
    }

    // Show panel for selected item from URL params
    await showSelectedPanel();

    // Apply 3D mode from URL params (no animation on initial load)
    if (state.is3DMode) {
      await setup3DMode(false);
    }

    loadingOverlay.classList.add('hidden');
  });

  // Update URL on map move
  map.on('moveend', updateUrlParams);

  // ============================================
  // Home Button
  // ============================================
  const homeButton = document.getElementById('homeBtn');
  homeButton.addEventListener('click', goHome);

  // Compass button - reset north
  const compassBtn = document.getElementById('compassBtn');
  const compassSvg = compassBtn.querySelector('svg');

  compassBtn.addEventListener('click', () => {
    map.easeTo({ bearing: 0, pitch: 0, duration: MAP_CONFIG.standardDuration });
  });

  // Rotate compass with map bearing (throttled with requestAnimationFrame)
  let pendingCompassBearing = null;
  let compassAnimationFrame = null;

  map.on('rotate', () => {
    pendingCompassBearing = map.getBearing();
    if (!compassAnimationFrame) {
      compassAnimationFrame = requestAnimationFrame(() => {
        if (pendingCompassBearing !== null) {
          compassSvg.style.transform = `rotate(${-pendingCompassBearing}deg)`;
        }
        compassAnimationFrame = null;
      });
    }
  });

  // ============================================
  // Basemap Selector
  // ============================================
  const basemapSelector = document.getElementById('basemapSelector');
  const basemapToggle = document.getElementById('basemapToggle');
  const basemapOptions = document.querySelectorAll('.basemap-option');

  // Toggle expand/collapse
  basemapToggle.addEventListener('click', () => {
    basemapSelector.classList.toggle('expanded');
  });

  // Consolidated handler for closing UI elements on outside click
  document.addEventListener('click', (e) => {
    // Close basemap selector if clicking outside
    if (!basemapSelector.contains(e.target)) {
      basemapSelector.classList.remove('expanded');
    }
    // Close search dropdown if clicking outside
    if (!e.target.closest('.search-container')) {
      closeSearchDropdown();
    }
  });

  basemapOptions.forEach(option => {
    option.addEventListener('click', () => {
      const styleKey = option.dataset.style;
      const styleClass = option.classList[1]; // light, streets, outdoors, satellite

      // Update active state
      basemapOptions.forEach(o => o.classList.remove('active'));
      option.classList.add('active');

      // Update toggle appearance
      basemapToggle.className = 'basemap-toggle ' + styleClass;

      // Collapse selector
      basemapSelector.classList.remove('expanded');

      // Change map style (Protomaps)
      map.setStyle(`https://api.protomaps.com/styles/v2/${styleKey}.json?key=${PROTOMAPS_KEY}`);

      // Re-add layers after new style loads
      // Using 'idle' event instead of 'load' - more reliable in MapLibre GL v4
      // The 'load' event can have timing issues if style is cached and loads quickly
      map.once('idle', async () => {
        // Re-add Switzerland border first
        await addSwitzerlandBorder();

        // Re-add vector tile layers in correct order
        // Layer order: parcels (bottom) -> landcover (middle) -> buildings (top)
        addParcelsLayer();
        addLandcoverLayer();
        addBuildingsLayer();

        // Re-apply color scheme after layers are re-added
        applyColorScheme();

        // Note: General click handler persists across style changes, no need to re-add

        // Re-apply 3D mode if active
        if (state.is3DMode) {
          setup3DTerrain();
        }
      });
    });
  });

  // ============================================
  // Legend Panel
  // ============================================
  const legendToggleBtn = document.getElementById('legendToggleBtn');
  const legendPanel = document.getElementById('legendPanel');
  const legendPanelClose = document.getElementById('legendPanelClose');
  const buildingsLegendItems = document.getElementById('buildingsLegendItems');
  const landcoversLegendItems = document.getElementById('landcoversLegendItems');
  const legendColorButtons = document.querySelectorAll('.legend-color-btn');
  const legendLayerToggles = document.querySelectorAll('.legend-layer-toggle');

  /**
   * Build MapLibre expression for data-driven fill color
   * @param {Object} scheme - Color scheme from COLOR_SCHEMES
   * @param {string} colorKey - 'colors' or 'outlineColors'
   * @returns {Array|string} MapLibre expression or default color
   */
  function buildColorExpression(scheme, colorKey = 'colors') {
    if (!scheme) {
      const config = polygonLayerConfigs.landcovers;
      return colorKey === 'colors' ? config.fillColor : config.outlineColor;
    }

    const { property } = scheme;
    const colorMap = scheme[colorKey];
    const defaultVal = colorKey === 'colors' ? scheme.defaultColor : scheme.defaultOutline;
    const matchExpression = ['match', ['get', property]];

    Object.entries(colorMap).forEach(([key, color]) => {
      matchExpression.push(key, color);
    });

    matchExpression.push(defaultVal); // fallback
    return matchExpression;
  }

  /**
   * Update landcover layer colors based on current color scheme
   */
  function applyColorScheme() {
    const scheme = COLOR_SCHEMES[state.colorScheme];
    const fillLayerExists = map.getLayer('landcovers-fill');
    const outlineLayerExists = map.getLayer('landcovers-outline');

    if (!fillLayerExists) return;

    const config = polygonLayerConfigs.landcovers;
    const fillExpression = buildColorExpression(scheme, 'colors');
    const outlineExpression = buildColorExpression(scheme, 'outlineColors');

    // Determine if we're in 3D mode
    const layer = map.getLayer('landcovers-fill');
    const is3D = layer && layer.type === 'fill-extrusion';

    // Higher opacity when color scheme is active for better visibility
    const activeOpacity = scheme ? 0.65 : config.fillOpacity;

    if (is3D) {
      map.setPaintProperty('landcovers-fill', 'fill-extrusion-color', fillExpression);
      map.setPaintProperty('landcovers-fill', 'fill-extrusion-opacity', scheme ? 0.85 : 0.8);
    } else {
      map.setPaintProperty('landcovers-fill', 'fill-color', fillExpression);
      map.setPaintProperty('landcovers-fill', 'fill-opacity', activeOpacity);
    }

    // Update outline color to match fill (darker shade)
    if (outlineLayerExists) {
      map.setPaintProperty('landcovers-outline', 'line-color', outlineExpression);
    }

    // Update landcovers legend section
    updateLandcoversLegend(scheme);
  }

  /**
   * Populate the buildings legend with status colors
   */
  function populateBuildingsLegend() {
    buildingsLegendItems.innerHTML = '';

    Object.entries(BUILDING_STATUS.colors).forEach(([key, color]) => {
      const label = BUILDING_STATUS.labels[key] || key;
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-swatch" style="background-color: ${color}"></span>
        <span class="legend-label">${label}</span>
      `;
      buildingsLegendItems.appendChild(item);
    });

    // Add missing values entry
    if (BUILDING_STATUS.missingLabel) {
      const missingItem = document.createElement('div');
      missingItem.className = 'legend-item';
      missingItem.innerHTML = `
        <span class="legend-swatch" style="background-color: ${BUILDING_STATUS.defaultColor}"></span>
        <span class="legend-label">${BUILDING_STATUS.missingLabel}</span>
      `;
      buildingsLegendItems.appendChild(missingItem);
    }
  }

  /**
   * Update the landcovers legend section
   * @param {Object|null} scheme - Color scheme or null for default
   */
  function updateLandcoversLegend(scheme) {
    landcoversLegendItems.innerHTML = '';

    if (!scheme) {
      // Show default single color entry when no scheme selected
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-swatch legend-swatch-square" style="background-color: ${polygonLayerConfigs.landcovers.fillColor}"></span>
        <span class="legend-label">Bodenbedeckung</span>
      `;
      landcoversLegendItems.appendChild(item);
      return;
    }

    // Add entries for each defined value
    Object.entries(scheme.colors).forEach(([key, color]) => {
      const label = scheme.labels[key] || key;
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-swatch legend-swatch-square" style="background-color: ${color}"></span>
        <span class="legend-label">${label}</span>
      `;
      landcoversLegendItems.appendChild(item);
    });

    // Add missing values entry
    if (scheme.missingLabel) {
      const missingItem = document.createElement('div');
      missingItem.className = 'legend-item';
      missingItem.innerHTML = `
        <span class="legend-swatch legend-swatch-square" style="background-color: ${scheme.defaultColor}"></span>
        <span class="legend-label">${scheme.missingLabel}</span>
      `;
      landcoversLegendItems.appendChild(missingItem);
    }
  }

  /**
   * Set the active color scheme for landcovers
   * @param {string} schemeName - 'none', 'category', or 'period'
   */
  function setColorScheme(schemeName) {
    state.colorScheme = schemeName;

    // Update button states
    legendColorButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === schemeName);
    });

    applyColorScheme();
  }

  /**
   * Toggle layer visibility
   * @param {string} layerName - 'buildings', 'landcovers', or 'parcels'
   * @param {boolean} visible - Whether the layer should be visible
   */
  function setLayerVisibility(layerName, visible) {
    const visibility = visible ? 'visible' : 'none';

    if (layerName === 'buildings') {
      if (map.getLayer('buildings-heat')) {
        map.setLayoutProperty('buildings-heat', 'visibility', visibility);
      }
      if (map.getLayer('unclustered-point')) {
        map.setLayoutProperty('unclustered-point', 'visibility', visibility);
      }
    } else if (layerName === 'landcovers') {
      if (map.getLayer('landcovers-fill')) {
        map.setLayoutProperty('landcovers-fill', 'visibility', visibility);
      }
      if (map.getLayer('landcovers-outline')) {
        map.setLayoutProperty('landcovers-outline', 'visibility', visibility);
      }
    } else if (layerName === 'parcels') {
      if (map.getLayer('parcels-fill')) {
        map.setLayoutProperty('parcels-fill', 'visibility', visibility);
      }
      if (map.getLayer('parcels-outline')) {
        map.setLayoutProperty('parcels-outline', 'visibility', visibility);
      }
    }

    // Update section styling
    const section = document.querySelector(`.legend-section[data-layer="${layerName}"]`);
    if (section) {
      section.classList.toggle('layer-hidden', !visible);
    }
  }

  // Legend panel toggle
  legendToggleBtn.addEventListener('click', () => {
    const isVisible = legendPanel.classList.toggle('visible');
    legendToggleBtn.classList.toggle('active', isVisible);
  });

  legendPanelClose.addEventListener('click', () => {
    legendPanel.classList.remove('visible');
    legendToggleBtn.classList.remove('active');
  });

  // Color scheme toggle buttons
  legendColorButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setColorScheme(btn.dataset.color);
    });
  });

  // Layer visibility toggles
  legendLayerToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const isActive = toggle.classList.toggle('active');
      const layerName = toggle.dataset.layer;
      setLayerVisibility(layerName, isActive);
    });
  });

  // Initialize legends on load
  populateBuildingsLegend();
  updateLandcoversLegend(null);

  // ============================================
  // 3D Toggle
  // ============================================
  const toggle3DButton = document.getElementById('toggle3DBtn');

  /**
   * Convert landcover layer between flat fill and 3D fill-extrusion
   * @param {boolean} is3D - Whether to use 3D fill-extrusion or flat fill
   */
  function setLandcoverLayerType(is3D) {
    if (!map.getLayer('landcovers-fill')) return;

    try {
      const beforeLayer = map.getLayer('landcovers-outline') ? 'landcovers-outline' : undefined;
      const config = polygonLayerConfigs.landcovers;

      // Get current color scheme expressions
      const scheme = COLOR_SCHEMES[state.colorScheme];
      const colorExpression = buildColorExpression(scheme, 'colors');
      const outlineExpression = buildColorExpression(scheme, 'outlineColors');

      // Higher opacity when color scheme is active
      const activeOpacity = scheme ? 0.65 : config.fillOpacity;

      map.removeLayer('landcovers-fill');
      map.addLayer({
        id: 'landcovers-fill',
        type: is3D ? 'fill-extrusion' : 'fill',
        source: 'landcovers',
        'source-layer': 'landcovers',
        minzoom: 12,
        paint: is3D ? {
          'fill-extrusion-color': colorExpression,
          'fill-extrusion-height': 10,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': scheme ? 0.85 : 0.8
        } : {
          'fill-color': colorExpression,
          'fill-opacity': activeOpacity
        }
      }, beforeLayer);

      // Update outline color to match
      if (map.getLayer('landcovers-outline')) {
        map.setPaintProperty('landcovers-outline', 'line-color', outlineExpression);
      }
    } catch (err) {
      debugWarn(`Failed to ${is3D ? 'add' : 'restore'} landcover fill:`, err);
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
          debugWarn('Failed to animate terrain/camera:', err);
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
   * Setup 3D mode: add sky layer, convert landcover, set exaggeration and pitch
   * @param {boolean} animate - Whether to animate the transition
   */
  async function setup3DMode(animate = true) {
    // Add sky layer for better 3D visuals
    if (!map.getLayer('sky')) {
      map.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 90.0],
          'sky-atmosphere-sun-intensity': 15
        }
      });
    }

    // Convert landcover to fill-extrusion for 3D view
    setLandcoverLayerType(true);

    if (animate) {
      // Animate terrain and camera together with same easing
      await animateTerrainAndCamera({
        fromExaggeration: 0,
        toExaggeration: MAP_CONFIG.terrainExaggeration,
        fromPitch: map.getPitch(),
        toPitch: MAP_CONFIG.pitch3D,
        duration: MAP_CONFIG.standardDuration
      });
    } else {
      // Instant - for initial page load from URL params
      map.setTerrain({ source: 'terrain-dem', exaggeration: MAP_CONFIG.terrainExaggeration });
      map.setPitch(MAP_CONFIG.pitch3D);
    }

    toggle3DButton.textContent = '2D';
  }

  /**
   * Exit 3D mode: remove sky layer, flatten terrain, reset pitch
   * @param {boolean} animate - Whether to animate the transition
   */
  async function exit3DMode(animate = true) {
    if (animate) {
      // Animate terrain and camera together with same easing
      await animateTerrainAndCamera({
        fromExaggeration: MAP_CONFIG.terrainExaggeration,
        toExaggeration: 0,
        fromPitch: map.getPitch(),
        toPitch: 0,
        duration: MAP_CONFIG.standardDuration
      });
    } else {
      map.setTerrain({ source: 'terrain-dem', exaggeration: 0 });
      map.setPitch(0);
    }

    // Remove sky layer
    if (map.getLayer('sky')) {
      map.removeLayer('sky');
    }

    // Convert landcover back to flat fill
    setLandcoverLayerType(false);

    toggle3DButton.textContent = '3D';
  }

  async function toggle3D() {
    state.is3DMode = !state.is3DMode;

    // Disable button during transition to prevent double-clicks
    toggle3DButton.disabled = true;
    toggle3DButton.textContent = '...';

    if (state.is3DMode) {
      await setup3DMode(true);
    } else {
      await exit3DMode(true);
    }

    toggle3DButton.disabled = false;
    updateUrlParams();
  }

  toggle3DButton.addEventListener('click', toggle3D);

  // ============================================
  // Swisstopo Search
  // ============================================
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const searchDropdown = document.getElementById('searchDropdown');
  const locationsSection = document.getElementById('locationsSection');
  const locationsResults = document.getElementById('locationsResults');
  const layersSection = document.getElementById('layersSection');
  const layersResults = document.getElementById('layersResults');
  const searchInputWrapper = searchInput.parentElement;

  let searchDebounceTimer = null;

  // Debounced search
  function debounce(fn, delay) {
    return (...args) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => fn(...args), delay);
    };
  }

  // Search API call
  async function searchSwisstopo(query) {
    if (!query || query.length < 2) {
      closeSearchDropdown();
      return;
    }

    try {
      const url = `https://api3.geo.admin.ch/rest/services/ech/SearchServer?searchText=${encodeURIComponent(query)}&type=locations&type=layers&lang=de&sr=4326`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Search request failed');
      const data = await response.json();

      displaySearchResults(data.results, query);
    } catch (err) {
      console.error('Search error:', err);
      showToast('Search failed. Please try again.', 'error');
      closeSearchDropdown();
    }
  }

  // Safely extract text from HTML and escape for display
  function sanitizeAndExtractText(html) {
    if (!html) return '';
    // Create a temporary element to decode HTML entities and extract text
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }

  // Escape HTML special characters to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Highlight matching text (safe - only adds <mark> tags to escaped content)
  function highlightMatch(text, query) {
    if (!text) return '';
    // First escape the text to prevent XSS
    const escapedText = escapeHtml(text);
    // Escape regex special characters in query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Now safely highlight (the text is already escaped, so <mark> tags are safe to add)
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escapedText.replace(regex, '<mark>$1</mark>');
  }

  // Display results (using DocumentFragment for batched DOM operations)
  function displaySearchResults(results, query) {
    // Single-pass filtering using Set for O(1) lookups
    const locationOrigins = new Set(['address', 'zipcode', 'sn25', 'gg25', 'district', 'canton', 'gazetteer']);
    const locations = [];
    const layers = [];

    for (const r of results) {
      if (locationOrigins.has(r.attrs.origin)) {
        locations.push(r);
      } else if (r.attrs.origin === 'layer') {
        layers.push(r);
      }
    }

    // Clear previous results
    locationsResults.innerHTML = '';
    layersResults.innerHTML = '';

    // Locations - batch DOM operations with DocumentFragment
    if (locations.length > 0) {
      locationsSection.classList.add('has-results');
      const fragment = document.createDocumentFragment();
      locations.slice(0, 10).forEach(loc => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        // Safely extract text and highlight matches
        const cleanLabel = sanitizeAndExtractText(loc.attrs.label);
        item.innerHTML = highlightMatch(cleanLabel, query);
        item.addEventListener('click', () => {
          goToLocation(loc);
        });
        fragment.appendChild(item);
      });
      locationsResults.appendChild(fragment); // Single DOM write
    } else {
      locationsSection.classList.remove('has-results');
    }

    // Layers (disabled for now) - batch DOM operations with DocumentFragment
    if (layers.length > 0) {
      layersSection.classList.add('has-results');
      const fragment = document.createDocumentFragment();
      layers.slice(0, 10).forEach(layer => {
        const item = document.createElement('div');
        item.className = 'search-result-item disabled';
        // Safely extract text and highlight matches
        const cleanLabel = sanitizeAndExtractText(layer.attrs.label);
        item.innerHTML = highlightMatch(cleanLabel, query);
        fragment.appendChild(item);
      });
      layersResults.appendChild(fragment); // Single DOM write
    } else {
      layersSection.classList.remove('has-results');
    }

    // Show dropdown if we have results
    if (locations.length > 0 || layers.length > 0) {
      searchDropdown.classList.add('open');
    } else {
      closeSearchDropdown();
    }
  }

  // Go to location
  function goToLocation(loc) {
    // With sr=4326, y=lat, x=lon in WGS84
    const lon = loc.attrs.x;
    const lat = loc.attrs.y;

    // Remove existing search marker
    if (state.searchMarker) {
      state.searchMarker.remove();
    }

    // Create new search marker
    state.searchMarker = new maplibregl.Marker({ element: createSearchMarkerElement() })
      .setLngLat([lon, lat])
      .addTo(map);

    // Fly to location
    map.flyTo({
      center: [lon, lat],
      zoom: MAP_CONFIG.searchZoom,
      duration: MAP_CONFIG.flyDuration
    });

    closeSearchDropdown();
  }

  function closeSearchDropdown() {
    searchDropdown.classList.remove('open');
  }

  // Input handlers
  const debouncedSearch = debounce(searchSwisstopo, UI_TIMING.searchDebounce);

  searchInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();

    if (value) {
      searchInputWrapper.classList.add('has-value');
    } else {
      searchInputWrapper.classList.remove('has-value');
    }

    debouncedSearch(value);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2) {
      debouncedSearch(searchInput.value.trim());
    }
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchInputWrapper.classList.remove('has-value');
    closeSearchDropdown();
    searchInput.focus();
  });

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearchDropdown();
      closeContextMenu();
      searchInput.blur();
    }
  });

  // ============================================
  // Map Context Menu (right-click)
  // ============================================
  const contextMenu = document.getElementById('mapContextMenu');
  const contextMenuCoords = document.getElementById('contextMenuCoords');
  const contextMenuCoordsText = contextMenuCoords.querySelector('.coords-text');
  const contextMenuShare = document.getElementById('contextMenuShare');
  const contextMenuPrint = document.getElementById('contextMenuPrint');
  const contextMenuMeasure = document.getElementById('contextMenuMeasure');
  const contextMenuReport = document.getElementById('contextMenuReport');

  // Store current context menu coordinates
  let contextMenuLngLat = null;

  function openContextMenu(x, y, lngLat) {
    contextMenuLngLat = lngLat;

    // Update coordinates display (lat, lng format like Google Maps)
    const lat = lngLat.lat.toFixed(5);
    const lng = lngLat.lng.toFixed(5);
    contextMenuCoordsText.textContent = `${lat}, ${lng}`;

    // Position menu, ensuring it stays within viewport
    const menuWidth = 220;
    const menuHeight = 200;
    const mapContainer = document.getElementById('map');
    const mapRect = mapContainer.getBoundingClientRect();

    // Adjust position if menu would overflow
    let menuX = x;
    let menuY = y;

    if (x + menuWidth > mapRect.right) {
      menuX = x - menuWidth;
    }
    if (y + menuHeight > mapRect.bottom) {
      menuY = y - menuHeight;
    }

    contextMenu.style.left = `${menuX}px`;
    contextMenu.style.top = `${menuY}px`;
    contextMenu.classList.add('open');
  }

  function closeContextMenu() {
    contextMenu.classList.remove('open');
    contextMenuLngLat = null;
  }

  // Right-click on map opens context menu
  map.on('contextmenu', (e) => {
    e.preventDefault();
    openContextMenu(e.point.x, e.point.y, e.lngLat);
  });

  // Also handle contextmenu on the map container for consistency
  document.getElementById('map').addEventListener('contextmenu', (e) => {
    // Let MapLibre handle it - this prevents the browser default
    e.preventDefault();
  });

  // Close context menu when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
      closeContextMenu();
    }
  });

  // Close context menu when map moves
  map.on('movestart', closeContextMenu);

  // Copy coordinates to clipboard
  contextMenuCoords.addEventListener('click', async () => {
    if (!contextMenuLngLat) return;

    const lat = contextMenuLngLat.lat.toFixed(5);
    const lng = contextMenuLngLat.lng.toFixed(5);
    const coordsText = `${lat}, ${lng}`;

    try {
      await navigator.clipboard.writeText(coordsText);
      showToast('Coordinates copied to clipboard', 'success');
    } catch (err) {
      console.error('Failed to copy coordinates:', err);
      showToast('Failed to copy coordinates', 'error');
    }

    closeContextMenu();
  });

  // Share location
  contextMenuShare.addEventListener('click', async () => {
    if (!contextMenuLngLat) return;

    const lat = contextMenuLngLat.lat.toFixed(5);
    const lng = contextMenuLngLat.lng.toFixed(5);
    const zoom = map.getZoom().toFixed(2);

    // Build share URL with current location
    const shareUrl = `${window.location.origin}${window.location.pathname}?lat=${lat}&lon=${lng}&zoom=${zoom}&marker=true`;

    // Try native share API first (mobile), fallback to clipboard
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'OpenBuildings.ch Location',
          text: `Location: ${lat}, ${lng}`,
          url: shareUrl
        });
      } catch (err) {
        // User cancelled or share failed, try clipboard
        if (err.name !== 'AbortError') {
          await copyShareUrl(shareUrl);
        }
      }
    } else {
      await copyShareUrl(shareUrl);
    }

    closeContextMenu();
  });

  async function copyShareUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard', 'success');
    } catch (err) {
      console.error('Failed to copy link:', err);
      showToast('Failed to copy link', 'error');
    }
  }

  // Print
  contextMenuPrint.addEventListener('click', () => {
    closeContextMenu();
    window.print();
  });

  // Measure distance (placeholder - disabled)
  contextMenuMeasure.addEventListener('click', () => {
    showToast('Measure distance coming soon', 'info');
    closeContextMenu();
  });

  // Report a data problem (placeholder - disabled)
  contextMenuReport.addEventListener('click', () => {
    showToast('Report feature coming soon', 'info');
    closeContextMenu();
  });

  } catch (err) {
    // Catch any unexpected errors during initialization
    console.error('Initialization error:', err);
    showFatalError('An unexpected error occurred while loading the application. Please try reloading the page.');
  }
}
