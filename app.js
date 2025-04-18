// Initialize the map centered on a default location
const map = L.map('map').setView([20.5937, 78.9629], 5); // Default to India's center

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Load default KML file on page load
async function loadDefaultBoundaries() {
    try {
        const response = await fetch('Aligarh.kml');
        const text = await response.text();
        const parser = new DOMParser();
        const kml = parser.parseFromString(text, 'text/xml');
        wardData = toGeoJSON.kml(kml);

        // Add ward boundaries to map
        if (wardLayer) map.removeLayer(wardLayer);
        wardLayer = L.geoJSON(wardData, {
            style: {
                color: '#3388ff',
                weight: 2,
                opacity: 0.7,
                fillOpacity: 0.1
            }
        }).addTo(map);

        // Fit map to ward boundaries
        map.fitBounds(wardLayer.getBounds());

        // Enable locate button
        document.getElementById('locate-btn').disabled = false;
        updateStatus('Ward boundaries loaded successfully');
    } catch (error) {
        updateStatus('Error loading default boundaries', true);
        console.error('Error loading default boundaries:', error);
    }
}

// Load default boundaries when page loads
loadDefaultBoundaries();

// Variables to store map layers and data
let userMarker = null;
let wardLayer = null;
let wardData = null;

// Status display function
function updateStatus(message, isError = false) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = isError ? 'error' : 'success';
}

// Handle file upload
document.getElementById('file-input').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        if (file.name.toLowerCase().endsWith('.kml')) {
            // Parse KML using toGeoJSON library
            const parser = new DOMParser();
            const kml = parser.parseFromString(text, 'text/xml');
            wardData = toGeoJSON.kml(kml);
        } else {
            // Parse as GeoJSON
            wardData = JSON.parse(text);
        }

        // Validate GeoJSON structure
        if (!wardData.type || !wardData.features) {
            throw new Error('Invalid GeoJSON format');
        }

        // Add ward boundaries to map
        if (wardLayer) map.removeLayer(wardLayer);
        wardLayer = L.geoJSON(wardData, {
            style: {
                color: '#3388ff',
                weight: 2,
                opacity: 0.7,
                fillOpacity: 0.1
            }
        }).addTo(map);

        // Fit map to ward boundaries
        map.fitBounds(wardLayer.getBounds());

        // Enable locate button
        document.getElementById('locate-btn').disabled = false;
        updateStatus('Ward boundaries loaded successfully');

    } catch (error) {
        updateStatus('Error loading GeoJSON file. Please ensure it\'s a valid GeoJSON format.', true);
        console.error('Error loading GeoJSON:', error);
        document.getElementById('locate-btn').disabled = true;
    }
});

// Check which ward contains the point
function findWard(point) {
    if (!wardData) return null;

    for (const feature of wardData.features) {
        if (turf.booleanPointInPolygon(point, feature)) {
            // Try to find a meaningful name from properties
            const name = feature.properties.name || 
                        feature.properties.NAME || 
                        feature.properties.id || 
                        feature.properties.ID || 
                        'Unknown Ward';
            return name;
        }
    }
    return null;
}

// Handle geolocation
async function locateUser() {
    if (!wardData) {
        updateStatus('Please upload ward boundary data first', true);
        return;
    }

    updateStatus('Getting your location...');

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        });

        const { latitude, longitude } = position.coords;
        const point = turf.point([longitude, latitude]);

        // Update user marker on map
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([latitude, longitude]).addTo(map);
        map.setView([latitude, longitude], 14);

        // Check location against ward boundaries
        const wardName = findWard(point);
        if (wardName) {
            updateStatus(`You are in ${wardName}`);
        } else {
            updateStatus('You are not within any defined ward boundary.', true);
        }

    } catch (error) {
        if (error.code === 1) {
            updateStatus('Location access denied. Please enable location services.', true);
        } else if (error.code === 2) {
            updateStatus('Location unavailable. Please try again.', true);
        } else {
            updateStatus('Error getting location. Please try again.', true);
        }
        console.error('Geolocation error:', error);
    }
}

// Event listeners
document.getElementById('locate-btn').addEventListener('click', locateUser);