# MapLibre GL JS Frontend

This document covers the map frontend architecture in `js/app.js`.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User Click     │────▶│  Layer Query    │────▶│  Supabase API   │
│                 │     │  (Vector Tile)  │     │  (Detail Fetch) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │                        │
                              ▼                        ▼
                        Feature ID              Full Record
                        from MVT tile           for Panel Display
```

## Layer Architecture

### Sources

All data layers use vector tile sources from Supabase Edge Functions:

| Source | Type | Zoom Range | Geometry |
|--------|------|------------|----------|
| `buildings` | vector | 0-14 | Point |
| `parcels` | vector | 10-14 | Polygon |
| `landcovers` | vector | 10-14 | Polygon |

### Layers (render order, bottom to top)

| Layer ID | Source | Type | Visibility |
|----------|--------|------|------------|
| `switzerland-border-line` | GeoJSON | line | Always |
| `parcels-fill` | parcels | fill | zoom ≥ 12 |
| `parcels-outline` | parcels | line | zoom ≥ 12 |
| `landcovers-fill` | landcovers | fill / fill-extrusion | zoom ≥ 12 |
| `landcovers-outline` | landcovers | line | zoom ≥ 12 |
| `buildings-heat` | buildings | heatmap | zoom < 12 |
| `unclustered-point` | buildings | circle | zoom ≥ 10 |

### Layer Colors

| Layer | Default | Selected | Opacity |
|-------|---------|----------|---------|
| Buildings | `#64748b` (slate) | `#059669` (green) | 0.3 → 1.0 by zoom |
| Parcels | `#1e3a5f` (deep blue) | `#059669` (green) | 0.1 / 0.25 |
| Landcovers | `#8b5cf6` (purple) | `#059669` (green) | 0.2 / 0.4 |

---

## State Management

### Application State

```javascript
const state = {
  selectedBuilding: null,    // Building ID or null
  selectedParcel: null,      // Parcel ID or null
  selectedLandcover: null,   // Landcover ID or null
  is3DMode: false,           // Terrain enabled
  searchMarker: null,        // MapLibre Marker instance
  markerClickHandled: false  // Click debounce flag
};
```

### URL Parameters (Deep Linking)

| Parameter | Type | Description |
|-----------|------|-------------|
| `zoom` | float | Map zoom level |
| `lon` | float | Center longitude |
| `lat` | float | Center latitude |
| `building` | int | Selected building ID |
| `parcel` | int | Selected parcel ID |
| `landcover` | int | Selected landcover ID |
| `3d` | bool | Enable 3D terrain |
| `marker` | bool | Show search marker at lon/lat |

**Example:** `?zoom=14.50&lon=8.54170&lat=47.37690&building=123&3d=true`

---

## Feature Selection

### Click Priority (highest to lowest)

1. **Buildings** - Direct layer click handler on `unclustered-point`
2. **Landcovers** - Query `landcovers-fill` at click point
3. **Parcels** - Query `parcels-fill` at click point

### Selection Flow

```
Click Event
    │
    ├─▶ Building layer? ──▶ selectBuilding(id, coords)
    │                            │
    │                            ▼
    │                      Show panel immediately
    │                      (coords from tile)
    │
    └─▶ Query rendered features
            │
            ├─▶ Landcover hit? ──▶ selectLandcover(id)
            │                            │
            └─▶ Parcel hit? ────▶ selectParcel(id)
                                         │
                                         ▼
                                   Fetch from Supabase
                                   Show panel with details
```

### Data Fetched per Feature Type

| Type | Columns from Supabase |
|------|----------------------|
| Building | `id, label, egid, geog` |
| Parcel | `id, label, egrid, type` |
| Landcover | `id, label, type, egid` |

---

## Performance Optimizations

### Caching

