/**
 * OpenBuildings.ch - Search Module
 * Lazy-loaded module for Swisstopo search functionality
 */

// Module-level references (set during init)
let map = null;
let state = null;
let config = null;
let maplibregl = null;

// DOM elements (set during init)
let searchInput = null;
let searchClear = null;
let searchDropdown = null;
let locationsSection = null;
let locationsResults = null;
let layersSection = null;
let layersResults = null;
let searchInputWrapper = null;

// Store additional dependencies
const moduleDeps = {};

// Debounce timer
let searchDebounceTimer = null;

/**
 * Initialize the search module with required dependencies
 * @param {Object} deps - Dependencies from main app
 * @param {Object} deps.map - MapLibre map instance
 * @param {Object} deps.state - Application state
 * @param {Object} deps.config - MAP_CONFIG constants
 * @param {Object} deps.uiTiming - UI_TIMING constants
 * @param {Object} deps.maplibregl - MapLibre GL library reference
 * @param {Function} deps.showToast - Toast notification function
 * @param {Function} deps.createSearchMarkerElement - Marker element creator
 */
export function init(deps) {
  map = deps.map;
  state = deps.state;
  config = deps.config;
  maplibregl = deps.maplibregl;

  // Store other dependencies
  Object.assign(moduleDeps, deps);

  // Get DOM elements
  searchInput = document.getElementById('searchInput');
  searchClear = document.getElementById('searchClear');
  searchDropdown = document.getElementById('searchDropdown');
  locationsSection = document.getElementById('locationsSection');
  locationsResults = document.getElementById('locationsResults');
  layersSection = document.getElementById('layersSection');
  layersResults = document.getElementById('layersResults');
  searchInputWrapper = searchInput.parentElement;

  // Setup event handlers
  setupEventHandlers();
}

/**
 * Debounce function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
function debounce(fn, delay) {
  return (...args) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Search the Swisstopo API
 * @param {string} query - Search query
 */
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
    if (moduleDeps.showToast) {
      moduleDeps.showToast('Search failed. Please try again.', 'error');
    }
    closeSearchDropdown();
  }
}

/**
 * Safely extract text from HTML and escape for display
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
function sanitizeAndExtractText(html) {
  if (!html) return '';
  // Create a temporary element to decode HTML entities and extract text
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Highlight matching text (safe - only adds <mark> tags to escaped content)
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @returns {string} HTML with highlighted matches
 */
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

/**
 * Display search results in dropdown
 * @param {Array} results - Search results from API
 * @param {string} query - Original search query
 */
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

/**
 * Navigate to a location from search results
 * @param {Object} loc - Location object from search results
 */
function goToLocation(loc) {
  // With sr=4326, y=lat, x=lon in WGS84
  const lon = loc.attrs.x;
  const lat = loc.attrs.y;

  // Remove existing search marker
  if (state.searchMarker) {
    state.searchMarker.remove();
  }

  // Create new search marker
  state.searchMarker = new maplibregl.Marker({
    element: moduleDeps.createSearchMarkerElement()
  })
    .setLngLat([lon, lat])
    .addTo(map);

  // Fly to location
  map.flyTo({
    center: [lon, lat],
    zoom: config.searchZoom,
    duration: config.flyDuration
  });

  closeSearchDropdown();
}

/**
 * Close the search dropdown
 */
export function closeSearchDropdown() {
  if (searchDropdown) {
    searchDropdown.classList.remove('open');
  }
}

/**
 * Setup all event handlers for search functionality
 */
function setupEventHandlers() {
  const debouncedSearch = debounce(searchSwisstopo, moduleDeps.uiTiming.searchDebounce);

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
}

/**
 * Check if click is outside search container (for document click handler)
 * @param {Event} e - Click event
 * @returns {boolean} True if click is outside search
 */
export function isClickOutside(e) {
  return !e.target.closest('.search-container');
}

/**
 * Blur the search input (for escape key handler)
 */
export function blurInput() {
  if (searchInput) {
    searchInput.blur();
  }
}
