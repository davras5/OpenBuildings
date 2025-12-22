# Swiss Geodata Platform - Database Schema Design

## Project Overview

**Repository**: [swissALTI3D-Volumen](https://github.com/davras5/swissALTI3D-Volumen)
**Database**: PostGIS on Supabase
**Purpose**: Public-facing platform aggregating Swiss OGD (Open Government Data) for buildings, parcels, landcovers, and projects.

---

## Entity Relationship Overview

| Entity | Primary Key | Secondary Key | Geometry | Description |
|--------|-------------|---------------|----------|-------------|
| `buildings` | `id` | `egid` | Point | Individual buildings with attributes from GWR, volumes from elevation models |
| `parcels` | `id` | `egrid` | Polygon | Land parcels from cadastral survey |
| `landcovers` | `id` | | Polygon | Landcover polygons including building footprints |
| `projects` | `id` | `eproid` | Polygon | Construction projects (limited OGD availability) |

```mermaid
erDiagram
    buildings ||--o| landcovers : "has footprint"
    parcels ||--o{ landcovers : "contains"

    buildings {
        bigint id PK
        text egid UK
        geography geog
    }

    parcels {
        bigint id PK
        text egrid UK
        geography geog
    }

    landcovers {
        bigint id PK
        geography geog
        bigint building_id FK
        bigint parcel_id FK
    }

    projects {
        bigint id PK
        text eproid UK
        geography geog
    }
```

---

## Core Tables

### 1. buildings

Primary entity representing individual buildings.

#### System

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `id` | `bigint` | `PRIMARY KEY, GENERATED ALWAYS AS IDENTITY` | System | System ID |
| `egid` | `text` | `UNIQUE` | GWR | Eidgenössischer Gebäudeidentifikator (CH) |
| `source_fid` | `text` | | Various | Feature ID from source system (for traceability) |
| `geog` | `geography(POINT, 4326)` | | GWR | Building centroid |
| `created_at` | `timestamptz` | `DEFAULT NOW()` | System | Record creation timestamp |
| `updated_at` | `timestamptz` | `DEFAULT NOW()` | System | Record last update timestamp |

#### Address

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `country` | `text` | | GWR | Country code (ISO 3166-1 alpha-2) |
| `region` | `text` | | GWR | Region code (canton in CH) |
| `city` | `text` | | GWR | City/locality |
| `postal_code` | `text` | | GWR | Postal code |
| `street` | `text` | | GWR | Street name |
| `street_nr` | `text` | | GWR | Street number |

#### Classification

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `status` | `text` | | GWR | Building status (planned, under construction, existing, demolished) |
| `category` | `text` | | GWR | Building category |
| `class` | `text` | | GWR | Building class |
| `roof_form` | `text` | | Derived | Roof form (flat, gable, hip, etc.) |

#### Construction

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `construction_year` | `integer` | | GWR | Year of construction |
| `renovation_year` | `integer` | | GWR | Year of last renovation |
| `dwellings_count` | `integer` | | GWR | Number of dwellings |

#### Dimensions - Volume

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `volume_total_m3` | `numeric` | | Derived | Gebäudevolumen GV total (SIA 416) |
| `volume_above_ground_m3` | `numeric` | | Derived | GV oberirdisch (SIA 416) |
| `volume_below_ground_m3` | `numeric` | | Derived | GV unterirdisch (SIA 416) |
| `volume_accuracy` | `text` | | Derived | Accuracy and source of volume data |

#### Dimensions - Height

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `elevation_base_m` | `numeric` | | swissALTI3D | Terrain elevation at base (m.a.s.l.) |
| `height_mean_m` | `numeric` | | Derived | Mean building height |
| `height_max_m` | `numeric` | | Derived | Maximum building height |

#### Dimensions - Floors

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `floors_total` | `integer` | | GWR | Anzahl Geschosse total (SIA 416) |
| `floors_above` | `integer` | | GWR | Geschosse oberirdisch (SIA 416) |
| `floors_below` | `integer` | | GWR | Geschosse unterirdisch (SIA 416) |
| `floors_accuracy` | `text` | | Derived | Accuracy and source of floor data |

#### Dimensions - Area

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `area_footprint_m2` | `numeric` | | AV | Gebäudegrundfläche GGF (SIA 416) |
| `area_floor_total_m2` | `numeric` | | Derived | Geschossfläche GF total (SIA 416) |
| `area_floor_above_ground_m2` | `numeric` | | Derived | GF oberirdisch (SIA 416) |
| `area_floor_below_ground_m2` | `numeric` | | Derived | GF unterirdisch (SIA 416) |
| `area_floor_net_m2` | `numeric` | | Derived | Netto-Geschossfläche NGF (SIA 416) |
| `area_ebf_m2` | `numeric` | | Derived | Energiebezugsfläche EBF (SIA 380) |
| `area_roof_m2` | `numeric` | | Derived | Fläche Dach DAF (eBKP-H) |
| `area_wall_m2` | `numeric` | | Derived | Fläche Aussenwand AWF (eBKP-H) |
| `area_accuracy` | `text` | | Derived | Accuracy and source of area data |

#### Energy

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `heating_type` | `text` | | GWR | Heating system type |
| `heating_source` | `text` | | GWR | Heating energy source |
| `water_heating_type` | `text` | | GWR | Hot water system type |
| `water_heating_source` | `text` | | GWR | Hot water energy source |

#### Administrative

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `municipality_nr` | `integer` | | GWR | BFS municipality number |
| `municipality_name` | `text` | | GWR | Municipality name |

#### Heritage

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `heritage_category` | `text` | | KGS | Protection category (A/B) |
| `heritage_inventory_nr` | `integer` | | KGS | Inventory number |

#### Zoning

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `zone_designation` | `text` | | ARE | Zoning designation |
| `zone_usage` | `text` | | ARE | Permitted zone usage |

---

### 2. parcels

Land parcels from the official cadastral survey (Amtliche Vermessung).

#### System

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `id` | `bigint` | `PRIMARY KEY, GENERATED ALWAYS AS IDENTITY` | System | System ID |
| `egrid` | `text` | `UNIQUE` | AV | Eidgenössischer Grundstückidentifikator (CH) |
| `source_fid` | `text` | | AV | Feature ID from source system (for traceability) |
| `geog` | `geography(POLYGON, 4326)` | | AV | Parcel geometry |
| `created_at` | `timestamptz` | `DEFAULT NOW()` | System | Record creation timestamp |
| `updated_at` | `timestamptz` | `DEFAULT NOW()` | System | Record last update timestamp |

#### Classification

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `status` | `text` | | AV | Parcel status (rechtskräftig, etc.) |
| `type` | `text` | | AV | Parcel type (Liegenschaft, etc.) |

#### Identification

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `parcel_nr` | `text` | | AV | Parcel number (per municipality) |
| `municipality_nr` | `integer` | | AV | BFS municipality number |
| `municipality_name` | `text` | | AV | Municipality name |

#### Dimensions - Area

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `area_parcel_m2` | `numeric` | | AV | Grundstücksfläche GSF (SIA 416) |
| `area_footprint_m2` | `numeric` | | Derived | Gebäudegrundfläche GGF (SIA 416), sum of building footprints |
| `area_surrounding_m2` | `numeric` | | Derived | Umgebungsfläche UF (SIA 416) |
| `area_surrounding_processed_m2` | `numeric` | | Derived | Bearbeitete Umgebungsfläche BUF (SIA 416) |
| `area_surrounding_unprocessed_m2` | `numeric` | | Derived | Unbearbeitete Umgebungsfläche UUF (SIA 416) |
| `area_sealed_m2` | `numeric` | | Derived | Versiegelte Fläche |
| `area_accuracy` | `text` | | Derived | Accuracy and source of area data |

#### Zoning

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `zone_designation` | `text` | | ARE | Zoning designation |
| `zone_usage` | `text` | | ARE | Permitted zone usage |

---

### 3. landcovers

Landcover polygons from Amtliche Vermessung. Building footprints are a specific type.

#### System

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `id` | `bigint` | `PRIMARY KEY, GENERATED ALWAYS AS IDENTITY` | System | System ID |
| `source_fid` | `text` | | AV | Feature ID from source system (for traceability) |
| `geog` | `geography(POLYGON, 4326)` | | AV | Landcover geometry |
| `created_at` | `timestamptz` | `DEFAULT NOW()` | System | Record creation timestamp |
| `updated_at` | `timestamptz` | `DEFAULT NOW()` | System | Record last update timestamp |

#### Classification

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `status` | `text` | | AV | Landcover status |
| `type` | `text` | `NOT NULL` | AV | Landcover type (building, road, water, etc.) |

#### Relations

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `building_id` | `bigint` | `FK → buildings.id` | Derived | Associated building (for footprints only) |
| `parcel_id` | `bigint` | `FK → parcels.id` | Derived | Associated parcel |

#### Dimensions

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `area_m2` | `numeric` | | Derived | Surface area |
| `volume_total_m3` | `numeric` | | Derived | Volume (for buildings) |
| `height_mean_m` | `numeric` | | Derived | Mean height (for buildings) |
| `height_max_m` | `numeric` | | Derived | Maximum height (for buildings) |

---

### 4. projects

Construction projects. Note: Limited OGD available - primarily cantonal building permit data where published.

#### System

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `id` | `bigint` | `PRIMARY KEY, GENERATED ALWAYS AS IDENTITY` | System | System ID |
| `eproid` | `text` | `UNIQUE` | GWR | Eidgenössischer Bauprojektidentifikator (CH) |
| `source_fid` | `text` | | Various | Feature ID from source system (for traceability) |
| `geog` | `geography(POLYGON, 4326)` | | Various | Project perimeter |
| `created_at` | `timestamptz` | `DEFAULT NOW()` | System | Record creation timestamp |
| `updated_at` | `timestamptz` | `DEFAULT NOW()` | System | Record last update timestamp |

#### Classification

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `status` | `text` | | Various | Status (planned, approved, under construction, completed) |
| `project_type` | `text` | | Various | Project type |

#### Identification

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `name` | `text` | | Various | Project name |
| `municipality_nr` | `integer` | | Various | BFS municipality number |

#### Timeline

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `date_submission` | `date` | | Various | Building permit submission date |
| `date_approval` | `date` | | Various | Building permit approval date |
| `date_start` | `date` | | Various | Construction start date |
| `date_end` | `date` | | Various | Construction end date |

---

## Lookup Tables

### landcover_types

Standardized landcover categories.

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `code` | `text` | `PRIMARY KEY` | AV | Type code |
| `name_de` | `text` | | AV | German name |
| `name_fr` | `text` | | AV | French name |
| `name_it` | `text` | | AV | Italian name |
| `name_en` | `text` | | Derived | English name |

### municipalities

BFS municipality register.

| Column | Type | Constraints | Source | Description |
|--------|------|-------------|--------|-------------|
| `bfs_nr` | `integer` | `PRIMARY KEY` | BFS | BFS number |
| `name` | `text` | | BFS | Municipality name |
| `region` | `text` | | BFS | Region code (canton in CH) |
| `district` | `text` | | BFS | District name |

---

## Enumerations

Standard values for enumerated text fields. Sources define authoritative values; derived enumerations may vary.

### buildings.status (GWR)

| Value | Description DE | Description EN |
|-------|----------------|----------------|
| `planned` | Projektiert | Planned |
| `under_construction` | Im Bau | Under construction |
| `existing` | Bestehend | Existing |
| `demolished` | Abgebrochen | Demolished |

### buildings.category (GWR)

Values defined by GWR (Gebäudekategorie). See [GWR documentation](https://www.housing-stat.ch) for complete list.

### buildings.class (GWR)

Values defined by GWR (Gebäudeklasse). See [GWR documentation](https://www.housing-stat.ch) for complete list.

### buildings.roof_form

| Value | Description DE | Description EN |
|-------|----------------|----------------|
| `flat` | Flachdach | Flat roof |
| `gable` | Satteldach | Gable roof |
| `hip` | Walmdach | Hip roof |
| `mansard` | Mansarddach | Mansard roof |
| `shed` | Pultdach | Shed roof |
| `pyramid` | Pyramidendach | Pyramid roof |
| `dome` | Kuppeldach | Dome roof |
| `complex` | Komplexes Dach | Complex roof |
| `unknown` | Unbekannt | Unknown |

### buildings.heritage_category (KGS)

| Value | Description |
|-------|-------------|
| `A` | Objects of national importance |
| `B` | Objects of regional importance |

### parcels.status (AV)

| Value | Description DE | Description EN |
|-------|----------------|----------------|
| `rechtskraeftig` | Rechtskräftig | Legally valid |

*Additional values to be defined from AV data model.*

### parcels.type (AV)

| Value | Description DE | Description EN |
|-------|----------------|----------------|
| `liegenschaft` | Liegenschaft | Property |

*Additional values to be defined from AV data model.*

### landcovers.status (AV)

*Values to be defined from AV data model.*

### landcovers.type (AV)

Values defined by Amtliche Vermessung (Bodenbedeckung). See `landcover_types` lookup table.

### projects.status

| Value | Description DE | Description EN |
|-------|----------------|----------------|
| `planned` | Geplant | Planned |
| `approved` | Bewilligt | Approved |
| `under_construction` | Im Bau | Under construction |
| `completed` | Fertiggestellt | Completed |

---

## Data Sources

| Source | Full Name | Data Provider | Access |
|--------|-----------|---------------|--------|
| AV | Amtliche Vermessung | Cantonal Survey Offices via geodienste.ch | OGD |
| GWR | Gebäude- und Wohnungsregister | BFS (Federal Statistical Office) | OGD |
| ARE | Bauzonen Schweiz | ARE (Federal Office for Spatial Development) | OGD |
| KGS | KGS Inventar | BABS (Federal Office for Civil Protection) | OGD |
| swissALTI3D | swissALTI3D | swisstopo | OGD |
| swissSURFACE3D | swissSURFACE3D | swisstopo | OGD |

### Data Sources Reference

| Dataset | API/Download | Update Frequency | Notes |
|---------|--------------|------------------|-------|
| Amtliche Vermessung | geodienste.ch WFS/Download | Varies by canton | Building footprints, parcels |
| GWR | api3.geo.admin.ch | Quarterly | Building attributes |
| swissALTI3D | swisstopo STAC/Download | Annual | Terrain model |
| swissSURFACE3D | swisstopo STAC/Download | Annual | Surface model |
| Bauzonen | opendata.swiss | Annual | Zoning data |
| KGS Inventar | opendata.swiss | Occasional | Heritage protection |
| BFS Municipalities | bfs.admin.ch | Annual | Municipality register |
