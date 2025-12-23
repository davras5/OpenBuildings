/**
 * OpenBuildings.ch - Main Application
 * Swiss building data visualization
 */

// ============================================
// CONFIGURATION
// ============================================

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

// ============================================
// Wait for DOM and scripts to load
// ============================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // ============================================
  // Toast Notification System
  // ============================================
  const toastContainer = document.getElementById('toastContainer');

  function showToast(message, type = 'error', duration = 4000) {
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
      setTimeout(() => toast.remove(), 300);
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

  // Mouse coordinates display
  const mouseCoordsDisplay = document.getElementById('mouseCoords');

  map.on('mousemove', (e) => {
    const lng = e.lngLat.lng.toFixed(5);
    const lat = e.lngLat.lat.toFixed(5);
    mouseCoordsDisplay.textContent = `${lng}, ${lat}`;
  });

  map.on('mouseout', () => {
    mouseCoordsDisplay.textContent = '–';
  });

  // ============================================
  // State (selection only - data now served via vector tiles)
  // ============================================

  // ============================================
  // DOM Elements
  // ============================================
  const loadingOverlay = document.getElementById('loadingOverlay');
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
    searchMarker: null
  };

  // ============================================
  // Functions
  // ============================================

  // Simple EWKB parser for Point and Polygon
  function wkbToGeoJSON(hex) {
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
        return { type: 'Point', coordinates: [x, y] };
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

        return { type: 'Polygon', coordinates: rings };
      }

      console.warn('Unsupported geometry type:', geomType);
      return null;

    } catch (err) {
      console.error('WKB decode error:', err);
      return null;
    }
  }

  // NOTE: fetchBuildings() and fetchParcels() removed - data now served via vector tiles

  function addParcelsLayer() {
    // Skip if source already exists
    if (map.getSource('parcels')) return;

    // Add vector tile source for parcels
    map.addSource('parcels', {
      type: 'vector',
      tiles: [`${TILE_SERVER}/parcels/{z}/{x}/{y}.pbf`],
      minzoom: 10,
      maxzoom: 14,
      bounds: SWITZERLAND_BOUNDS
    });

    // Add fill layer
    map.addLayer({
      id: 'parcels-fill',
      type: 'fill',
      source: 'parcels',
      'source-layer': 'parcels',
      minzoom: 12,
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'id'], state.selectedParcel || -1], '#059669', // Green when selected
          '#1e3a5f' // Deep Blue default
        ],
        'fill-opacity': [
          'case',
          ['==', ['get', 'id'], state.selectedParcel || -1], 0.3,
          0.1
        ]
      }
    });

    // Add outline layer
    map.addLayer({
      id: 'parcels-outline',
      type: 'line',
      source: 'parcels',
      'source-layer': 'parcels',
      minzoom: 12,
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'id'], state.selectedParcel || -1], '#059669',
          '#1e3a5f'
        ],
        'line-width': [
          'case',
          ['==', ['get', 'id'], state.selectedParcel || -1], 3,
          1.5
        ]
      }
    });

    // Add hover effect
    map.on('mouseenter', 'parcels-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'parcels-fill', () => {
      map.getCanvas().style.cursor = '';
    });

  }

  function addLandcoverLayer() {
    // Skip if source already exists
    if (map.getSource('landcover')) return;

    // Add vector tile source for landcover
    map.addSource('landcover', {
      type: 'vector',
      tiles: [`${TILE_SERVER}/landcover/{z}/{x}/{y}.pbf`],
      minzoom: 10,
      maxzoom: 14,
      bounds: SWITZERLAND_BOUNDS
    });

    // Add flat fill layer (extrusion only in 3D mode)
    map.addLayer({
      id: 'landcover-fill',
      type: 'fill',
      source: 'landcover',
      'source-layer': 'landcover',
      minzoom: 12,
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'id'], state.selectedLandcover || -1], '#059669', // Green when selected
          '#8b5cf6' // Purple default for landcover
        ],
        'fill-opacity': [
          'case',
          ['==', ['get', 'id'], state.selectedLandcover || -1], 0.4,
          0.2
        ]
      }
    });

    // Add outline layer
    map.addLayer({
      id: 'landcover-outline',
      type: 'line',
      source: 'landcover',
      'source-layer': 'landcover',
      minzoom: 12,
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'id'], state.selectedLandcover || -1], '#059669',
          '#7c3aed' // Darker purple for outline
        ],
        'line-width': [
          'case',
          ['==', ['get', 'id'], state.selectedLandcover || -1], 3,
          1.5
        ]
      }
    });

    // Add hover effect
    map.on('mouseenter', 'landcover-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'landcover-fill', () => {
      map.getCanvas().style.cursor = '';
    });

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
      console.error('Failed to load Switzerland border:', err);
      // Non-critical feature, no toast needed - border is decorative
    }
  }

  function addBuildingsLayer() {
    // Skip if source already exists
    if (map.getSource('buildings')) return;

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
          '#64748b' // Slate-500 default
        ],
        'circle-stroke-width': [
          'interpolate', ['linear'], ['zoom'],
          10, 0,
          12, ['case', ['==', ['get', 'id'], state.selectedBuilding || -1], 3, 2]
        ],
        'circle-stroke-color': [
          'case',
          ['==', ['get', 'id'], state.selectedBuilding || -1], '#1e3a5f', // Deep Blue
          'white'
        ],
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 12, 1]
      }
    });

    // Click handler for buildings
    map.on('click', 'unclustered-point', (e) => {
      state.markerClickHandled = true;
      const props = e.features[0].properties;
      const coords = e.features[0].geometry.coordinates;
      selectBuilding(props.id, coords);
      setTimeout(() => { state.markerClickHandled = false; }, 100);
    });

    // Hover effects
    map.on('mouseenter', 'unclustered-point', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'unclustered-point', () => {
      map.getCanvas().style.cursor = '';
    });
  }

  function updateBuildingStyles() {
    if (!map.getLayer('unclustered-point')) return;

    map.setPaintProperty('unclustered-point', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], state.selectedBuilding || -1], 10,
      7
    ]);
    map.setPaintProperty('unclustered-point', 'circle-color', [
      'case',
      ['==', ['get', 'id'], state.selectedBuilding || -1], '#059669', // Leaf green when selected
      '#64748b' // Slate-500 default
    ]);
    map.setPaintProperty('unclustered-point', 'circle-stroke-width', [
      'case',
      ['==', ['get', 'id'], state.selectedBuilding || -1], 3,
      2
    ]);
    map.setPaintProperty('unclustered-point', 'circle-stroke-color', [
      'case',
      ['==', ['get', 'id'], state.selectedBuilding || -1], '#1e3a5f', // Deep Blue
      'white'
    ]);
  }

  async function selectBuilding(id, coords = null) {
    state.selectedBuilding = id;
    state.selectedParcel = null;
    state.selectedLandcover = null;
    updateUrlParams();
    // For buildings, pass coords directly since showSelectedPanel doesn't have them
    updateBuildingStyles();
    updateParcelStyles();
    updateLandcoverStyles();
    await fetchAndShowBuilding(id, coords);
  }

  async function selectParcel(id) {
    state.selectedParcel = id;
    state.selectedBuilding = null;
    state.selectedLandcover = null;
    updateUrlParams();
    await showSelectedPanel();
  }

  async function selectLandcover(id) {
    state.selectedLandcover = id;
    state.selectedBuilding = null;
    state.selectedParcel = null;
    updateUrlParams();
    await showSelectedPanel();
  }

  // Single function to show panel based on what's selected (from URL params)
  async function showSelectedPanel() {
    updateBuildingStyles();
    updateParcelStyles();
    updateLandcoverStyles();

    if (state.selectedBuilding) {
      await fetchAndShowBuilding(state.selectedBuilding);
    } else if (state.selectedLandcover) {
      await fetchAndShowLandcover(state.selectedLandcover);
    } else if (state.selectedParcel) {
      await fetchAndShowParcel(state.selectedParcel);
    }
  }

  // Fetch building from Supabase and show panel
  async function fetchAndShowBuilding(id, coords = null) {
    try {
      const { data, error } = await db
        .from('buildings')
        .select('id, name, egid, geog')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        // Parse coordinates from geog if available
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

        showBuildingPanel({
          id: data.id,
          name: data.name,
          egid: data.egid,
          lon,
          lat
        });
      }
    } catch (err) {
      console.error('Error fetching building:', err);
      showToast('Failed to load building details. Please try again.', 'error');
    }
  }

  // Fetch parcel from Supabase and show panel
  async function fetchAndShowParcel(id) {
    try {
      const { data, error } = await db
        .from('parcels')
        .select('id, name, egrid, building_id')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        showParcelPanel(data);
      }
    } catch (err) {
      console.error('Error fetching parcel:', err);
      showToast('Failed to load parcel details. Please try again.', 'error');
    }
  }

  // Fetch landcover from Supabase and show panel
  async function fetchAndShowLandcover(id) {
    try {
      const { data, error } = await db
        .from('landcover')
        .select('id, egid, created_at')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        showLandcoverPanel(data);
      }
    } catch (err) {
      console.error('Error fetching landcover:', err);
      showToast('Failed to load landcover details. Please try again.', 'error');
    }
  }

  function updateParcelStyles() {
    if (!map.getLayer('parcels-fill')) return;

    if (state.selectedParcel) {
      map.setPaintProperty('parcels-fill', 'fill-opacity', [
        'case',
        ['==', ['get', 'id'], state.selectedParcel], 0.25,
        0.1
      ]);
      map.setPaintProperty('parcels-outline', 'line-width', [
        'case',
        ['==', ['get', 'id'], state.selectedParcel], 3,
        1.5
      ]);
    } else {
      map.setPaintProperty('parcels-fill', 'fill-opacity', 0.1);
      map.setPaintProperty('parcels-outline', 'line-width', 1.5);
    }
  }

  function updateLandcoverStyles() {
    if (!map.getLayer('landcover-fill')) return;

    // Use appropriate property based on layer type
    const opacityProp = state.is3DMode ? 'fill-extrusion-opacity' : 'fill-opacity';

    if (state.selectedLandcover) {
      map.setPaintProperty('landcover-fill', opacityProp, [
        'case',
        ['==', ['get', 'id'], state.selectedLandcover], state.is3DMode ? 0.6 : 0.4,
        state.is3DMode ? 0.4 : 0.2
      ]);
      map.setPaintProperty('landcover-outline', 'line-width', [
        'case',
        ['==', ['get', 'id'], state.selectedLandcover], 3,
        1.5
      ]);
    } else {
      map.setPaintProperty('landcover-fill', opacityProp, state.is3DMode ? 0.4 : 0.2);
      map.setPaintProperty('landcover-outline', 'line-width', 1.5);
    }
  }

  // Show building panel with details
  function showBuildingPanel(building) {
    // Title: name → egid → #id
    const title = building.name || building.egid || `#${building.id}`;
    panelBuildingName.textContent = title;
    panelBuildingLocation.textContent = 'Building';

    const hasCoords = building.lat != null && building.lon != null;

    // Build metrics HTML
    const metrics = [
      { label: 'EGID', value: building.egid || '–' }
    ];

    if (hasCoords) {
      metrics.push({ label: 'Coordinates', value: `${building.lat.toFixed(5)}, ${building.lon.toFixed(5)}` });
    }

    panelMetrics.innerHTML = metrics.map(m => `
      <div class="metric-row">
        <span class="metric-label">${m.label}</span>
        <span class="metric-value">${m.value}</span>
      </div>
    `).join('');

    buildingPanel.classList.add('open');
  }

  // Show parcel panel with details
  function showParcelPanel(parcel) {
    // Title: egrid → #id
    const title = parcel.egrid || `#${parcel.id}`;
    panelBuildingName.textContent = title;
    panelBuildingLocation.textContent = 'Parcel';

    // Build metrics HTML
    const metrics = [
      { label: 'E-GRID', value: parcel.egrid || '–' },
      { label: 'ID', value: parcel.id || '–' }
    ];

    // Add building reference if exists
    if (parcel.building_id) {
      metrics.push({ label: 'Building ID', value: parcel.building_id });
    }

    panelMetrics.innerHTML = metrics.map(m => `
      <div class="metric-row">
        <span class="metric-label">${m.label}</span>
        <span class="metric-value">${m.value}</span>
      </div>
    `).join('');

    buildingPanel.classList.add('open');
  }

  // Format landcover type for display (e.g., 'road_path' → 'Road/Path')
  function formatLandcoverType(type) {
    if (!type) return 'Unknown';

    const typeLabels = {
      'building': 'Building',
      'hardened_area': 'Hardened Area',
      'greenhouse': 'Greenhouse',
      'perennial_culture_shelter': 'Perennial Culture Shelter',
      'reservoir': 'Reservoir',
      'other_hardened': 'Other Hardened',
      'railway': 'Railway',
      'road_path': 'Road/Path',
      'field_meadow_pasture': 'Field/Meadow/Pasture',
      'vineyard': 'Vineyard',
      'other_intensive_culture': 'Other Intensive Culture',
      'garden': 'Garden',
      'moor': 'Moor',
      'other_humusised': 'Other Humusised',
      'standing_water': 'Standing Water',
      'flowing_water': 'Flowing Water',
      'reed_belt': 'Reed Belt',
      'closed_forest': 'Closed Forest',
      'dense_wooded_pasture': 'Dense Wooded Pasture',
      'open_wooded_pasture': 'Open Wooded Pasture',
      'other_wooded': 'Other Wooded',
      'rock': 'Rock',
      'glacier_firn': 'Glacier/Firn',
      'gravel_sand': 'Gravel/Sand',
      'quarry_dump': 'Quarry/Dump',
      'other_unvegetated': 'Other Unvegetated'
    };

    return typeLabels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Show landcover panel with details
  function showLandcoverPanel(landcover) {
    // Title: egid → #id
    const title = landcover.egid || `#${landcover.id}`;
    panelBuildingName.textContent = title;
    panelBuildingLocation.textContent = 'Landcover';

    // Build metrics HTML
    const metrics = [
      { label: 'ID', value: landcover.id || '–' }
    ];

    // Add EGID if available
    if (landcover.egid) {
      metrics.push({ label: 'EGID', value: landcover.egid });
    }

    panelMetrics.innerHTML = metrics.map(m => `
      <div class="metric-row">
        <span class="metric-label">${m.label}</span>
        <span class="metric-value">${m.value}</span>
      </div>
    `).join('');

    buildingPanel.classList.add('open');
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
        .select('id, name, egid, geog')
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
            name: data.name,
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
    const el = document.createElement('div');
    el.innerHTML = `
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" fill="#2563eb"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
      </svg>
    `;
    el.style.cssText = 'cursor: pointer; transform: translate(-50%, -100%);';

    state.searchMarker = new maplibregl.Marker({ element: el })
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

    // Unified click handler for parcels and landcover (respects layer hierarchy)
    // Buildings have their own handler with state.markerClickHandled flag
    map.on('click', (e) => {
      // Skip if a building marker was clicked (handled by building layer)
      if (state.markerClickHandled) return;

      // Query features at click point - check in priority order (top to bottom)
      const landcoverFeatures = map.queryRenderedFeatures(e.point, { layers: ['landcover-fill'] });
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

    // Apply 3D mode from URL params
    if (state.is3DMode) {
      setup3DTerrain();
      map.setPitch(MAP_CONFIG.pitch3D);
      toggle3DButton.textContent = '2D';
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

  // Rotate compass with map bearing
  map.on('rotate', () => {
    const bearing = map.getBearing();
    compassSvg.style.transform = `rotate(${-bearing}deg)`;
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

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!basemapSelector.contains(e.target)) {
      basemapSelector.classList.remove('expanded');
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

        // Note: General click handler persists across style changes, no need to re-add

        // Re-apply 3D mode if active
        if (state.is3DMode) {
          setup3DTerrain();
        }
      });
    });
  });

  // ============================================
  // 3D Toggle
  // ============================================
  const toggle3DButton = document.getElementById('toggle3DBtn');

  function setup3DTerrain() {
    // Add AWS Terrarium terrain source if not exists
    if (!map.getSource('terrain-dem')) {
      map.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15
      });
    }

    // Enable terrain
    try {
      map.setTerrain({ source: 'terrain-dem', exaggeration: MAP_CONFIG.terrainExaggeration });

      // Force terrain tiles to reload at correct LOD by triggering a tiny zoom adjustment
      const currentZoom = map.getZoom();
      map.setZoom(currentZoom - 0.01);
      requestAnimationFrame(() => map.setZoom(currentZoom));
    } catch (err) {
      console.error('Failed to enable terrain:', err);
    }

    // Convert landcover (building footprints) to fill-extrusion for 3D view
    if (map.getLayer('landcover-fill')) {
      try {
        // Get the outline layer position if it exists
        const beforeLayer = map.getLayer('landcover-outline') ? 'landcover-outline' : undefined;

        map.removeLayer('landcover-fill');
        map.addLayer({
          id: 'landcover-fill',
          type: 'fill-extrusion',
          source: 'landcover',
          'source-layer': 'landcover',
          minzoom: 12,
          paint: {
            'fill-extrusion-color': [
              'case',
              ['==', ['get', 'id'], state.selectedLandcover || -1], '#059669',
              '#8b5cf6'
            ],
            'fill-extrusion-height': 10,
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.8
          }
        }, beforeLayer);
      } catch (err) {
        console.error('Failed to add landcover fill-extrusion:', err);
      }
    }
  }

  function remove3DTerrain() {
    // Disable terrain
    map.setTerrain(null);

    // Convert landcover back to flat fill
    if (map.getLayer('landcover-fill')) {
      try {
        const beforeLayer = map.getLayer('landcover-outline') ? 'landcover-outline' : undefined;

        map.removeLayer('landcover-fill');
        map.addLayer({
          id: 'landcover-fill',
          type: 'fill',
          source: 'landcover',
          'source-layer': 'landcover',
          minzoom: 12,
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'id'], state.selectedLandcover || -1], '#059669',
              '#8b5cf6'
            ],
            'fill-opacity': [
              'case',
              ['==', ['get', 'id'], state.selectedLandcover || -1], 0.4,
              0.2
            ]
          }
        }, beforeLayer);
      } catch (err) {
        console.error('Failed to restore landcover fill:', err);
      }
    }
  }

  function toggle3D() {
    state.is3DMode = !state.is3DMode;

    if (state.is3DMode) {
      setup3DTerrain();
      // Pitch camera for 3D perspective
      map.easeTo({ pitch: MAP_CONFIG.pitch3D, duration: MAP_CONFIG.standardDuration });
      toggle3DButton.textContent = '2D';
    } else {
      remove3DTerrain();
      // Reset camera to flat view
      map.easeTo({ pitch: 0, duration: MAP_CONFIG.standardDuration });
      toggle3DButton.textContent = '3D';
    }

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

  // Display results
  function displaySearchResults(results, query) {
    const locations = results.filter(r => r.attrs.origin === 'address' || r.attrs.origin === 'zipcode' || r.attrs.origin === 'sn25' || r.attrs.origin === 'gg25' || r.attrs.origin === 'district' || r.attrs.origin === 'canton' || r.attrs.origin === 'gazetteer');
    const layers = results.filter(r => r.attrs.origin === 'layer');

    // Clear previous results
    locationsResults.innerHTML = '';
    layersResults.innerHTML = '';

    // Locations
    if (locations.length > 0) {
      locationsSection.classList.add('has-results');
      locations.slice(0, 10).forEach(loc => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        // Safely extract text and highlight matches
        const cleanLabel = sanitizeAndExtractText(loc.attrs.label);
        item.innerHTML = highlightMatch(cleanLabel, query);
        item.addEventListener('click', () => {
          goToLocation(loc);
        });
        locationsResults.appendChild(item);
      });
    } else {
      locationsSection.classList.remove('has-results');
    }

    // Layers (disabled for now)
    if (layers.length > 0) {
      layersSection.classList.add('has-results');
      layers.slice(0, 10).forEach(layer => {
        const item = document.createElement('div');
        item.className = 'search-result-item disabled';
        // Safely extract text and highlight matches
        const cleanLabel = sanitizeAndExtractText(layer.attrs.label);
        item.innerHTML = highlightMatch(cleanLabel, query);
        layersResults.appendChild(item);
      });
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

    // Create new search marker (different style from building markers)
    const el = document.createElement('div');
    el.innerHTML = `
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" fill="#2563eb"/>
        <circle cx="16" cy="16" r="6" fill="white"/>
      </svg>
    `;
    el.style.cssText = 'cursor: pointer; transform: translate(-50%, -100%);';

    state.searchMarker = new maplibregl.Marker({ element: el })
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
  const debouncedSearch = debounce(searchSwisstopo, 300);

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

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      closeSearchDropdown();
    }
  });

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearchDropdown();
      searchInput.blur();
    }
  });
}
