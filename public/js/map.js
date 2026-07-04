console.log("Listing Data from DB:", listingData);

// 1. Extract coordinates or use a fallback for Delhi [Lng, Lat]
let coordinates = listingData.geometry?.coordinates;

if (!coordinates || coordinates.length === 0) {
    console.error("WARNING: No coordinates found in database for this listing!");
    coordinates = [77.2090, 28.6139]; 
}

// 2. Flip for Leaflet [Lat, Lng]
const latLng = [coordinates[1], coordinates[0]];

// 3. Initialize the Map
const map = L.map('map', { zoomControl: false }).setView(latLng, 13);

// 4. Add OpenStreetMap Tiles 
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

// 5. Move Zoom Controls
L.control.zoom({ position: 'topright' }).addTo(map);

// 6. Draw the Pink Radius Circle
L.circle(latLng, {
    color: 'transparent',
    fillColor: '#FF385C',
    fillOpacity: 0.3,
    radius: 1000
}).addTo(map);

// 7. Custom Red Circular Marker
const customIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `
        <div style="background-color: #FF385C; width: 40px; height: 40px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 20px;">
            <i class="fa-solid fa-house"></i>
        </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

// 8. Add Marker to the map
const marker = L.marker(latLng, { icon: customIcon }).addTo(map);

// 9. Bind the popup (but do not open it yet)
marker.bindPopup("Exact location provided after booking.", {
    closeButton: false, // Natively hides the 'x' close button
    offset: [0, -10]    // Slightly raises the popup so it doesn't cover the icon
});

// 10. Add Hover Events
marker.on('mouseover', function (e) {
    this.openPopup();
});

marker.on('mouseout', function (e) {
    this.closePopup();
});