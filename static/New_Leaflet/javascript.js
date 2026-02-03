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
document.getElementById("exportBtn").addEventListener("click", exportGeoJSON);

// ===== DRAG & DROP FUNCTIONALITY =====
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('geojsonFile');
const browseBtn = document.querySelector('.browse-btn');
const clearBtn = document.getElementById('clearFile');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileFeatures = document.getElementById('fileFeatures');
const generateBtn = document.getElementById('generateBtn');

// Browse button click
browseBtn.addEventListener('click', () => fileInput.click());

// File input change
fileInput.addEventListener('change', handleFileSelect);

// Clear file button
clearBtn.addEventListener('click', clearFile);

// Drag & drop events
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, preventDefaults, false);
});

['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, unhighlight, false);
});

dropZone.addEventListener('drop', handleDrop, false);

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight() {
  dropZone.classList.add('dragover');
}

function unhighlight() {
  dropZone.classList.remove('dragover');
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  
  if (files.length > 0) {
    const file = files[0];
    if (file.name.endsWith('.geojson') || file.type === 'application/geo+json') {
      fileInput.files = files;
      handleFileSelect({ target: { files: files } });
    } else {
      alert('Please upload a GeoJSON file (.geojson)');
    }
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      geojsonData = JSON.parse(evt.target.result);
      
      // Show file info
      fileName.textContent = file.name;
      fileFeatures.textContent = `${geojsonData.features.length} features`;
      fileInfo.style.display = 'block';
      
      // Enable generate button
      generateBtn.disabled = false;
      
      // Populate label dropdown
      populateLabelDropdown();
      
      // Quick preview (optional)
      quickPreview(geojsonData);
      
    } catch (error) {
      alert('Error reading GeoJSON file: ' + error.message);
      clearFile();
    }
  };
  reader.readAsText(file);
}

function clearFile() {
  fileInput.value = '';
  geojsonData = null;
  fileInfo.style.display = 'none';
  generateBtn.disabled = true;
  
  // Clear label dropdown
  const select = document.getElementById("labelColumn");
  select.innerHTML = '<option value="None">None</option>';
  
  // Clear map preview if any
  if (originalLayer) {
    map.removeLayer(originalLayer);
    originalLayer = null;
  }
}

function quickPreview(data) {
  initMap();
  
  if (originalLayer) {
    map.removeLayer(originalLayer);
  }
  
  originalLayer = L.geoJSON(data, {
    style: { color: '#3b82f6', fillOpacity: 0.3, weight: 2 }
  }).addTo(map);
  
  map.fitBounds(originalLayer.getBounds());
}

// ===== LABEL DROPDOWN =====
function populateLabelDropdown() {
  const select = document.getElementById("labelColumn");
  select.innerHTML = '<option value="None">None</option>';
  
  if (!geojsonData || !geojsonData.features) return;
  
  const uniqueKeys = new Set();
  
  geojsonData.features.forEach(feature => {
    if (feature.properties) {
      Object.keys(feature.properties).forEach(key => {
        uniqueKeys.add(key);
      });
    }
  });
  
  const sortedKeys = Array.from(uniqueKeys).sort();
  
  sortedKeys.forEach(key => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = key;
    select.appendChild(option);
  });
}

// ===== TILE GENERATION =====
async function generateTiles() {
  if (!geojsonData) {
    alert("Please upload a GeoJSON file first");
    return;
  }
  
  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append("file", file);
  formData.append("tile_shape", document.getElementById("tileShape").value);
  formData.append("scale", document.getElementById("scalingFactor").value);
  formData.append("label", document.getElementById("labelColumn").value);

  // Show loading state
  const originalText = generateBtn.textContent;
  generateBtn.innerHTML = '<span class="spinner">⌛</span> Processing...';
  generateBtn.disabled = true;

  try {
    const res = await fetch("/generate", { method: "POST", body: formData });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    
    lastResult = await res.json();
    visualize(lastResult);
  } catch (error) {
    alert("Error generating tiles: " + error.message);
  } finally {
    // Restore button
    generateBtn.textContent = originalText;
    generateBtn.disabled = false;
  }
}

// ===== VISUALIZATION =====
function visualize(data) {
  initMap();

  if (originalLayer) map.removeLayer(originalLayer);
  if (tileLayer) map.removeLayer(tileLayer);

  originalLayer = L.geoJSON(data.viz_original, {
    style: { color: '#3b82f6', fillOpacity: 0.5, weight: 2 }
  }).addTo(map);
  
  tileLayer = L.geoJSON(data.viz_tiles, {
    style: { color: "#e74c3c", fillOpacity: 0.4, weight: 1.5 }
  }).addTo(map);

  map.fitBounds(originalLayer.getBounds());

  // Update statistics
  document.getElementById("s-polygons").textContent = data.stats.total_polygons;
  document.getElementById("s-tiles").textContent = data.stats.generated_tiles;
  document.getElementById("s-coverage").textContent = data.stats.coverage_pct.toFixed(2);
  document.getElementById("s-rms").textContent = data.stats.rms_offset_m.toFixed(2);
  document.getElementById("s-covered").textContent = Math.round(data.stats.covered_area_m2);
  document.getElementById("s-uncovered").textContent = Math.round(data.stats.uncovered_area_m2);
  document.getElementById("s-combined").textContent = data.stats.combined_metric.toFixed(4);
  document.getElementById("tile-width").textContent = data.stats.tile_width_m.toFixed(2);
}

// ===== EXPORT =====
function exportGeoJSON() {
  if (!lastResult) return alert("Generate tiles first");
  
  const blob = new Blob(
    [JSON.stringify(lastResult.viz_tiles, null, 2)],
    { type: "application/geo+json" }
  );
  
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "generated_tiles.geojson";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}