const PROVIDER_SEARCH_TAGS = {
  all: [
    ["amenity", "hospital|clinic|pharmacy|doctors|doctor|dentist|urgent_care|laboratory|medical_center|medical_centre"],
    ["healthcare", "hospital|clinic|pharmacy|doctor|dentist|urgent_care|laboratory|medical_centre|health_centre"],
    ["shop", "chemist|medical_supply"],
  ],
  hospital: [["amenity", "hospital"], ["healthcare", "hospital"]],
  clinic: [["amenity", "clinic"], ["healthcare", "clinic|health_centre"]],
  pharmacy: [["amenity", "pharmacy"], ["healthcare", "pharmacy"], ["shop", "chemist"]],
  urgent_care: [["amenity", "urgent_care"], ["healthcare", "urgent_care"]],
  laboratory: [["amenity", "laboratory"], ["healthcare", "laboratory"]],
  doctor: [["amenity", "doctors|doctor|dentist"], ["healthcare", "doctor|dentist"]],
};
const PHOTON_SEARCH_TERMS = {
  hospital: "hospital",
  clinic: "clinic",
  pharmacy: "pharmacy",
  urgent_care: "urgent care",
  laboratory: "laboratory",
  doctor: "doctor",
};

export const config = { maxDuration: 60 };

function buildQuery({ lat, lon, radius = 5000, type = "all" }) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  const searchRadius = Number(radius);
  const tags = PROVIDER_SEARCH_TAGS[String(type).toLowerCase()];

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new RangeError("Invalid latitude.");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new RangeError("Invalid longitude.");
  if (!Number.isFinite(searchRadius) || searchRadius < 250 || searchRadius > 50000) throw new RangeError("Invalid radius.");
  if (!tags) throw new RangeError("Unsupported provider type.");

  const selectors = tags.map(([tag, pattern]) =>
    `nwr(around:${searchRadius},${latitude},${longitude})[${tag}~"^(${pattern})$",i];`
  );
  return `[out:json][timeout:25];(${selectors.join("")});out center tags 500;`;
}

function distanceMeters(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const toRadians = (value) => value * Math.PI / 180;
  const latitudeDelta = toRadians(secondLatitude - firstLatitude);
  const longitudeDelta = toRadians(secondLongitude - firstLongitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(firstLatitude)) * Math.cos(toRadians(secondLatitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function photonTypeMatches(properties, requestedType) {
  const key = String(properties.osm_key || "").toLowerCase();
  const value = String(properties.osm_value || "").toLowerCase();
  const amenityOrHealthcare = key === "amenity" || key === "healthcare";

  if (requestedType === "all") {
    return (amenityOrHealthcare && ["hospital", "clinic", "health_centre", "pharmacy", "doctor", "doctors", "dentist", "urgent_care", "laboratory", "medical_centre"].includes(value))
      || (key === "shop" && ["chemist", "medical_supply"].includes(value));
  }
  if (requestedType === "hospital") return amenityOrHealthcare && value === "hospital";
  if (requestedType === "clinic") return amenityOrHealthcare && ["clinic", "health_centre"].includes(value);
  if (requestedType === "pharmacy") return (amenityOrHealthcare && value === "pharmacy") || (key === "shop" && value === "chemist");
  if (requestedType === "urgent_care") return amenityOrHealthcare && value === "urgent_care";
  if (requestedType === "laboratory") return amenityOrHealthcare && value === "laboratory";
  if (requestedType === "doctor") return amenityOrHealthcare && ["doctor", "doctors", "dentist"].includes(value);
  return false;
}

async function fetchPhotonNearby({ latitude, longitude, radius, type, startedAt }) {
  const matches = [];
  const categories = type === "all" ? Object.keys(PHOTON_SEARCH_TERMS) : [type];

  for (const category of categories) {
    const remainingMs = 55000 - (Date.now() - startedAt);
    if (remainingMs < 1000) break;

    const photonUrl = new URL("https://photon.komoot.io/api/");
    photonUrl.searchParams.set("q", PHOTON_SEARCH_TERMS[category]);
    photonUrl.searchParams.set("lat", String(latitude));
    photonUrl.searchParams.set("lon", String(longitude));
    photonUrl.searchParams.set("limit", "50");

    try {
      const result = await fetch(photonUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "MedPathAI/1.0 (https://medpath-ai-frontend-project.vercel.app)",
        },
        signal: AbortSignal.timeout(Math.min(4000, remainingMs - 500)),
      });
      if (!result.ok) continue;

      const data = await result.json();
      for (const feature of data.features || []) {
        const properties = feature.properties || {};
        if (!photonTypeMatches(properties, category)) continue;
        const coordinates = feature.geometry?.coordinates || [];
        const featureLongitude = Number(coordinates[0]);
        const featureLatitude = Number(coordinates[1]);
        if (!Number.isFinite(featureLatitude) || !Number.isFinite(featureLongitude)) continue;
        const distance = distanceMeters(latitude, longitude, featureLatitude, featureLongitude);
        if (distance > radius) continue;

        matches.push({
          type: properties.osm_type || "node",
          id: properties.osm_id || `${properties.osm_key}-${properties.name}-${featureLatitude}-${featureLongitude}`,
          lat: featureLatitude,
          lon: featureLongitude,
          center: { lat: featureLatitude, lon: featureLongitude },
          tags: {
            [properties.osm_key]: properties.osm_value,
            name: properties.name,
            phone: properties.phone,
            website: properties.website,
            opening_hours: properties.opening_hours,
          },
        });
      }
    } catch (error) {
      console.warn(`Photon ${category} search failed: ${error.cause?.code || error.message}`);
    }
  }

  return matches;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  let query;
  try {
    query = buildQuery(request.query || {});
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
  ];
  const startedAt = Date.now();

  for (const endpoint of endpoints) {
    const remainingMs = 25000 - (Date.now() - startedAt);
    if (remainingMs < 1000) break;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(10000, remainingMs - 500));
    try {
      const url = new URL(endpoint);
      url.searchParams.set("data", query);
      const result = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "MedPathAI/1.0 (https://medpath-ai-frontend-project.vercel.app)",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!result.ok) {
        console.warn(`Overpass ${endpoint} returned ${result.status}.`);
        continue;
      }
      const data = await result.json();
      if (data.elements?.length) {
        response.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
        return response.status(200).json(data);
      }
    } catch (error) {
      clearTimeout(timeout);
      console.warn(`Overpass ${endpoint} failed: ${error.cause?.code || error.message}`);
    }
  }

  try {
    const latitude = Number(request.query.lat);
    const longitude = Number(request.query.lon);
    const radius = Number(request.query.radius || 5000);
    const type = String(request.query.type || "all").toLowerCase();
    const elements = await fetchPhotonNearby({ latitude, longitude, radius, type, startedAt });
    if (elements.length) {
      response.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
      return response.status(200).json({ elements, source: "photon" });
    }
  } catch (error) {
    console.warn(`Photon provider fallback failed: ${error.cause?.code || error.message}`);
  }

  return response.status(503).json({ error: "Live provider search is temporarily unavailable. Please try again." });
}
