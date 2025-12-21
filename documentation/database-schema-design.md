# Swiss Geodata Platform - Database Schema Design

## Project Overview

**Repository**: [swissALTI3D-Volumen](https://github.com/davras5/swissALTI3D-Volumen)  
**Database**: PostGIS on Supabase  
**Purpose**: Public-facing platform aggregating Swiss OGD (Open Government Data) for buildings, parcels, landcovers, and projects.

---

## Data Source Classification

### ✅ Available OGD Sources

| Source Code | Full Name | Data Provider | Access |
|------------|-----------|---------------|--------|
| `AV` | Amtliche Vermessung | Cantonal Survey Offices via geodienste.ch | OGD |
| `GWR` | Gebäude- und Wohnungsregister | BFS (Federal Statistical Office) | OGD |
| `ARE` | Bauzonen Schweiz | ARE (Federal Office for Spatial Development) | OGD |
| `KGS` | KGS Inventar | BABS (Federal Office for Civil Protection) | OGD |
| `ALTI3D` | swissALTI3D | swisstopo | OGD |
| `SURFACE3D` | swissSURFACE3D | swisstopo | OGD |
| `DERIVED` | Calculated/Auto | System-generated | N/A |

### ❌ Internal Sources (Not Available for Public Platform)

| Source Code | Full Name | Reason |
|------------|-----------|--------|
| `BBL_SAP` | BBL SAP Liegenschaftsinventar | Internal BBL data |
| `BBL_KORA` | BBL SAP Korasoft | Internal BBL data |
| `BBL_PC` | BBL SAP Projektcontrolling | Internal BBL data |
| `BBL_EDM` | BBL Energy Data Management | Internal BBL data |
| `BBL_REIN` | BBL Reinigung Excel | Internal BBL data |

---

## Entity Relationship Overview

```
┌─────────────────┐         ┌─────────────────┐
│    buildings    │ 1     N │    parcels      │
│    (POINT)      │─────────│   (POLYGON)     │
│                 │         │                 │
│ egid (PK)       │         │ egrid (PK)      │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ N                         │ 1
         │         ┌─────────────────┘
         │         │
         ▼         ▼
┌─────────────────────────────────────┐
│            landcovers               │
│            (POLYGON)                │
│                                     │
│ id (PK)                             │
│ type (building_footprint, ...)      │
└─────────────────────────────────────┘

┌─────────────────┐
│    projects     │
│   (POLYGON)     │  (Future - limited OGD available)
│                 │
│ id (PK)         │
└─────────────────┘
```

---

## Core Tables

### 1. buildings

Primary entity representing individual buildings. Uses EGID as natural key from GWR.

| Column | Type | Source | Description DE | Description EN |
|--------|------|--------|----------------|----------------|
| `egid` | `text PRIMARY KEY` | GWR | Eidgenössischer Gebäudeidentifikator | Swiss federal building identifier |
| `geog` | `geography(POINT, 4326)` | AV/GWR | Gebäudemittelpunkt | Building centroid |
| `name` | `text` | GWR/DERIVED | Gebäudebezeichnung | Building name |

**Address Fields (from GWR)**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `adr_street` | `text` | GWR | Strasse |
| `adr_house_nr` | `text` | GWR | Hausnummer |
| `adr_postal_code` | `text` | GWR | Postleitzahl |
| `adr_city` | `text` | GWR | Ort |
| `adr_canton` | `text` | GWR | Kanton |

**GWR Core Attributes**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `gwr_status` | `text` | GWR | Gebäudestatus (geplant, im Bau, bestehend, abgebrochen) |
| `gwr_category` | `text` | GWR | Gebäudekategorie |
| `gwr_class` | `text` | GWR | Gebäudeklasse |
| `gwr_construction_year` | `integer` | GWR | Baujahr |
| `gwr_renovation_year` | `integer` | GWR | Renovationsjahr |
| `gwr_floors_above` | `integer` | GWR | Geschosse oberirdisch |
| `gwr_floors_below` | `integer` | GWR | Geschosse unterirdisch |
| `gwr_dwellings_count` | `integer` | GWR | Anzahl Wohnungen |

**Energy (from GWR)**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `energy_heating_type` | `text` | GWR | Wärmeerzeuger Heizung |
| `energy_heating_source` | `text` | GWR | Energieträger Heizung |
| `energy_water_type` | `text` | GWR | Wärmeerzeuger Warmwasser |
| `energy_water_source` | `text` | GWR | Energieträger Warmwasser |

**Dimensions (from swissALTI3D/swissSURFACE3D)**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `vol_total_m3` | `numeric` | ALTI3D/SURFACE3D | Gebäudevolumen Total (m³) |
| `vol_above_ground_m3` | `numeric` | DERIVED | Volumen oberirdisch (m³) |
| `base_elevation_m` | `numeric` | ALTI3D | Terrain-Höhe Basis (m ü.M.) |
| `mean_height_m` | `numeric` | DERIVED | Mittlere Gebäudehöhe (m) |
| `max_height_m` | `numeric` | DERIVED | Maximale Gebäudehöhe (m) |

**Administrative (from BFS/AV)**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `bfs_municipality_nr` | `integer` | BFS | BFS Gemeindenummer |
| `bfs_municipality_name` | `text` | BFS | BFS Gemeindename |

**Heritage Protection (from KGS)**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `kgs_category` | `text` | KGS | KGS Kategorie (A/B) |
| `kgs_number` | `integer` | KGS | KGS Inventarnummer |

**Zoning (from ARE)**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `zone_designation` | `text` | ARE | Bauzonenbezeichnung |
| `zone_usage` | `text` | ARE | Bauzonennutzung |

**Metadata**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `created_at` | `timestamptz` | SYSTEM | Erstellungsdatum |
| `updated_at` | `timestamptz` | SYSTEM | Aktualisierungsdatum |
| `data_quality` | `text` | DERIVED | Datenqualitätsindikator |

---

### 2. parcels

Land parcels from the official cadastral survey (Amtliche Vermessung).

| Column | Type | Source | Description DE | Description EN |
|--------|------|--------|----------------|----------------|
| `egrid` | `text PRIMARY KEY` | AV | Eidgenössischer Grundstückidentifikator | Swiss federal plot identifier |
| `geog` | `geography(POLYGON, 4326)` | AV | Parzellen-Geometrie | Parcel geometry |

**Core Attributes**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `parcel_nr` | `text` | AV | Grundstücksnummer (pro Gemeinde) |
| `bfs_municipality_nr` | `integer` | AV | BFS Gemeindenummer |
| `bfs_municipality_name` | `text` | AV | BFS Gemeindename |

**Dimensions**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `area_gsf_m2` | `numeric` | AV | Grundstücksfläche GSF (m²) |
| `area_ggf_m2` | `numeric` | DERIVED | Summe Gebäudegrundflächen (m²) |
| `area_uf_m2` | `numeric` | DERIVED | Umgebungsfläche (m²) |
| `sealed_area_m2` | `numeric` | DERIVED | Versiegelte Fläche (m²) |

**Zoning**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `zone_designation` | `text` | ARE | Bauzonenbezeichnung |
| `zone_usage` | `text` | ARE | Bauzonennutzung |

**Metadata**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `created_at` | `timestamptz` | SYSTEM | Erstellungsdatum |
| `updated_at` | `timestamptz` | SYSTEM | Aktualisierungsdatum |

---

### 3. landcovers

Landcover polygons from Amtliche Vermessung. Building footprints are a specific type.

| Column | Type | Source | Description DE | Description EN |
|--------|------|--------|----------------|----------------|
| `id` | `bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY` | SYSTEM | System-ID | System ID |
| `geog` | `geography(POLYGON, 4326)` | AV | Geometrie | Geometry |

**Core Attributes**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `type` | `text NOT NULL` | AV | Bodenbedeckungsart (Gebaeude, Strasse, Gewaesser, etc.) |
| `egid` | `text` | AV | EGID (nur für Gebäudegrundrisse) |
| `egrid` | `text` | AV | Zugehörige Parzelle |

**Dimensions (for building footprints)**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `area_m2` | `numeric` | DERIVED | Fläche (m²) |
| `vol_total_m3` | `numeric` | ALTI3D/SURFACE3D | Gebäudevolumen (m³) |
| `mean_height_m` | `numeric` | DERIVED | Mittlere Höhe (m) |
| `max_height_m` | `numeric` | DERIVED | Maximale Höhe (m) |

**Metadata**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `created_at` | `timestamptz` | SYSTEM | Erstellungsdatum |
| `updated_at` | `timestamptz` | SYSTEM | Aktualisierungsdatum |
| `source` | `text` | SYSTEM | Datenquelle |

---

### 4. projects (Future / Limited OGD)

Construction projects. **Note**: Limited OGD available - consider using cantonal building permit data where available.

| Column | Type | Source | Description DE | Description EN |
|--------|------|--------|----------------|----------------|
| `id` | `bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY` | SYSTEM | System-ID | System ID |
| `geog` | `geography(POLYGON, 4326)` | VARIOUS | Projektperimeter | Project perimeter |

**Core Attributes**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `name` | `text` | VARIOUS | Projektname |
| `status` | `text` | VARIOUS | Status (geplant, bewilligt, im Bau, fertiggestellt) |
| `project_type` | `text` | VARIOUS | Projektart |
| `municipality_nr` | `integer` | BFS | BFS Gemeindenummer |

**Timeline**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `submission_date` | `date` | VARIOUS | Baueingabe-Datum |
| `approval_date` | `date` | VARIOUS | Baubewilligungs-Datum |
| `start_date` | `date` | VARIOUS | Baubeginn |
| `end_date` | `date` | VARIOUS | Bauende |

**Metadata**
| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `created_at` | `timestamptz` | SYSTEM | Erstellungsdatum |
| `updated_at` | `timestamptz` | SYSTEM | Aktualisierungsdatum |
| `source` | `text` | SYSTEM | Datenquelle |

---

## Junction/Relationship Tables

### buildings_parcels

Many-to-many relationship (a building can span multiple parcels).

| Column | Type | Description |
|--------|------|-------------|
| `egid` | `text REFERENCES buildings(egid)` | Building FK |
| `egrid` | `text REFERENCES parcels(egrid)` | Parcel FK |
| PRIMARY KEY (`egid`, `egrid`) | | Composite PK |

---

## Lookup/Reference Tables

### landcover_types

Standardized landcover categories from Amtliche Vermessung.

| Column | Type | Description |
|--------|------|-------------|
| `code` | `text PRIMARY KEY` | AV Code |
| `name_de` | `text` | Bezeichnung Deutsch |
| `name_fr` | `text` | Désignation Français |
| `name_it` | `text` | Denominazione Italiano |
| `name_en` | `text` | Name English |

### municipalities

BFS municipality register.

| Column | Type | Description |
|--------|------|-------------|
| `bfs_nr` | `integer PRIMARY KEY` | BFS Nummer |
| `name` | `text` | Gemeindename |
| `canton` | `text` | Kanton |
| `district` | `text` | Bezirk |

---

## Attributes NOT Available for Public Platform

The following attributes from your ideas list require internal BBL data sources and **cannot be included**:

### Internal BBL Master Data
- `bbl_stat` (BBL Status)
- `bbl_id` (BBL Internal ID)
- `bbl_buch` (Buchungskreis)
- `bbl_we` (Wirtschaftseinheit)
- `bbl_tobj` (Teilobjekt)
- `bbl_bez` (BBL Bezeichnung)
- `bbl_eigen` (Eigentum Art)
- `bbl_ostr` (Objektstrategie)
- `bbl_mietm` (Mietmodell)
- `bbl_port` (Teilportfolio)
- `bbl_awrt` (Anschaffungswert)
- `bbl_bwrt` (Buchwert)
- `bbl_gbda1/2` (Gebäudeart)
- `bbl_ovtw` (Objektverantwortlich)
- `bbl_pvtw` (Portfolio Manager)

### Internal Area Data (Korasoft)
- SIA 416 detailed breakdowns (NGF, NF, HNF, NNF, FF, VF, VMF)
- Workspace counts (AP IST, SOLL, Reserve)
- Cleaning areas (Reinigungsflächen)

### Internal Energy Data
- `bbl_estat` (ESTAT Flag)
- Detailed EDM energy data

### Internal Project Data
- BBL SAP Projektcontrolling data
- Project costs, timelines from SAP

---

## Recommended Phase 1 Implementation

Focus on these OGD-based features first:

1. **Buildings** with GWR data + calculated volumes from swissALTI3D
2. **Parcels** with AV geometry and basic attributes  
3. **Landcovers** with building footprints as priority type
4. **KGS heritage data** enrichment
5. **ARE zoning data** enrichment

### Phase 2 Candidates

- Room for cantonal building permit data (varies by canton)
- Solar potential data (Sonnendach.ch)
- Natural hazards (Naturgefahren)
- Public transport accessibility

---

## SQL Schema (Phase 1)

```sql
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Buildings table
CREATE TABLE buildings (
    egid TEXT PRIMARY KEY,
    geog GEOGRAPHY(POINT, 4326),
    name TEXT,
    
    -- Address
    adr_street TEXT,
    adr_house_nr TEXT,
    adr_postal_code TEXT,
    adr_city TEXT,
    adr_canton TEXT,
    
    -- GWR
    gwr_status TEXT,
    gwr_category TEXT,
    gwr_class TEXT,
    gwr_construction_year INTEGER,
    gwr_floors_above INTEGER,
    gwr_floors_below INTEGER,
    gwr_dwellings_count INTEGER,
    
    -- Energy (GWR)
    energy_heating_type TEXT,
    energy_heating_source TEXT,
    energy_water_type TEXT,
    energy_water_source TEXT,
    
    -- Volumes (calculated)
    vol_total_m3 NUMERIC,
    vol_above_ground_m3 NUMERIC,
    base_elevation_m NUMERIC,
    mean_height_m NUMERIC,
    max_height_m NUMERIC,
    
    -- Administrative
    bfs_municipality_nr INTEGER,
    bfs_municipality_name TEXT,
    
    -- Heritage
    kgs_category TEXT,
    kgs_number INTEGER,
    
    -- Zoning
    zone_designation TEXT,
    zone_usage TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    data_quality TEXT
);

-- Parcels table
CREATE TABLE parcels (
    egrid TEXT PRIMARY KEY,
    geog GEOGRAPHY(POLYGON, 4326),
    
    parcel_nr TEXT,
    bfs_municipality_nr INTEGER,
    bfs_municipality_name TEXT,
    
    -- Dimensions
    area_gsf_m2 NUMERIC,
    area_ggf_m2 NUMERIC,
    area_uf_m2 NUMERIC,
    sealed_area_m2 NUMERIC,
    
    -- Zoning
    zone_designation TEXT,
    zone_usage TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Landcovers table
CREATE TABLE landcovers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    geog GEOGRAPHY(POLYGON, 4326),
    
    type TEXT NOT NULL,
    egid TEXT,
    egrid TEXT,
    
    -- Dimensions
    area_m2 NUMERIC,
    vol_total_m3 NUMERIC,
    mean_height_m NUMERIC,
    max_height_m NUMERIC,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT
);

-- Projects table (simplified for Phase 1)
CREATE TABLE projects (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    geog GEOGRAPHY(POLYGON, 4326),
    
    name TEXT,
    status TEXT,
    project_type TEXT,
    municipality_nr INTEGER,
    
    submission_date DATE,
    approval_date DATE,
    start_date DATE,
    end_date DATE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT
);

-- Junction table
CREATE TABLE buildings_parcels (
    egid TEXT REFERENCES buildings(egid) ON DELETE CASCADE,
    egrid TEXT REFERENCES parcels(egrid) ON DELETE CASCADE,
    PRIMARY KEY (egid, egrid)
);

-- Indexes for common queries
CREATE INDEX idx_buildings_geog ON buildings USING GIST (geog);
CREATE INDEX idx_buildings_municipality ON buildings (bfs_municipality_nr);
CREATE INDEX idx_buildings_construction_year ON buildings (gwr_construction_year);

CREATE INDEX idx_parcels_geog ON parcels USING GIST (geog);
CREATE INDEX idx_parcels_municipality ON parcels (bfs_municipality_nr);

CREATE INDEX idx_landcovers_geog ON landcovers USING GIST (geog);
CREATE INDEX idx_landcovers_type ON landcovers (type);
CREATE INDEX idx_landcovers_egid ON landcovers (egid);

CREATE INDEX idx_projects_geog ON projects USING GIST (geog);
CREATE INDEX idx_projects_status ON projects (status);
```

---

## Data Sources Reference

| Dataset | API/Download | Update Frequency | Notes |
|---------|--------------|------------------|-------|
| Amtliche Vermessung | geodienste.ch WFS/Download | Varies by canton | Building footprints, parcels |
| GWR | api3.geo.admin.ch | Quarterly | Building attributes |
| swissALTI3D | swisstopo STAC/Download | Annual | Terrain model |
| swissSURFACE3D | swisstopo STAC/Download | Annual | Surface model |
| Bauzonen | opendata.swiss | Annual | Zoning data |
| KGS Inventar | opendata.swiss | Occasional | Heritage protection |
| BFS Municipalities | bfs.admin.ch | Annual | Municipality register |

---

## Next Steps

1. **Review and confirm** the Phase 1 scope
2. **Set up Supabase** project with PostGIS
3. **Create ETL pipelines** for each OGD source
4. **Build API layer** using Supabase auto-generated REST/GraphQL
5. **Develop frontend** for visualization
