let map;
let originalLayer;
let tileLayer;
let geojsonData = null;
let lastResult = null;

function initMap() {
  if (map) return;
  map = L.map("map");
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    { maxZoom: 19 }
  ).addTo(map);
}

document.getElementById("scalingFactor").addEventListener("input", e => {
  document.getElementById("scaleValue").innerText = e.target.value;
});

document.getElementById("generateBtn").addEventListener("click", generateTiles);

document.getElementById("geojsonFile").addEventListener("change", e => {
  const reader = new FileReader();
  reader.onload = evt => {
    geojsonData = JSON.parse(evt.target.result);
    populateLabelDropdown();
  };
  reader.readAsText(e.target.files[0]);
});

function populateLabelDropdown() {
  const select = document.getElementById("labelColumn");
  select.innerHTML = '<option value="None">None</option>';
  geojsonData.features.forEach(f => {
    Object.keys(f.properties || {}).forEach(k => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k;
      select.appendChild(opt);
    });
  });
}

async function generateTiles() {
  const file = document.getElementById("geojsonFile").files[0];
  const formData = new FormData();
  formData.append("file", file);
  formData.append("tile_shape", document.getElementById("tileShape").value);
  formData.append("scale", document.getElementById("scalingFactor").value);
  formData.append("label", document.getElementById("labelColumn").value);

  const res = await fetch("/generate", { method: "POST", body: formData });
  lastResult = await res.json();
  visualize(lastResult);
}

function visualize(data) {
  initMap();

  if (originalLayer) map.removeLayer(originalLayer);
  if (tileLayer) map.removeLayer(tileLayer);

  originalLayer = L.geoJSON(data.viz_original).addTo(map);
  tileLayer = L.geoJSON(data.viz_tiles, {
    style: { color: "#e74c3c", fillOpacity: 0.4 }
  }).addTo(map);

  map.fitBounds(originalLayer.getBounds());

  document.getElementById("s-polygons").textContent = data.stats.total_polygons;
  document.getElementById("s-tiles").textContent = data.stats.generated_tiles;
  document.getElementById("s-coverage").textContent = data.stats.coverage_pct;
  document.getElementById("s-rms").textContent = data.stats.rms_offset_m;
  document.getElementById("s-covered").textContent = data.stats.covered_area_m2;
  document.getElementById("s-uncovered").textContent = data.stats.uncovered_area_m2;
  document.getElementById("s-combined").textContent = data.stats.combined_metric;

  document.getElementById("consoleOutput").textContent =
    JSON.stringify(data.stats, null, 2);
}

function exportGeoJSON() {
  if (!lastResult) return alert("Generate tiles first");
  const blob = new Blob(
    [JSON.stringify(lastResult.viz_tiles, null, 2)],
    { type: "application/geo+json" }
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "tiles.geojson";
  a.click();
}
