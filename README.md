# OpenBuildings.ch

**Swiss building data. Open in theory. Now open in practice.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What It Is

A building data foundation you can see, use, and learn from.

We've done the work most organizations struggle to even scope: defined what data matters, found the best open sources, connected them into a coherent whole.

**Curated. Connected. Maintained. Ready to plug into your planning, reporting, and decision-making.**

---

## Why It Matters

Buildings account for **40% of Switzerland's CO₂ emissions**. Every path to net zero runs through the building stock.

But you can't decarbonize what you can't measure. And right now, most organizations are guessing — or paying someone to figure out what should already exist.

A shared foundation changes that:
- Plan with real numbers
- Report with confidence
- Compare across portfolios, communes, cantons

One investment. Everyone benefits.

---

## Features

### Data Platform

| Feature | Description |
|---------|-------------|
| **Buildings** | 2M+ Swiss buildings with attributes from GWR, volumes from elevation models |
| **Parcels** | Land parcels from cadastral survey (Amtliche Vermessung) |
| **Landcovers** | Building footprints and land use classifications |
| **Projects** | Construction projects and building permits |

### Tools

| Tool | Description |
|------|-------------|
| **Web Map** | Interactive map interface for exploring building data |
| **Python CLI** | Calculate building volumes from geodata |
| **FME Workbench** | Visual workflow for FME Desktop users |

---

## Quick Start

### Web Interface

Open `index.html` in a browser to explore buildings on an interactive map with:
- Search by address using the Swisstopo API
- Toggle between 2D and 3D views with terrain
- Switch between Light, Streets, Outdoors, and Satellite basemaps
- Click buildings and parcels for details

### Python Volume Calculator

Calculate building volumes using swissALTI3D (terrain) and swissSURFACE3D (surface) models:

```bash
# Install dependencies
pip install geopandas rasterio numpy pandas shapely fiona

# Run calculator
python python/main.py data/av_2056.gpkg data/alti3d data/surface3d

# With options
python python/main.py data/av_2056.gpkg data/alti3d data/surface3d \
    --limit 100 \
    --bbox 2680000 1235000 2681000 1236000 \
    -o results.csv \
    -g buildings_with_volumes.gpkg
```

See [python/README.md](python/README.md) for detailed usage.

---

## Data Model

The platform aggregates Swiss Open Government Data (OGD) into four core entities:

```
parcels ||--o{ buildings : "contains"
buildings ||--o| landcovers : "has footprint"
parcels ||--o{ landcovers : "contains"
buildings ||--o{ projects : "has"
```

### Buildings

Core building attributes including:
- **Identification**: EGID, address, location
- **Classification**: Status, category, building class
- **Dimensions**: Volume (m³), floor area (m²), heights (m), floors
- **Energy**: Heating type and source
- **Heritage**: KGS protection category

### Parcels

Land parcels with:
- **Identification**: E-GRID, parcel number
- **Dimensions**: Area (m²), building footprint area, sealed area
- **Zoning**: Main zone, zone type

See [documentation/DATAMODEL.md](documentation/DATAMODEL.md) for the complete schema.

---

## Data Sources

Primary data access is through the **Federal Spatial Data Infrastructure (FSDI)** via geo.admin.ch.

| Source | Provider | Content |
|--------|----------|---------|
| **GWR** | BFS | Building attributes, dwellings, addresses |
| **AV** | Cantonal Offices | Footprints, parcels, landcovers |
| **swissALTI3D** | swisstopo | Terrain elevation model (DTM) |
| **swissSURFACE3D** | swisstopo | Surface elevation model (DSM) |
| **swissBUILDINGS3D** | swisstopo | 3D building models |
| **ARE** | ARE | Zoning classifications |
| **KGS** | BABS | Heritage protection |

All sources are Swiss OGD with varying update frequencies.

---

## Project Structure

```
OpenBuildings/
├── documentation/
│   ├── VISION.md          # Project vision and principles
│   ├── DATAMODEL.md       # Database schema documentation
│   └── STYLEGUIDE.md      # Design system and UI guidelines
├── python/
│   ├── main.py            # Building volume calculator
│   └── README.md          # Python tool documentation
├── fme/
│   └── swissALTI3D Volumen.fmw  # FME workbench
├── images/                # Screenshots and visuals
├── index.html             # Web map interface
└── LICENSE                # MIT License
```

---

## Technical Details

### Coordinate System

- **Swiss LV95** (EPSG:2056)
- Tile naming: `XXXX_YYYY` based on SW corner in kilometers

### Methodology

The volume calculation:
1. Creates 1×1m voxel grid within each building footprint
2. Samples terrain height (swissALTI3D) for base elevation
3. Samples surface height (swissSURFACE3D) for roof elevation
4. Calculates: `Volume = Σ(roof - base) × 1m²`

### Standards

- **SIA 416**: Swiss standard for building areas and volumes
- **GWR Merkmalskatalog 4.2**: Building register specifications
- **DM.01-AV-CH**: Cadastral data model

---

## Business Model

| Tier | Access |
|------|--------|
| **Free** | Explore, search, download individual buildings |
| **Paid** | Bulk data, API access, portfolio reports |

Revenue keeps the foundation maintained. The core stays open.

---

## Principles

- **Open by default** — Methods, sources, flaws and limitations — all public
- **Quality over quantity** — Good data beats more data
- **Interoperable and stable** — Following national and international standards

---

## Documentation

| Document | Description |
|----------|-------------|
| [VISION.md](documentation/VISION.md) | Project vision and goals |
| [DATAMODEL.md](documentation/DATAMODEL.md) | Complete database schema |
| [STYLEGUIDE.md](documentation/STYLEGUIDE.md) | Design system |
| [python/README.md](python/README.md) | Python tool usage |

---

## Contributing

This is an open project. Use it. Tell us what's broken. Help make it better.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Links

- **Website**: [openbuildings.ch](https://openbuildings.ch)
- **GitHub**: [github.com/davras5/OpenBuildings](https://github.com/davras5/OpenBuildings)
- **geo.admin.ch**: [docs.geo.admin.ch](https://docs.geo.admin.ch)

---

*Building data belongs to everyone. We're making that real.*
