const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export async function fetchDirections(coordinates: [number, number][]) {
  if (!MAPBOX_TOKEN) {
    console.warn("VITE_MAPBOX_TOKEN is missing. Cannot fetch directions.");
    return null;
  }
  
  if (coordinates.length < 2) return null;

  // Format: "lng,lat;lng,lat;..."
  const coordsString = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0]; // Returns { geometry, duration, distance, weight_name, weight, ... }
    }
    return null;
  } catch (err) {
    console.error("Mapbox Directions API error:", err);
    return null;
  }
}

export async function geocode(query: string) {
  if (!MAPBOX_TOKEN) return [];
  if (!query) return [];

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.features || [];
  } catch (err) {
    console.error("Mapbox Geocoding API error:", err);
    return [];
  }
}