| Cache | Max Size | Purpose |
|-------|----------|---------|
| `wkbCache` | 100 | Parsed WKB geometries (LRU) |
| `featureCache.building` | 50 | Fetched building records (LRU) |
| `featureCache.parcel` | 50 | Fetched parcel records (LRU) |
| `featureCache.landcovers` | 50 | Fetched landcover records (LRU) |

### Throttling & Debouncing

| Operation | Strategy | Delay |
|-----------|----------|-------|
| Mouse coordinates | requestAnimationFrame | ~16ms |
| Compass rotation | requestAnimationFrame | ~16ms |
| Search input | Debounce | 300ms |
| Building click | Timeout flag | 100ms |

### Paint Property Optimization

Selection changes track previous state to skip unnecessary repaints:

```javascript
// Skip if selection hasn't changed
if (lastRenderedBuildingSelection === currentSelection) return;
```

---

## 3D Mode

### Terrain Source

```javascript
{
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 15
}
```

### Landcover Extrusion

In 3D mode, `landcovers-fill` converts from `fill` to `fill-extrusion`:

| Property | Value |
|----------|-------|
| `fill-extrusion-height` | 10m |
| `fill-extrusion-base` | 0m |
| `fill-extrusion-opacity` | 0.8 (default) / 0.6 (selected) |

### Camera Settings

| Setting | Value |
|---------|-------|
| Pitch (3D) | 60° |
| Pitch (2D) | 0° |
| Terrain exaggeration | 1.5x |

---

## Basemap

### Provider

[Protomaps](https://protomaps.com/) vector tiles with multiple styles:

| Style | Key |
|-------|-----|
| Light (default) | `white` |
| Streets | `light` |
| Satellite | `satellite` |

### Style Change Handling

When basemap changes, layers are re-added in order:
1. Switzerland border
2. Parcels
3. Landcovers
4. Buildings
5. Re-apply 3D terrain if active

---

## Configuration Constants

### Map Settings (`MAP_CONFIG`)

| Constant | Value | Description |
|----------|-------|-------------|
| `defaultZoom` | 7 | Initial zoom (Switzerland overview) |
| `detailZoom` | 14 | Zoom for feature selection |
| `searchZoom` | 17 | Zoom for search results |
| `quickDuration` | 300ms | Zoom button animation |
| `standardDuration` | 1000ms | Fit bounds animation |
| `flyDuration` | 1500ms | Fly-to animation |
| `pitch3D` | 60° | 3D mode camera pitch |
| `terrainExaggeration` | 1.5 | Terrain height multiplier |
| `boundsPadding` | 40px | Fit bounds padding |

### UI Timing (`UI_TIMING`)

| Constant | Value | Description |
|----------|-------|-------------|
| `clickDebounce` | 100ms | Prevent double-click handling |
| `searchDebounce` | 300ms | Search input delay |
| `toastDuration` | 4000ms | Toast display time |
| `toastFadeOut` | 300ms | Toast fade animation |

### Geographic Bounds

```javascript
const SWITZERLAND_BOUNDS = [5.9559, 45.818, 10.4921, 47.8084];
```

---

## Search (Swisstopo)

### API Endpoint

```
https://api3.geo.admin.ch/rest/services/ech/SearchServer
  ?searchText={query}
  &type=locations
  &type=layers
  &lang=de
  &sr=4326
```

### Result Types

| Origin | Action |
|--------|--------|
| `address`, `zipcode`, `sn25`, `gg25`, `district`, `canton`, `gazetteer` | Fly to location, add marker |
| `layer` | Displayed but disabled |

---

## Error Handling

### Fatal Errors (Initialization)

Displayed in loading overlay:
- MapLibre GL not loaded
- Supabase client not loaded

### Runtime Errors

Displayed as toast notifications:
- Feature fetch failures
- Search API failures
- Navigation failures

### Toast Types

| Type | Color | Icon |
|------|-------|------|
| `error` | Red | X circle |
| `success` | Green | Check circle |
| `info` | Blue | Info circle |
