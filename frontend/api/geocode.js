let nextRequestAt = 0;

export const config = { maxDuration: 30 };

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const searchText = String(request.query?.q || "").trim();
  if (searchText.length < 3 || searchText.length > 200) {
    return response.status(400).json({ error: "Enter a location between 3 and 200 characters." });
  }

  const now = Date.now();
  if (now < nextRequestAt) {
    return response.status(429).json({ error: "Please wait a moment before searching another location." });
  }
  nextRequestAt = now + 1000;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", searchText);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  try {
    const result = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "MedPathAI/1.0 (https://medpath-ai-frontend-project.vercel.app)",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) {
      console.warn(`Nominatim returned ${result.status}.`);
      return response.status(502).json({ error: "Location search is temporarily unavailable. Please try again." });
    }

    const results = await result.json();
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return response.status(200).json({
      locations: results.map((location) => ({
        displayName: location.display_name,
        lat: Number(location.lat),
        lon: Number(location.lon),
        type: location.type,
      })),
    });
  } catch (error) {
    console.warn(`Nominatim request failed: ${error.cause?.code || error.message}`);
    return response.status(502).json({ error: "Location search is temporarily unavailable. Please try again." });
  }
}
