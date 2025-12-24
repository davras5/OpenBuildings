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

## Edge Function

```ts

/**
 * ============================================================================
 * VECTOR TILE SERVER - Supabase Edge Function
 * ============================================================================
 * 
 * Serves Mapbox Vector Tiles (MVT) for map layers from PostGIS.
 * 
 * Endpoint: /tiles/{table}/{z}/{x}/{y}.pbf
 * 
 * Supported tables:
 *   - buildings  : Building points (id, label)
 *   - parcels    : Property boundary polygons (id, label, type)
 *   - landcovers : Land cover polygons (id, label, type)
 *   - projects   : Construction project polygons (id, label)
 * 
 * ============================================================================
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Column configuration per table.
 * Only these columns are included in vector tiles to minimize tile size.
 * Additional data is fetched on-demand via detail API.
 */
const TABLE_CONFIG: Record<string, { columns: string[] }> = {
  buildings:  { columns: ['id', 'label', 'status'] },
  parcels:    { columns: ['id', 'label', 'type'] },
  landcovers: { columns: ['id', 'label', 'type', 'building_category', 'building_construction_period'] },
  projects:   { columns: ['id', 'label'] },
}

const VALID_TABLES = Object.keys(TABLE_CONFIG)

/**
 * CORS headers for cross-origin requests from map clients.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    
    // Parse: /tiles/{table}/{z}/{x}/{y}.pbf
    const match = url.pathname.match(/\/tiles\/(\w+)\/(\d+)\/(\d+)\/(\d+)\.pbf/)
    
    if (!match) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid path',
          usage: '/tiles/{table}/{z}/{x}/{y}.pbf',
          tables: VALID_TABLES
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const [, table, z, x, y] = match

    // Validate table name
    if (!VALID_TABLES.includes(table)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid table. Must be one of: ${VALID_TABLES.join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get columns for this table
    const { columns } = TABLE_CONFIG[table]

    // Generate vector tile
    const { data, error } = await supabase.rpc('mvt_tile', {
      table_name: table,
      z: parseInt(z),
      x: parseInt(x),
      y: parseInt(y),
      columns: columns
    })

    if (error) throw error

    // Decode base64 to binary
    const binaryString = atob(data || '')
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Cache duration by zoom level
    const zoomLevel = parseInt(z)
    const maxAge = zoomLevel < 10 ? 86400 : zoomLevel < 14 ? 3600 : 300

    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.mapbox-vector-tile',
        'Cache-Control': `public, max-age=${maxAge}`,
      }
    })

  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

```



## SQL

### MVT_TILE

