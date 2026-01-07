# Swisstopo 3D Building Volume and Surface Analysis Tools

## Overview

This toolset processes [Swisstopo 3D building data](https://www.swisstopo.admin.ch/en/landscape-model-swissbuildings3d-3-0-beta) (multipatch geometries) to calculate building volumes and analyze surface areas. It's designed to handle large datasets efficiently using parallel processing, providing detailed metrics for each building including volume, roof area, footprint, and wall areas.

## Result
The full processed dataset as a CSV file (1.2 GB) is available at:
- [Download from Google Drive](https://drive.google.com/file/d/1AS-dI3VbV52xkmuAYBvPIzVNZnVGNWXG/view?usp=sharing)

## What the Toolset Does

1. **Reads** Swisstopo 3D building data from GDB (geodatabase) files
2. **Repairs** mesh geometries to ensure they are watertight for accurate volume calculation
3. **Calculates** building volumes using advanced mesh repair techniques
4. **Analyzes** surface areas, classifying them as roof, footprint, or walls
5. **Outputs** comprehensive results in CSV format

## Requirements

- Python 3.8 or higher
- Required Python packages:
  - fiona
  - pandas
  - numpy
  - trimesh

Install with:
```bash
python -m pip install fiona pandas numpy trimesh
```

## Files

- `main.py` - Main orchestrator script
- `mesh_repair_volume.py` - Mesh repair and volume calculation module
- `surface_analysis.py` - Surface area analysis module
- `test_imports.py` - Utility to verify installation

## Usage

### Basic Command Structure

```bash
python main.py <input_gdb_path> <output_directory> [options]
```

### Parameters

- `<input_gdb_path>` - Path to Swisstopo GDB file (required)
- `<output_directory>` - Where to save results (required)
- `--layer` - GDB layer name (default: "Building_solid")
- `--limit` - Process only first N buildings (optional, for testing)
- `--workers` - Number of parallel workers (default: CPU count - 1, max 8)
- `--chunk-size` - Number of buildings per chunk (default: 100000)
- `--keep-chunks` - Keep individual chunk CSV files after merging

### Example Usage

1. **Test run 100 buildings with 8 workers:**
   ```bash
   cd "C:\DEV\Python\SWT 3D Buildings"
   python main.py "C:\DEV\Inputs\SWISSBUILDINGS3D_3_0.gdb" "C:\DEV\Python\SWT 3D Buildings\output" --layer Building_solid --workers 8 --limit 100
   ```

2. **Process entire dataset with 8 workers:**
   ```bash
   python main.py "C:\DEV\Inputs\SWISSBUILDINGS3D_3_0.gdb" "C:\DEV\Output" --layer Building_solid --workers 8
   ```

## Output Files

### Generated Files

- `building_analysis_YYYYMMDD_HHMMSS.csv` - Complete results in CSV format
- `building_analysis_YYYYMMDD_HHMMSS_chunk_XXXX.csv` - Individual chunk files (if `--keep-chunks` is used)
- `processing.log` - Detailed processing log

### Output Variables

#### Input Fields (preserved from GDB)

- `OBJECTID` - Original Swisstopo building ID
- `UUID` - Unique identifier
- `OBJEKTART` - Object type
- `NAME_KOMPLETT` - Complete building name
- `GEBAEUDE_NUTZUNG` - Building usage
- `DACH_MAX`/`DACH_MIN` - Roof height values
- `EGID` - Federal building ID
- (and all other original fields)

#### Mesh Processing Fields (prefix: mesh_)

| Field | Type | Description |
|-------|------|-------------|
| `mesh_volume` | float | Building volume in cubic meters |
| `mesh_is_watertight` | bool | Whether mesh is watertight |
| `mesh_vertex_count` | int | Number of mesh vertices |
| `mesh_face_count` | int | Number of mesh faces |
| `mesh_repair_applied` | bool | Whether repair was needed |
| `mesh_repair_steps` | string | Description of repair process |
| `mesh_process_error` | string | Error message if processing failed |

#### Surface Analysis Fields (prefix: surf_)

| Field | Type | Description |
|-------|------|-------------|
| `surf_roof_area` | float | Roof surface area (m²) |
| `surf_footprint_area` | float | Building footprint area (m²) |
| `surf_wall_area` | float | Total wall area (m²) |
| `surf_sloped_area` | float | Sloped surface area (m²) |
| `surf_total_area` | float | Total surface area (m²) |
| `surf_building_height` | float | Calculated building height (m) |
| `surf_wall_perimeter` | float | Estimated wall perimeter (m) |
| `surf_roof_complexity` | float | Roof complexity ratio (0-1) |
| `surf_min_elevation` | float | Minimum Z coordinate |
| `surf_max_elevation` | float | Maximum Z coordinate |
| `surf_horizontal_faces` | int | Count of horizontal faces |
| `surf_vertical_faces` | int | Count of vertical faces |
| `surf_sloped_faces` | int | Count of sloped faces |
| `surf_analysis_error` | string | Error message if analysis failed |

#### Processing Status Fields

- `processing_status` - "success" or "failed"
- `processing_error` - Overall error message if failed

## Performance Tips

1. **Test First**: Always run with `--limit 100` to verify everything works
2. **Workers**: Use `--workers` equal to your CPU cores minus 1
3. **Memory**: For large datasets (>500k buildings), the chunking system handles memory automatically
4. **Storage**: Ensure sufficient disk space for output files (estimate ~300-500 bytes per building)

## Troubleshooting

1. **Import Errors**: Run `python test_imports.py` to verify installation
2. **Memory Issues**: Reduce `--workers` or decrease `--chunk-size`
3. **GDB Access**: Ensure the GDB file path has no special characters
4. **Missing Libraries**: Install with `python -m pip install [library_name]`

## Processing Time Estimates

- 100 buildings: ~10-30 seconds
- 10,000 buildings: ~5-10 minutes
- 100,000 buildings: ~1-2 hours
- 1,700,000 buildings: ~2-4 hours (depending on CPU and workers)
- 2,500,000 buildings: ~6-8 hours (depending on CPU and workers)


## Notes

- Surface classification uses 10° tolerance for horizontal/vertical determination
- Footprint is defined as horizontal surfaces in the lowest 10% of building height
- Wall perimeter is estimated from wall area divided by building height
- All area measurements are in square meters (m²)
- All volume measurements are in cubic meters (m³)
- Coordinates are preserved in the original Swiss coordinate system
- For datasets exceeding 1 million rows, only CSV output is generated (Excel has a 1,048,576 row limit)

## Authors

Developed by the Federal Office for Buildings and Logistics BBL for processing Swisstopo 3D building data (swissBUILDINGS3D 3.0).
