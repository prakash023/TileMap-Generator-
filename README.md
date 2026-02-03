# TileMap Generator

A web-based implementation using Flask and Leaflet.js that provides dynamic tile map generation with interactive features.

Run locally at: `http://localhost:5000`

#Features
- GeoJSON Upload**: Upload polygon GeoJSON files directly in the browser
- Tile Generation**: Convert polygons to rectangular or hexagonal tiles
- Interactive Visualization**: Real-time map display with Leaflet.js
- Algorithm Optimization: RMS offset minimization and area coverage maximization
- statistics Dashboard: Detailed metrics on tile generation performance
- Export Functionality: Download generated tiles as GeoJSON


# Python/Jupyter Version (Original)
The original implementation was in Python/Jupyter Notebook for static tile map generation.
 --> https://github.com/prakash023/Tilemap.git

# Features:
- Python-based data processing
- Static map generation
- Jupyter notebook for interactive development

### Access:
The original Python version is preserved in the `[python-version](https://github.com/prakash023/Tilemap.git)` .

## Project Structure
project_root-/
├── app.py # Flask backend (main application)
├── requirements.txt # Python dependencies
├── templates/
│ └── tilemap.html # Main web interface
└── static/
└── New_Leaflet/
├── style.css # Styling for the web interface
└── javascript.js # Frontend logic and Leaflet integration
