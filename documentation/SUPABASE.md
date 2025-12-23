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
- `buildings` - Building points (columns: `id`, `label`)
- `parcels` - Property boundary polygons (columns: `id`, `label`, `type`)
- `landcovers` - Land cover polygons (columns: `id`, `label`, `type`)
- `projects` - Construction project polygons (columns: `id`, `label`)

**Caching strategy:**
| Zoom Level | Cache Duration | Use Case |
|------------|----------------|----------|
| < 10 | 24 hours | Country/region view |
| 10-13 | 1 hour | City view |
| 14+ | 5 minutes | Street/building view |

**CORS:** Allows all origins (`*`), `GET` and `OPTIONS` methods.

---

### 2. MVT Tile Generator (Database Function)

**Function:** `mvt_tile(table_name, z, x, y, columns)`

**Purpose:** Generates Mapbox Vector Tiles from PostGIS geometries.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `table_name` | text | Table to query (buildings, parcels, landcovers, projects) |
| `z` | integer | Zoom level |
| `x` | integer | Tile column |
| `y` | integer | Tile row |
| `columns` | text[] | Array of column names to include (default: `['id', 'label']`) |

**Features:**
- Converts geometries to MVT binary format
- Dynamic column selection for minimal tile size
- Returns base64-encoded data (decoded by edge function)
- Marked `STABLE PARALLEL SAFE` for concurrent query optimization

**Security:**
- Table name whitelist validation (only allowed tables)
- Column name sanitization (regex: `^[a-z_][a-z0-9_]*$`)
- Prevents SQL injection via parameterized queries

**Permissions:**
```sql
GRANT EXECUTE ON FUNCTION mvt_tile(...) TO authenticated;
GRANT EXECUTE ON FUNCTION mvt_tile(...) TO anon;
```

**Technical parameters:**
| Parameter | Value | Description |
|-----------|-------|-------------|
| Extent | 4096 | Tile coordinate space (Mapbox standard) |
| Buffer | 256 | Pixel buffer for label/symbol overlap |
| Clip | true | Clips geometries to tile bounds |

**Example:**
```sql
-- Buildings with default columns
SELECT mvt_tile('buildings', 14, 8594, 5747);

-- Parcels with type for styling
SELECT mvt_tile('parcels', 14, 8594, 5747, ARRAY['id', 'label', 'type']);
```

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
| parcels | `idx_parcels_egrid` | BTREE |
| landcovers | `idx_landcovers_geog_gist` | GIST (spatial) |
| landcovers | `idx_landcovers_egid` | BTREE |
| projects | `idx_projects_geog_gist` | GIST (spatial) |
| projects | `idx_projects_eproid` | BTREE |

**Performance impact:** Reduces query time from ~500-2000ms to ~5-50ms.

**SQL to create indexes:**
```sql
-- Spatial indexes (required for tile queries)
CREATE INDEX IF NOT EXISTS idx_buildings_geog_gist ON buildings USING GIST (geog);
CREATE INDEX IF NOT EXISTS idx_parcels_geog_gist ON parcels USING GIST (geog);
CREATE INDEX IF NOT EXISTS idx_landcovers_geog_gist ON landcovers USING GIST (geog);
CREATE INDEX IF NOT EXISTS idx_projects_geog_gist ON projects USING GIST (geog);

-- Identifier indexes (for detail lookups)
CREATE INDEX IF NOT EXISTS idx_buildings_egid ON buildings (egid);
CREATE INDEX IF NOT EXISTS idx_parcels_egrid ON parcels (egrid);
CREATE INDEX IF NOT EXISTS idx_landcovers_egid ON landcovers (egid);
CREATE INDEX IF NOT EXISTS idx_projects_eproid ON projects (eproid);

-- Run ANALYZE after creating indexes
ANALYZE buildings, parcels, landcovers, projects;
```

---

## Layer Hierarchy

Layers are rendered in this order (bottom to top):

1. **Parcels** - Property boundaries (deep blue)
2. **Landcovers** - Land cover polygons (purple)
3. **Buildings** - Building points (slate/green when selected)
4. **Projects** - Construction projects (when enabled)

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
1. Run the Create Spatial Indexes SQL above
2. Run `ANALYZE` on tables
3. Check edge function logs for query times

**Empty tiles:**
1. Verify data exists in the requested tile bounds
2. Check that `geog` column has valid geometries
3. Test with: `SELECT COUNT(*) FROM {table} WHERE geog IS NOT NULL`
