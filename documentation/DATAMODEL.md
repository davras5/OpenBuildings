# Swiss Geodata Platform - Database Schema Design

## Project Overview

**Repository**: [swissALTI3D-Volumen](https://github.com/davras5/swissALTI3D-Volumen)
**Database**: PostGIS on Supabase
**Purpose**: Public-facing platform aggregating Swiss OGD (Open Government Data) for buildings, parcels, landcovers, and projects.
**Validation Sources**: GWR Merkmalskatalog 4.2, KKVA Richtlinie Detaillierungsgrad BB, DM.01-AV-CH

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

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `id` | ID | ID | `bigint` | `PRIMARY KEY, GENERATED ALWAYS AS IDENTITY` | System | System ID |
| `egid` | Building ID | Gebäudeidentifikator | `text` | `UNIQUE, CHECK (egid ~ '^[0-9]{1,9}$')` | GWR | Eidgenössischer Gebäudeidentifikator (EGID) |
| `source_fid` | Source Feature ID | Quell-Feature-ID | `text` | | Various | Feature ID from source system (for traceability) |
| `geog` | Location | Standort | `geography(POINT, 4326)` | `NOT NULL` | GWR | Building centroid |
| `created_at` | Created | Erstellt | `timestamptz` | `NOT NULL DEFAULT NOW()` | System | Record creation timestamp |
| `updated_at` | Updated | Aktualisiert | `timestamptz` | `NOT NULL DEFAULT NOW()` | System | Record last update timestamp |

#### Address

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `country` | Country | Land | `text` | `CHECK (country ~ '^[A-Z]{2}$')` | GWR | Country code (ISO 3166-1 alpha-2) |
| `region` | Region | Region | `text` | `CHECK (region ~ '^[A-Z]{2}$')` | GWR | Region code (canton in CH) |
| `city` | City | Ort | `text` | | GWR | City/locality |
| `postal_code` | Postal Code | Postleitzahl | `text` | `CHECK (postal_code ~ '^[0-9]{4}$')` | GWR | Postal code (4 digits in CH) |
| `street` | Street | Strasse | `text` | | GWR | Street name |
| `street_nr` | Street Number | Hausnummer | `text` | | GWR | Street number |

#### Classification

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `status` | Status | Status | `building_status` | | GWR | Building status (GSTAT) |
| `category` | Category | Kategorie | `building_category` | | GWR | Building category (GKAT) |
| `class` | Class | Klasse | `text` | `CHECK (class ~ '^[0-9]{4}$')` | GWR | Building class code (GKLAS) |
| `roof_form` | Roof Form | Dachform | `roof_form` | | Derived | Roof form |

#### Construction

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `construction_year` | Construction Year | Baujahr | `integer` | `CHECK (construction_year BETWEEN 1000 AND 2100)` | GWR | Year of construction (GBAUJ) |
| `renovation_year` | Renovation Year | Renovationsjahr | `integer` | `CHECK (renovation_year BETWEEN 1000 AND 2100)` | GWR | Year of last renovation |
| `dwellings_count` | Dwellings | Wohnungen | `integer` | `CHECK (dwellings_count >= 0)` | GWR | Number of dwellings |

#### Dimensions - Volume

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `volume_total_m3` | Total Volume | Gesamtvolumen | `numeric` | `CHECK (volume_total_m3 >= 0)` | Derived | Gebäudevolumen GV total (SIA 416) |
| `volume_above_ground_m3` | Above Ground Volume | Oberirdisches Volumen | `numeric` | `CHECK (volume_above_ground_m3 >= 0)` | Derived | GV oberirdisch (SIA 416) |
| `volume_below_ground_m3` | Below Ground Volume | Unterirdisches Volumen | `numeric` | `CHECK (volume_below_ground_m3 >= 0)` | Derived | GV unterirdisch (SIA 416) |
| `volume_accuracy` | Volume Accuracy | Volumen-Genauigkeit | `text` | | Derived | Accuracy and source of volume data |

#### Dimensions - Height

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `elevation_base_m` | Base Elevation | Terrainhöhe | `numeric` | | swissALTI3D | Terrain elevation at base (m.a.s.l.) |
| `height_mean_m` | Mean Height | Mittlere Höhe | `numeric` | `CHECK (height_mean_m >= 0)` | Derived | Mean building height |
| `height_max_m` | Max Height | Maximale Höhe | `numeric` | `CHECK (height_max_m >= 0)` | Derived | Maximum building height |

#### Dimensions - Floors

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `floors_total` | Total Floors | Geschosse Total | `integer` | `CHECK (floors_total BETWEEN 1 AND 200)` | GWR | Anzahl Geschosse total (GASTW, SIA 416) |
| `floors_above` | Floors Above Ground | Oberirdische Geschosse | `integer` | `CHECK (floors_above >= 0)` | GWR | Geschosse oberirdisch (SIA 416) |
| `floors_below` | Floors Below Ground | Unterirdische Geschosse | `integer` | `CHECK (floors_below >= 0)` | GWR | Geschosse unterirdisch (SIA 416) |
| `floors_accuracy` | Floors Accuracy | Geschoss-Genauigkeit | `text` | | Derived | Accuracy and source of floor data |

#### Dimensions - Area

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `area_footprint_m2` | Footprint Area | Grundfläche | `numeric` | `CHECK (area_footprint_m2 >= 0)` | AV | Gebäudegrundfläche GGF (SIA 416) |
| `area_floor_total_m2` | Total Floor Area | Geschossfläche Total | `numeric` | `CHECK (area_floor_total_m2 >= 0)` | Derived | Geschossfläche GF total (SIA 416) |
| `area_floor_above_ground_m2` | Above Ground Floor Area | Oberirdische Geschossfläche | `numeric` | `CHECK (area_floor_above_ground_m2 >= 0)` | Derived | GF oberirdisch (SIA 416) |
| `area_floor_below_ground_m2` | Below Ground Floor Area | Unterirdische Geschossfläche | `numeric` | `CHECK (area_floor_below_ground_m2 >= 0)` | Derived | GF unterirdisch (SIA 416) |
| `area_floor_net_m2` | Net Floor Area | Netto-Geschossfläche | `numeric` | `CHECK (area_floor_net_m2 >= 0)` | Derived | Netto-Geschossfläche NGF (SIA 416) |
| `area_ebf_m2` | Energy Reference Area | Energiebezugsfläche | `numeric` | `CHECK (area_ebf_m2 >= 0)` | Derived | Energiebezugsfläche EBF (SIA 380) |
| `area_roof_m2` | Roof Area | Dachfläche | `numeric` | `CHECK (area_roof_m2 >= 0)` | Derived | Fläche Dach DAF (eBKP-H) |
| `area_wall_m2` | Wall Area | Aussenwandfläche | `numeric` | `CHECK (area_wall_m2 >= 0)` | Derived | Fläche Aussenwand AWF (eBKP-H) |
| `area_accuracy` | Area Accuracy | Flächen-Genauigkeit | `text` | | Derived | Accuracy and source of area data |

#### Energy

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `heating_type` | Heating Type | Wärmeerzeuger Heizung | `text` | | GWR | Heating system type (GWAERZH) |
| `heating_source` | Heating Source | Energiequelle Heizung | `text` | | GWR | Heating energy source (GENH) |
| `water_heating_type` | Water Heating Type | Wärmeerzeuger Warmwasser | `text` | | GWR | Hot water system type (GWAERZW) |
| `water_heating_source` | Water Heating Source | Energiequelle Warmwasser | `text` | | GWR | Hot water energy source (GENW) |

#### Administrative

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `municipality_nr` | Municipality Number | Gemeindenummer | `integer` | `CHECK (municipality_nr BETWEEN 1 AND 6999)` | GWR | BFS municipality number (GGDENR) |
| `municipality_name` | Municipality Name | Gemeindename | `text` | | GWR | Municipality name |

#### Heritage

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `heritage_category` | Heritage Category | Schutzkategorie | `heritage_category` | | KGS | Protection category (A/B) |
| `heritage_inventory_nr` | Heritage Inventory Nr | KGS-Inventarnummer | `integer` | | KGS | Inventory number |

#### Zoning

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `zone_main` | Main Zone | Hauptnutzungszone | `text` | | ARE | Main zoning classification |
| `zone_type` | Zone Type | Zonentyp | `text` | | ARE | Specific zone type |

---

### 2. parcels

Land parcels from cadastral survey.

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `id` | ID | ID | `bigint` | `PRIMARY KEY, GENERATED ALWAYS AS IDENTITY` | System | System ID |
| `egrid` | Parcel ID | Grundstückidentifikator | `text` | `UNIQUE, CHECK (egrid ~ '^CH[0-9]{12}$')` | AV | E-GRID identifier |
| `source_fid` | Source Feature ID | Quell-Feature-ID | `text` | | AV | Feature ID from source system |
| `geog` | Geometry | Geometrie | `geography(POLYGON, 4326)` | `NOT NULL` | AV | Parcel boundary |
| `area_m2` | Area | Fläche | `numeric` | `CHECK (area_m2 >= 0)` | AV | Parcel area in m² |
| `municipality_nr` | Municipality Number | Gemeindenummer | `integer` | `CHECK (municipality_nr BETWEEN 1 AND 6999)` | AV | BFS municipality number |
| `created_at` | Created | Erstellt | `timestamptz` | `NOT NULL DEFAULT NOW()` | System | Record creation timestamp |
| `updated_at` | Updated | Aktualisiert | `timestamptz` | `NOT NULL DEFAULT NOW()` | System | Record last update timestamp |

---

### 3. landcovers

Landcover polygons from cadastral survey.

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `id` | ID | ID | `bigint` | `PRIMARY KEY, GENERATED ALWAYS AS IDENTITY` | System | System ID |
| `source_fid` | Source Feature ID | Quell-Feature-ID | `text` | | AV | Feature ID from source system |
| `geog` | Geometry | Geometrie | `geography(POLYGON, 4326)` | `NOT NULL` | AV | Landcover polygon |
| `type` | Type | Typ | `landcover_type` | `NOT NULL` | AV | Landcover classification |
| `area_m2` | Area | Fläche | `numeric` | `CHECK (area_m2 >= 0)` | AV | Area in m² |
| `building_id` | Building | Gebäude | `bigint` | `REFERENCES buildings(id)` | Derived | Link to building (for footprints) |
| `parcel_id` | Parcel | Grundstück | `bigint` | `REFERENCES parcels(id)` | Derived | Containing parcel |
| `created_at` | Created | Erstellt | `timestamptz` | `NOT NULL DEFAULT NOW()` | System | Record creation timestamp |
| `updated_at` | Updated | Aktualisiert | `timestamptz` | `NOT NULL DEFAULT NOW()` | System | Record last update timestamp |

---

### 4. projects

Construction projects from GWR (limited OGD availability).

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `id` | ID | ID | `bigint` | `PRIMARY KEY, GENERATED ALWAYS AS IDENTITY` | System | System ID |
| `eproid` | Project ID | Bauprojektidentifikator | `text` | `UNIQUE, CHECK (eproid ~ '^[0-9]{1,15}$')` | GWR | EPROID identifier |
| `source_fid` | Source Feature ID | Quell-Feature-ID | `text` | | GWR | Feature ID from source system |
| `geog` | Geometry | Geometrie | `geography(POLYGON, 4326)` | | GWR | Project perimeter |
| `status` | Status | Status | `project_status` | | GWR | Project status (PSTAT) |
| `project_type` | Project Type | Projektart | `project_type` | | GWR | Type of construction (PARTBW) |
| `building_type` | Building Type | Bauwerkstyp | `text` | | GWR | Specific building type (PTYPBW) |
| `date_submitted` | Submitted | Beantragt | `date` | | GWR | Permit application date (PDATIN) |
| `date_approved` | Approved | Bewilligt | `date` | | GWR | Permit approval date (PDATOK) |
| `date_started` | Started | Baubeginn | `date` | | GWR | Construction start date (PDATBB) |
| `date_completed` | Completed | Abgeschlossen | `date` | | GWR | Completion date (PDATBE) |
| `municipality_nr` | Municipality Number | Gemeindenummer | `integer` | `CHECK (municipality_nr BETWEEN 1 AND 6999)` | GWR | BFS municipality number |
| `created_at` | Created | Erstellt | `timestamptz` | `NOT NULL DEFAULT NOW()` | System | Record creation timestamp |
| `updated_at` | Updated | Aktualisiert | `timestamptz` | `NOT NULL DEFAULT NOW()` | System | Record last update timestamp |

---

## Enumerations

### buildings.status (GSTAT) — GWR

From GWR Merkmalskatalog 4.2, Gebäudestatus.

| Code | Value | Alias (DE) | Alias (EN) |
|------|-------|------------|------------|
| 1001 | `planned` | projektiert | Planned |
| 1002 | `approved` | bewilligt | Approved |
| 1003 | `under_construction` | im Bau | Under construction |
| 1004 | `existing` | bestehend | Existing |
| 1005 | `unusable` | nicht nutzbar | Unusable |
| 1007 | `demolished` | abgebrochen | Demolished |
| 1008 | `not_realized` | nicht realisiert | Not realized |

```sql
CREATE TYPE building_status AS ENUM (
    'planned',           -- 1001
    'approved',          -- 1002
    'under_construction', -- 1003
    'existing',          -- 1004
    'unusable',          -- 1005
    'demolished',        -- 1007
    'not_realized'       -- 1008
);
```

---

### buildings.category (GKAT) — GWR

From GWR Merkmalskatalog 4.2, Gebäudekategorie.

| Code | Value | Alias (DE) | Alias (EN) |
|------|-------|------------|------------|
| 1010 | `provisional` | Provisorische Unterkunft | Provisional dwelling |
| 1020 | `detached_single` | Einfamilienhaus freistehend | Single-family house, detached |
| 1021 | `attached_single` | Einfamilienhaus angebaut | Single-family house, attached |
| 1025 | `row_house` | Reihenhaus | Row house |
| 1030 | `multi_family` | Mehrfamilienhaus | Multi-family house |
| 1040 | `residential_mixed` | Gebäude mit Wohn- und Nebennutzung | Building with residential and secondary use |
| 1060 | `residential_commercial` | Gebäude mit teilweiser Wohnnutzung | Building with partial residential use |
| 1080 | `commercial_only` | Gebäude ohne Wohnnutzung | Building without residential use |
| 1110 | `special` | Sonderbau | Special building |

```sql
CREATE TYPE building_category AS ENUM (
    'provisional',          -- 1010
    'detached_single',      -- 1020
    'attached_single',      -- 1021
    'row_house',            -- 1025
    'multi_family',         -- 1030
    'residential_mixed',    -- 1040
    'residential_commercial', -- 1060
    'commercial_only',      -- 1080
    'special'               -- 1110
);
```

---

### buildings.roof_form — Derived

Inferred from elevation models.

| Value | Alias (DE) | Alias (EN) |
|-------|------------|------------|
| `flat` | Flachdach | Flat roof |
| `gable` | Satteldach | Gable roof |
| `hip` | Walmdach | Hip roof |
| `mansard` | Mansarddach | Mansard roof |
| `pyramid` | Pyramidendach | Pyramid roof |
| `dome` | Kuppeldach | Dome roof |
| `shed` | Pultdach | Shed roof |
| `other` | Andere | Other |

```sql
CREATE TYPE roof_form AS ENUM (
    'flat',
    'gable',
    'hip',
    'mansard',
    'pyramid',
    'dome',
    'shed',
    'other'
);
```

---

### buildings.heritage_category — KGS

From KGS Inventar (Kulturgüterschutz).

| Value | Alias (DE) | Alias (EN) | Description |
|-------|------------|------------|-------------|
| `a` | Kategorie A | Category A | Objects of national importance |
| `b` | Kategorie B | Category B | Objects of regional importance |

```sql
CREATE TYPE heritage_category AS ENUM ('a', 'b');
```

---

### landcovers.type — AV

From DM.01-AV-CH, Bodenbedeckungsarten. 25 official types.

| Code | Value | Category (DE) | Alias (DE) | Alias (EN) |
|------|-------|---------------|------------|------------|
| 0 | `building` | Befestigte Flächen | Gebäude | Building |
| 1 | `hardened_area` | Befestigte Flächen | Befestigte Fläche | Hardened area |
| 2 | `greenhouse` | Befestigte Flächen | Gewächshaus | Greenhouse |
| 3 | `perennial_culture_shelter` | Befestigte Flächen | Unterstand Dauerkultur | Perennial culture shelter |
| 4 | `reservoir` | Befestigte Flächen | Wasserbecken | Reservoir |
| 5 | `other_hardened` | Befestigte Flächen | Übrige befestigte | Other hardened |
| 6 | `railway` | Verkehrsflächen | Bahn | Railway |
| 7 | `road_path` | Verkehrsflächen | Strasse/Weg | Road/Path |
| 8 | `field_meadow_pasture` | Landwirtschaft | Acker/Wiese/Weide | Field/Meadow/Pasture |
| 9 | `vineyard` | Landwirtschaft | Reben | Vineyard |
| 10 | `other_intensive_culture` | Landwirtschaft | Übrige Intensivkultur | Other intensive culture |
| 11 | `garden` | Landwirtschaft | Garten | Garden |
| 12 | `moor` | Humusierte Flächen | Moor | Moor |
| 13 | `other_humusized` | Humusierte Flächen | Übrige humusierte | Other humusized |
| 14 | `standing_water` | Gewässer | Stehendes Gewässer | Standing water |
| 15 | `flowing_water` | Gewässer | Fliessendes Gewässer | Flowing water |
| 16 | `reed_belt` | Gewässer | Schilfgürtel | Reed belt |
| 17 | `closed_forest` | Bestockte Flächen | Geschlossener Wald | Closed forest |
| 18 | `dense_wooded_pasture` | Bestockte Flächen | Übrige dicht bestockte | Dense wooded pasture |
| 19 | `open_wooded_pasture` | Bestockte Flächen | Übrige locker bestockte | Open wooded pasture |
| 20 | `other_wooded` | Bestockte Flächen | Gehölz | Other wooded |
| 21 | `rock` | Vegetationslose Flächen | Fels | Rock |
| 22 | `glacier_firn` | Vegetationslose Flächen | Gletscher/Firn | Glacier/Firn |
| 23 | `gravel_sand` | Vegetationslose Flächen | Kies/Sand | Gravel/Sand |
| 24 | `quarry_dump` | Vegetationslose Flächen | Abbau/Deponie | Quarry/Dump |
| 25 | `other_unvegetated` | Vegetationslose Flächen | Übrige vegetationslose | Other unvegetated |

```sql
CREATE TYPE landcover_type AS ENUM (
    'building',              -- 0
    'hardened_area',         -- 1
    'greenhouse',            -- 2
    'perennial_culture_shelter', -- 3
    'reservoir',             -- 4
    'other_hardened',        -- 5
    'railway',               -- 6
    'road_path',             -- 7
    'field_meadow_pasture',  -- 8
    'vineyard',              -- 9
    'other_intensive_culture', -- 10
    'garden',                -- 11
    'moor',                  -- 12
    'other_humusized',       -- 13
    'standing_water',        -- 14
    'flowing_water',         -- 15
    'reed_belt',             -- 16
    'closed_forest',         -- 17
    'dense_wooded_pasture',  -- 18
    'open_wooded_pasture',   -- 19
    'other_wooded',          -- 20
    'rock',                  -- 21
    'glacier_firn',          -- 22
    'gravel_sand',           -- 23
    'quarry_dump',           -- 24
    'other_unvegetated'      -- 25
);

-- Lookup table with multilingual names
CREATE TABLE landcover_types (
    code text PRIMARY KEY,
    av_code integer UNIQUE NOT NULL,
    category text NOT NULL,
    name_de text NOT NULL,
    name_fr text,
    name_it text,
    name_en text NOT NULL
);
```

---

### projects.status (PSTAT) — GWR

From GWR Merkmalskatalog 4.2, Bauprojektstatus.

| Code | Value | Alias (DE) | Alias (EN) | Trigger |
|------|-------|------------|------------|---------|
| 6701 | `submitted` | Baugesuch beantragt | Building permit submitted | PDATIN set |
| 6702 | `approved` | Baubewilligung bewilligt | Building permit approved | PDATOK set |
| 6703 | `under_construction` | Projekt baubegonnen | Construction started | PDATBB set |
| 6704 | `completed` | Projekt abgeschlossen | Project completed | PDATBE set |
| 6706 | `suspended` | Projekt sistiert | Project suspended | PDATSIST set |
| 6707 | `rejected` | Baugesuch abgelehnt | Permit rejected | PDATABL set |
| 6708 | `not_realized` | Projekt nicht realisiert | Not realized (permit expired) | PDATANN set |
| 6709 | `withdrawn` | Projekt zurückgezogen | Permit withdrawn by applicant | PDATRZG set |

```sql
CREATE TYPE project_status AS ENUM (
    'submitted',          -- 6701
    'approved',           -- 6702
    'under_construction', -- 6703
    'completed',          -- 6704
    'suspended',          -- 6706
    'rejected',           -- 6707
    'not_realized',       -- 6708
    'withdrawn'           -- 6709
);
```

---

### projects.project_type (PARTBW) — GWR

Art der Bauwerke from GWR.

| Code | Value | Alias (DE) | Alias (EN) |
|------|-------|------------|------------|
| 6010 | `civil_engineering` | Tiefbau | Civil engineering |
| 6011 | `building` | Hochbau | Building construction |
| 6012 | `special_structure` | Sonderbau | Special structure |

```sql
CREATE TYPE project_type AS ENUM (
    'civil_engineering',  -- 6010
    'building',           -- 6011
    'special_structure'   -- 6012
);
```

---

### projects.building_type (PTYPBW) — GWR

Typ der Bauwerke. 48 official types in 11 groups.

#### Infrastructure: Supply (621x)

| Code | Alias (DE) | Alias (EN) |
|------|------------|------------|
| 6211 | Wasserversorgungsanlagen | Water supply facilities |
| 6212 | Elektrizitätswerke und -netze | Electricity works and networks |
| 6213 | Gaswerke und -netze | Gas works and networks |
| 6214 | Fernheizungsanlagen | District heating facilities |
| 6219 | Übrige Versorgungsanlagen | Other supply facilities |

#### Infrastructure: Disposal (622x)

| Code | Alias (DE) | Alias (EN) |
|------|------------|------------|
| 6221 | Wasserentsorgungsanlagen | Water disposal facilities |
| 6222 | Kehrichtentsorgungsanlagen | Waste disposal facilities |
| 6223 | Übrige Entsorgungsanlagen | Other disposal facilities |

#### Residential (627x)

| Code | Alias (DE) | Alias (EN) |
|------|------------|------------|
| 6271 | Einfamilienhäuser freistehend | Single-family houses, detached |
| 6272 | Einfamilienhäuser angebaut | Single-family houses, attached |
| 6273 | Mehrfamilienhäuser | Multi-family houses |
| 6274 | Wohngebäude mit Nebennutzung | Residential with secondary use |
| 6276 | Wohnheime ohne Pflegedienste | Residential homes (without care) |
| 6278 | Garagen, Parkplätze (bei Wohngebäuden) | Garages, parking (with residential) |
| 6279 | Übrige Bauten (bei Wohngebäuden) | Other structures (with residential) |

**Reference**: [GWR Merkmalskatalog 4.2](https://www.housing-stat.ch/files/881-2200.pdf) for complete PTYPBW enumeration.

---

### municipalities — BFS

BFS municipality register.

| Column | Alias (EN) | Alias (DE) | Type | Constraints | Source | Description |
|--------|------------|------------|------|-------------|--------|-------------|
| `bfs_nr` | BFS Number | BFS-Nummer | `integer` | `PRIMARY KEY, CHECK (bfs_nr BETWEEN 1 AND 6999)` | BFS | BFS municipality number |
| `name` | Name | Name | `text` | `NOT NULL` | BFS | Municipality name |
| `region` | Region | Region | `text` | `CHECK (region ~ '^[A-Z]{2}$')` | BFS | Canton code |
| `district` | District | Bezirk | `text` | | BFS | District name |

---

## Data Sources

Primary data access is through the **Federal Spatial Data Infrastructure (FSDI)** via geo.admin.ch services.

| Key | Dataset | Provider | Layer ID | Access | Update | Content |
|-----|---------|----------|----------|--------|--------|---------|
| GWR | Gebäude- und Wohnungsregister | BFS | `ch.bfs.gebaeude_wohnungs_register` | OGD | Daily | Building attributes, dwellings, addresses |
| GWR-GENH | GWR Energie-/Wärmequelle Heizung | BFS | `ch.bfs.gebaeude_wohnungs_register_waermequelle_heizung` | OGD | Daily | Heating energy sources |
| AV | Amtliche Vermessung | Cantonal Offices | via geodienste.ch | OGD | Varies | Footprints, parcels, landcovers |
| swissALTI3D | swissALTI3D | swisstopo | `ch.swisstopo.swissalti3d` | OGD | Annual | Terrain elevation model (DTM) |
| swissSURFACE3D | swissSURFACE3D | swisstopo | `ch.swisstopo.swisssurface3d` | OGD | Annual | Surface elevation model (DSM) |
| swissBUILDINGS3D | swissBUILDINGS3D | swisstopo | `ch.swisstopo.swissbuildings3d` | OGD | Annual | 3D building models |
| swissBOUNDARIES3D | swissBOUNDARIES3D | swisstopo | `ch.swisstopo.swissboundaries3d-gemeinde-flaeche.fill` | OGD | Annual | Municipality boundaries |
| ARE | Bauzonen Schweiz | ARE | `ch.are.bauzonen` | OGD | Annual | Zoning classifications |
| KGS | KGS Inventar | BABS | `ch.babs.kulturgueter` | OGD | Occasional | Heritage protection (A/B) |

### API Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| Tech Docs | https://docs.geo.admin.ch | API documentation and guides |
| Layer Catalog | https://api3.geo.admin.ch/rest/services/ech/MapServer | Complete list of available layers |
| Identify | https://api3.geo.admin.ch/rest/services/api/MapServer/identify | Query features by location |
| Find | https://api3.geo.admin.ch/rest/services/api/MapServer/find | Search features by attribute |
| Search | https://api3.geo.admin.ch/rest/services/api/SearchServer | Full-text search (addresses, layers, features) |
| WMS | https://wms.geo.admin.ch | OGC Web Map Service |
| WMTS | https://wmts.geo.admin.ch | OGC Web Map Tile Service |
| STAC | https://data.geo.admin.ch/api/stac/v1 | Spatiotemporal Asset Catalog for downloads |
| Data Browser | https://data.geo.admin.ch/browser | Interactive data download |

### Example API Calls

```bash
# Get building by EGID
curl "https://api3.geo.admin.ch/rest/services/api/MapServer/find?layer=ch.bfs.gebaeude_wohnungs_register&searchText=1231641&searchField=egid&returnGeometry=true"

# Identify features at coordinates (LV95)
curl "https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=2600000,1200000&layers=all:ch.bfs.gebaeude_wohnungs_register&tolerance=50&returnGeometry=true&sr=2056"

# Search for address
curl "https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=bundesplatz%203%20bern&type=locations"
```

---

## Key Documentation

| Document | URL |
|----------|-----|
| geo.admin.ch Tech Docs | https://docs.geo.admin.ch |
| GWR Merkmalskatalog 4.2 | https://www.housing-stat.ch/files/881-2200.pdf |
| GWR Public Data | https://www.housing-stat.ch/__publicdata |
| KKVA Richtlinie Detaillierungsgrad BB | https://www.cadastre-manual.admin.ch/dam/de/sd-web/J969zG4lGjuV/Richtlinie-Detaillierungsgrad-BB-de.pdf |
| Weisung AV-GWR Gebäudeerfassung | https://www.housing-stat.ch/files/1754-2300.pdf |
| Cadastre Manual | https://www.cadastre-manual.admin.ch |
| swisstopo Products | https://www.swisstopo.admin.ch/de/geodata |
