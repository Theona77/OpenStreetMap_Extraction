# OSM Cafe Data Extractor

A Python script to extract cafe locations and metadata from OpenStreetMap (OSM) `.osm.pbf` files and export the results to CSV for data analysis and research.

## Overview

This project uses PyOsmium to process OpenStreetMap data and pandas to organize the extracted records into a CSV file.

The script filters OSM objects tagged with `amenity=cafe` and collects their available metadata, including:

- OSM object type and ID
- Cafe name and brand
- Cuisine information
- Latitude and longitude
- Street address
- All available OSM tags

## Features

- Extract cafe records from OSM PBF files.
- Process nodes, ways, and relations.
- Export extracted records to CSV.
- Preserve additional OSM tags for further analysis.
- Support local processing of downloaded OSM data.

## Requirements

- Python 3.11 or later recommended
- pip
- An OpenStreetMap `.osm.pbf` data file
- PyOsmium
- pandas

The installation commands below use Python 3.12.

## Installation

### 1. Clone the repository

Replace `YOUR_USERNAME` with the GitHub account that owns this repository.

```bash
git clone https://github.com/YOUR_USERNAME/ExtractingDataSkripsi.git
cd ExtractingDataSkripsi
```

### 2. Create a virtual environment

**macOS / Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Windows PowerShell**

```powershell
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
```

### 3. Install dependencies

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### 4. Verify the installation

```bash
python -c "import osmium, pandas; print('Installation successful')"
```

## Download OSM Data

The script requires a local `.osm.pbf` file as input. It does not automatically download data from OpenStreetMap.

You can obtain regional extracts from:

- [BBBike OpenStreetMap Extract Service](https://extract.bbbike.org/extract.html)
- [Geofabrik Download Server](https://download.geofabrik.de/)

Choose an area that covers your intended research region and download the data in PBF format.

For a cafe dataset covering Bandung, use a suitable Bandung-area extract. Verify the geographic coverage of the downloaded file before running the script.

Place the downloaded file in the project directory, or provide its path when running the script.

Example:

```text
ExtractingDataSkripsi/
├── .gitignore
├── README.md
├── requirements.txt
├── lihat_cafe.py
└── bandung.osm.pbf
```

The PBF file is local input data and should not be committed to Git.

## Usage

Run the script from the project directory:

```bash
python lihat_cafe.py bandung.osm.pbf
```

Replace `bandung.osm.pbf` with the actual filename or path to your downloaded PBF file.

For example, if the file is stored in a `data` directory:

```bash
python lihat_cafe.py data/bandung.osm.pbf
```

The script prints:

- The total number of extracted cafe objects
- The number of objects grouped by OSM type
- The 15 most frequent cafe names

It then generates:

```text
cafe_bandung.csv
```

The output is saved in the current working directory.

## Output Schema

| Column | Description |
|---|---|
| `osm_type` | OSM object type: node, way, or relation |
| `osm_id` | Identifier of the OSM object |
| `name` | Cafe name, if available |
| `brand` | Brand name, if available |
| `cuisine` | Cuisine tag, if available |
| `lat` | Latitude |
| `lon` | Longitude |
| `alamat` | Street address from `addr:street`, if available |
| `semua_tag` | String representation of the object's OSM tags |

Missing information may be represented by empty values or missing coordinates.

## Important Considerations

### 1. Geographic coverage

The output filename does not determine the geographic area of the dataset. The extracted records depend on the contents of the input PBF file.

### 2. Duplicate locations

A physical cafe may be represented by more than one OSM object, such as a node and a building outline. The script extracts matching objects and does not perform physical-location deduplication.

### 3. Coordinate accuracy

For ways, the current implementation calculates the arithmetic mean of the available node coordinates. This is an approximate location and is not necessarily the geometric centroid of the building.

Relations are currently exported without calculated coordinates.

### 4. Incomplete metadata

Not every OSM object contains a name, brand, cuisine, or street address. Missing fields do not necessarily indicate an invalid record.

The filter `amenity=cafe` only selects objects carrying that exact tag.

### 5. Large input files

Regional PBF files can be large. Processing time and memory requirements depend on the file size, geographic coverage, and available system resources.

### 6. Data licensing and attribution

OpenStreetMap data is available under the Open Database License (ODbL).

If you publish or redistribute derived datasets, follow the applicable attribution and licensing requirements.

Attribution: © OpenStreetMap contributors

More information: [OpenStreetMap Copyright and License](https://www.openstreetmap.org/copyright)

## Troubleshooting

**ModuleNotFoundError**

Ensure the virtual environment is activated and install the dependencies:

```bash
python -m pip install -r requirements.txt
```

**IndexError: list index out of range**

Provide the input PBF filename when running the script:

```bash
python lihat_cafe.py bandung.osm.pbf
```

**FileNotFoundError**

Check that the PBF filename and path are correct:

```bash
ls -lh
```

**Invalid or missing coordinates**

Some OSM objects may not have usable coordinates. Relations are not assigned coordinates by the current implementation, and ways may have invalid or incomplete location data.

## Project Structure

```text
ExtractingDataSkripsi/
├── .gitignore
├── README.md
├── requirements.txt
└── lihat_cafe.py
```

## License

This repository's source-code license should be specified by the repository owner. OpenStreetMap data has its own licensing terms, which apply independently of the source code.

## Acknowledgements

- [OpenStreetMap](https://www.openstreetmap.org/)
- [PyOsmium](https://osmcode.org/pyosmium/)
- [pandas](https://pandas.pydata.org/)