```sql

-- =============================================================================
-- MVT_TILE - Generate Mapbox Vector Tiles (Optimized for 1M+ records)
-- =============================================================================
-- 
-- Creates vector tiles for map display with configurable columns per table.
-- Called by the tiles edge function.
--
-- OPTIMIZATIONS (vs original):
--   1. Uses && operator for fast bounding box check (O(log n) with GIST index)
--   2. Pre-computes tile bounds outside query to avoid repeated transforms
--   3. Adds feature LIMIT to prevent tile explosion at low zoom levels
--   4. Removes CTE overhead for simpler query planning
--   5. Uses geography type for bounds_4326 to ensure GIST index usage
--
-- PERFORMANCE CHARACTERISTICS:
--   - 500 records:    ~5-20ms per tile
--   - 100K records:   ~10-50ms per tile  
--   - 1M+ records:    ~20-100ms per tile (with proper GIST indexes)
--
-- PREREQUISITES:
--   - GIST spatial index on geog column for each table
--   - Example: CREATE INDEX idx_buildings_geog_gist ON buildings USING GIST (geog);
--
-- Parameters:
--   table_name : Table to query (buildings, parcels, landcovers, projects)
--   z, x, y    : Tile coordinates (zoom level, column, row)
--   columns    : Array of column names to include in tile attributes
--
-- Returns:
--   Base64-encoded MVT binary (decoded by edge function)
--
-- Example:
--   SELECT mvt_tile('buildings', 14, 8594, 5747, ARRAY['id', 'label', 'status']);
--
-- =============================================================================

DROP FUNCTION IF EXISTS public.mvt_tile(text, integer, integer, integer, text[]);

CREATE OR REPLACE FUNCTION public.mvt_tile(
  table_name text,
  z integer,
  x integer,
  y integer,
  columns text[] DEFAULT ARRAY['id', 'label']
)
RETURNS text
LANGUAGE plpgsql
STABLE          -- Function returns same result for same inputs within a transaction
PARALLEL SAFE   -- Safe to run in parallel query execution
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  -- Pre-computed tile bounds in both coordinate systems
  bounds_3857 geometry;    -- Web Mercator (for MVT geometry output)
  bounds_4326 geography;   -- WGS84 geography (matches geog column type for index usage)
  
  mvt bytea;             -- Raw MVT binary output
  col_list text;         -- Sanitized column list for SELECT
  sql text;              -- Dynamic SQL query
  max_features int;      -- Feature limit per tile (prevents explosion)
BEGIN
  -- ===========================================================================
  -- SECURITY: Validate table name against whitelist
  -- ===========================================================================
  -- Prevents SQL injection by only allowing known table names
  -- Add new tables here as needed (must have 'geog' geography column)
  IF table_name NOT IN ('buildings', 'parcels', 'landcovers', 'projects') THEN
    RAISE EXCEPTION 'Invalid table name: %. Allowed: buildings, parcels, landcovers, projects', table_name;
  END IF;

  -- ===========================================================================
  -- PRE-COMPUTE TILE BOUNDS
  -- ===========================================================================
  -- Computing bounds once here avoids repeated ST_Transform calls inside the query
  -- ST_TileEnvelope converts z/x/y to bounding box in Web Mercator (EPSG:3857)
  bounds_3857 := ST_TileEnvelope(z, x, y);
  
  -- Transform to WGS84 and cast to geography to match geog column type
  -- This ensures the && operator uses the GIST index on geography columns
  bounds_4326 := ST_Transform(bounds_3857, 4326)::geography;

  -- ===========================================================================
  -- FEATURE LIMIT BY ZOOM LEVEL
  -- ===========================================================================
  -- Prevents "tile explosion" where low-zoom tiles contain millions of features
  -- Higher zoom = smaller area = fewer features expected, so higher limit is OK
  -- These limits ensure tiles remain < 500KB even with dense data
  max_features := CASE
    WHEN z < 10 THEN 10000   -- Country/region view: aggressive limit
    WHEN z < 14 THEN 50000   -- City view: moderate limit
    ELSE 100000              -- Street view: high limit (small area)
  END;

  -- ===========================================================================
  -- BUILD SAFE COLUMN LIST
  -- ===========================================================================
  -- Only allow alphanumeric column names (prevents SQL injection)
  -- Pattern: must start with letter/underscore, contain only letters/numbers/underscores
  SELECT string_agg(quote_ident(col), ', ')
  INTO col_list
  FROM unnest(columns) AS col
  WHERE col ~ '^[a-z_][a-z0-9_]*$';

  -- Fallback to 'id' if no valid columns provided
  IF col_list IS NULL OR col_list = '' THEN
    col_list := 'id';
  END IF;

  -- ===========================================================================
  -- BUILD AND EXECUTE OPTIMIZED QUERY
  -- ===========================================================================
  -- Key optimizations:
  --   1. t.geog && $3: Fast bounding box check using GIST index (O(log n))
  --      The && operator checks if bounding boxes intersect
  --      Using geography type for $3 ensures index is used (no implicit cast)
  --   2. ST_Intersects: Precise geometry check (only runs on bbox matches)
  --   3. LIMIT: Prevents runaway queries on dense areas
  --   4. Direct subquery instead of CTE for simpler query planning
  --
  -- Query flow:
  --   1. GIST index quickly filters to features whose bbox overlaps tile
  --   2. ST_Intersects precisely filters to features that actually intersect
  --   3. ST_AsMVTGeom converts geometry to tile coordinates (0-4096 range)
  --   4. ST_AsMVT encodes features into Mapbox Vector Tile binary format
  sql := format(
    $SQL$
    SELECT ST_AsMVT(tile, $2) FROM (
      SELECT
        %s,
        ST_AsMVTGeom(
          ST_Transform(t.geog::geometry, 3857),  -- Convert to Web Mercator
          $1,                                     -- Tile bounds for clipping
          4096,                                   -- Tile extent (standard)
          256,                                    -- Buffer for labels/symbols
          true                                    -- Clip geometries to tile
        ) AS geom
      FROM public.%I t
      WHERE t.geog && $3                          -- Fast: bbox check (uses GIST index)
        AND ST_Intersects(t.geog, $3)             -- Precise: geometry check
      LIMIT $4                                    -- Safety: prevent tile explosion
    ) tile
    $SQL$,
    col_list,      -- %s: column list (already quoted)
    table_name     -- %I: table name (will be quoted)
  );

  -- Execute with parameters to prevent SQL injection
  -- $1 = bounds_3857 (geometry for ST_AsMVTGeom clipping)
  -- $2 = table_name (for MVT layer name)
  -- $3 = bounds_4326 (geography for spatial filtering - matches column type)
  -- $4 = max_features (for LIMIT)
  EXECUTE sql INTO mvt USING bounds_3857, table_name, bounds_4326, max_features;

  -- ===========================================================================
  -- ENCODE AND RETURN
  -- ===========================================================================
  -- Return as base64 for JSON transport through edge function
  -- COALESCE handles empty tiles (no features in bounds)
  RETURN encode(COALESCE(mvt, ''), 'base64');
END;
$$;

-- =============================================================================
-- PERMISSIONS
-- =============================================================================
-- Grant execute to both authenticated users and anonymous (public) access
-- This allows the edge function to call this function with the anon key
GRANT EXECUTE ON FUNCTION public.mvt_tile(text, integer, integer, integer, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mvt_tile(text, integer, integer, integer, text[]) TO anon;

-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================
-- 
-- Basic usage (default columns: id, label):
--   SELECT mvt_tile('buildings', 14, 8594, 5747);
--
-- With custom columns for styling:
--   SELECT mvt_tile('buildings', 14, 8594, 5747, ARRAY['id', 'label', 'status']);
--   SELECT mvt_tile('landcovers', 14, 8594, 5747, ARRAY['id', 'label', 'type', 'building_category']);
--
-- Verify index usage (should show "Index Scan"):
--   EXPLAIN ANALYZE SELECT mvt_tile('buildings', 14, 8594, 5747);
--
-- =============================================================================

```
### Create Indexes

```sql

-- Parcels
CREATE INDEX IF NOT EXISTS idx_parcels_geog_gist 
ON parcels USING GIST (geog);

-- Landcovers
CREATE INDEX IF NOT EXISTS idx_landcovers_geog_gist 
ON landcovers USING GIST (geog);

-- Projects
CREATE INDEX IF NOT EXISTS idx_projects_geog_gist 
ON projects USING GIST (geog);

-- Update statistics for all
ANALYZE parcels;
ANALYZE landcovers;
ANALYZE projects;

```
