# Supabase Infrastructure

This document covers the Supabase components that power the vector tile system for map rendering.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Mapbox GL JS   │────▶│  Edge Function  │────▶│  PostGIS (DB)   │
│  (Frontend)     │◀────│  (tiles)        │◀────│  mvt_tile()     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       Requests              Serves               Generates
     /tiles/{z}/{x}/{y}    MVT binary            Vector tiles
```

## Components

### 1. tiles (Edge Function)

**Purpose:** HTTP endpoint that serves Mapbox Vector Tiles.

**Endpoint:** `/tiles/{table}/{z}/{x}/{y}.pbf`

**Supported tables:**
- `buildings` - Building points
- `parcels` - Property boundary polygons
- `landcover` - Land usage zone polygons

**Caching strategy:**
| Zoom Level | Cache Duration | Use Case |
|------------|----------------|----------|
| < 10 | 24 hours | Country/region view |
| 10-13 | 1 hour | City view |
| 14+ | 5 minutes | Street/building view |

---

### 2. MVT Tile Generator (Database Function)

**Function:** `mvt_tile(table_name, z, x, y)`

**Purpose:** Generates Mapbox Vector Tiles from PostGIS geometries.

**Features:**
- Converts geometries to MVT binary format
- Applies zoom-based polygon simplification for performance
- Returns base64-encoded data (decoded by edge function)

**Simplification thresholds:**
| Zoom Level | Tolerance | Detail Level |
|------------|-----------|--------------|
| < 10 | 200m | Rough shapes |
| 10-13 | 50m | Moderate detail |
| 14+ | 0m | Full detail |

---

### 3. Create Spatial Indexes (SQL Query)

**Purpose:** Creates GIST indexes for fast spatial queries.

**When to run:**
- After initial table creation
- After bulk data imports
- If tile queries become slow

**Indexes created:**
| Table | Index | Type |
|-------|-------|------|
| buildings | `idx_buildings_geog_gist` | GIST (spatial) |
| buildings | `idx_buildings_egid` | BTREE |
| parcels | `idx_parcels_geog_gist` | GIST (spatial) |
| parcels | `idx_parcels_building_id` | BTREE |
| parcels | `idx_parcels_egrid` | BTREE |
| landcover | `idx_landcover_geog_gist` | GIST (spatial) |
| landcover | `idx_landcover_egid` | BTREE |

**Performance impact:** Reduces query time from ~500-2000ms to ~5-50ms.

---

## Layer Hierarchy

Layers are rendered in this order (bottom to top):

1. **Parcels** - Property boundaries (deep blue)
2. **Landcover** - Land usage zones (purple)
3. **Buildings** - Building points (slate/green when selected)

---

## Environment Variables

Required for the edge function:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL (auto-set) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (auto-set) |

---

## Troubleshooting

**Tiles not loading:**
1. Check edge function logs in Supabase dashboard
2. Verify table exists and has data
3. Ensure spatial indexes are created

**Slow tile loading:**
1. Run the Create Spatial Indexes query
2. Run `ANALYZE` on tables
3. Check zoom-based simplification is working

**Empty tiles:**
1. Verify data exists in the requested tile bounds
2. Check that `geog` column has valid geometries
3. Test with: `SELECT COUNT(*) FROM {table} WHERE geog IS NOT NULL`
