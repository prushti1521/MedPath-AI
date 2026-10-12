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
    const remainingMs = 55000 - (Date.now() - startedAt);
    if (remainingMs < 1000) break;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(26000, remainingMs - 1000));
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
      return response.status(200).json(await result.json());
    } catch (error) {
      clearTimeout(timeout);
      console.warn(`Overpass ${endpoint} failed: ${error.cause?.code || error.message}`);
    }
  }

  return response.status(503).json({ error: "Live provider search is temporarily unavailable. Please try again." });
}
