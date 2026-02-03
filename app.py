from flask import Flask, render_template, request, jsonify
import geopandas as gpd
from shapely.geometry import box, Polygon
import math
import numpy as np

app = Flask(__name__)

def generate_tiles_core(polygons, tile_shape, scale, label_column):
    polygons = polygons.to_crs(epsg=3857)
    polygons["centroid"] = polygons.geometry.centroid

    minx, miny, maxx, maxy = polygons.total_bounds
    target_cells = len(polygons)

    area = (maxx - minx) * (maxy - miny)
    tile_area = area / target_cells
    grid_width = grid_height = math.sqrt(tile_area)

    max_attempts = 15
    attempt = 0

    while attempt < max_attempts:
        grid_cells = []
        grid_width *= scale
        grid_height *= scale
        attempt += 1

        if tile_shape == "Rechteck":
            x = minx
            while x < maxx:
                y = miny
                while y < maxy:
                    grid_cells.append(box(x, y, x + grid_width, y + grid_height))
                    y += grid_height
                x += grid_width

        elif tile_shape == "Hexagon":
            hex_height = grid_height
            hex_width = math.sqrt(3) / 2 * hex_height
            y = miny
            row = 0
            while y < maxy + hex_height:
                x = minx - (row % 2) * (hex_width / 2)
                while x < maxx + hex_width:
                    angles = [math.radians(a) for a in range(-30, 330, 60)]
                    points = [
                        (
                            x + (hex_height / 2) * math.cos(a),
                            y + (hex_height / 2) * math.sin(a),
                        )
                        for a in angles
                    ]
                    grid_cells.append(Polygon(points))
                    x += hex_width
                y += hex_height * 0.75
                row += 1
        else:
            raise ValueError("Invalid tile shape")

        grid = gpd.GeoDataFrame({"geometry": grid_cells}, crs=polygons.crs)
        region_union = polygons.geometry.union_all()
        grid = grid[grid.intersects(region_union)].reset_index(drop=True)
        grid["grid_centroid"] = grid.geometry.centroid

        if len(grid) >= len(polygons):
            break

    assigned_geoms = []
    available = grid.copy()

    for _, row in polygons.iterrows():
        if len(available) == 0:
            break
        distances = available["grid_centroid"].distance(row["centroid"])
        idx = distances.idxmin()
        assigned_geoms.append(available.loc[idx].geometry)
        available = available.drop(idx)

    snapped = gpd.GeoDataFrame({"geometry": assigned_geoms}, crs=polygons.crs)

    centroid_offsets = [
        polygons.loc[i, "centroid"].distance(snapped.loc[i].geometry.centroid)
        for i in range(len(snapped))
    ]
    rms_offset = float(np.sqrt(np.mean(np.array(centroid_offsets) ** 2)))

    region_union = polygons.geometry.union_all()
    tiles_union = snapped.geometry.union_all()
    covered_area = region_union.intersection(tiles_union).area
    total_area = region_union.area
    uncovered_area = total_area - covered_area
    covered_pct = (covered_area / total_area * 100) if total_area > 0 else 0

    combined_metric = (rms_offset / grid_width) * (1 - covered_pct / 100)

    # 🔧 CRITICAL FIX — REMOVE SHAPELY OBJECTS
    for col in ["centroid", "grid_centroid"]:
        if col in polygons.columns:
            polygons = polygons.drop(columns=[col])
        if col in snapped.columns:
            snapped = snapped.drop(columns=[col])

    polygons_4326 = polygons.to_crs(epsg=4326)
    snapped_4326 = snapped.to_crs(epsg=4326)

    return {
        "viz_original": polygons_4326.__geo_interface__,
        "viz_tiles": snapped_4326.__geo_interface__,
        "stats": {
            "total_polygons": len(polygons),
            "generated_tiles": len(snapped),
            "coverage_pct": round(covered_pct, 2),
            "rms_offset_m": round(rms_offset, 2),
            "tile_width_m": round(grid_width, 2),
            "tile_height_m": round(grid_height, 2),
            "covered_area_m2": round(covered_area, 2),
            "uncovered_area_m2": round(uncovered_area, 2),
            "combined_metric": round(combined_metric, 4),
        },
    }

@app.route("/")
def index():
    return render_template("tilemap.html")

@app.route("/generate", methods=["POST"])
def generate():
    file = request.files["file"]
    tile_shape = request.form["tile_shape"]
    scale = float(request.form["scale"])
    label = request.form.get("label", "None")

    gdf = gpd.read_file(file)

    result = generate_tiles_core(
        polygons=gdf,
        tile_shape=tile_shape,
        scale=scale,
        label_column=label,
    )

    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)
