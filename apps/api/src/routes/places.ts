import type { FastifyInstance } from "fastify";

interface GooglePlacesAutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
  error?: {
    message?: string;
  };
}

interface GooglePlaceDetailsResponse {
  formattedAddress?: string;
  displayName?: { text?: string };
  location?: {
    latitude?: number;
    longitude?: number;
  };
  error?: {
    message?: string;
  };
}

interface GoogleTimezoneResponse {
  status?: string;
  timeZoneId?: string;
}

function getGooglePlacesApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
}

async function fetchPlaceSuggestions(
  apiKey: string,
  input: string,
  referer?: string,
  signal?: AbortSignal,
) {
  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "suggestions.placePrediction.placeId",
        "suggestions.placePrediction.text.text",
        "suggestions.placePrediction.structuredFormat.mainText.text",
        "suggestions.placePrediction.structuredFormat.secondaryText.text",
      ].join(","),
      ...(referer ? { Referer: referer } : {}),
    },
    body: JSON.stringify({
      input,
      languageCode: "en",
    }),
    signal,
  });

  const payload = await response.json().catch(() => null) as GooglePlacesAutocompleteResponse | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Places autocomplete failed with HTTP ${response.status}`);
  }

  return (payload?.suggestions ?? [])
    .flatMap((entry) => {
      const prediction = entry.placePrediction;
      const placeId = prediction?.placeId?.trim();
      const primaryText = prediction?.structuredFormat?.mainText?.text?.trim()
        || prediction?.text?.text?.trim()
        || "";
      const secondaryText = prediction?.structuredFormat?.secondaryText?.text?.trim() || null;

      if (!placeId || !primaryText) {
        return [];
      }

      return [{
        placeId,
        label: secondaryText ? `${primaryText}, ${secondaryText}` : primaryText,
        primaryText,
        secondaryText,
      }];
    })
    .slice(0, 5);
}

async function fetchPlaceDetails(apiKey: string, placeId: string, referer?: string) {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "formattedAddress,displayName.text,location",
        ...(referer ? { Referer: referer } : {}),
      },
    },
  );

  const payload = await response.json().catch(() => null) as GooglePlaceDetailsResponse | null;
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Place details failed with HTTP ${response.status}`);
  }

  const latitude = payload?.location?.latitude;
  const longitude = payload?.location?.longitude;
  const formattedAddress = payload?.formattedAddress?.trim() || payload?.displayName?.text?.trim() || "";

  if (!formattedAddress || typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error("Place details response was incomplete");
  }

  return {
    formattedAddress,
    latitude,
    longitude,
  };
}

async function fetchTimezone(apiKey: string, latitude: number, longitude: number, referer?: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const url = new URL("https://maps.googleapis.com/maps/api/timezone/json");
  url.searchParams.set("location", `${latitude},${longitude}`);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    headers: referer ? { Referer: referer } : undefined,
  });
  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null) as GoogleTimezoneResponse | null;
  if (payload?.status !== "OK" || !payload.timeZoneId?.trim()) {
    return null;
  }

  return payload.timeZoneId;
}

export async function placesRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { input?: string } }>("/places/autocomplete", async (request, reply) => {
    const apiKey = getGooglePlacesApiKey();
    if (!apiKey) {
      return reply.status(503).send({ error: "Google Places is not configured on the server." });
    }

    const input = request.query.input?.trim() || "";
    if (input.length < 2) {
      return { data: [] };
    }

    const referer = request.headers.origin?.trim()
      ? `${request.headers.origin.trim().replace(/\/$/, "")}/`
      : request.headers.referer?.trim() || undefined;

    try {
      return {
        data: await fetchPlaceSuggestions(apiKey, input, referer),
      };
    } catch (error) {
      request.log.warn({ error }, "places_autocomplete_failed");
      return reply.status(502).send({ error: "Google Places suggestions are unavailable right now." });
    }
  });

  app.get<{ Params: { placeId: string } }>("/places/:placeId", async (request, reply) => {
    const apiKey = getGooglePlacesApiKey();
    if (!apiKey) {
      return reply.status(503).send({ error: "Google Places is not configured on the server." });
    }

    const placeId = request.params.placeId?.trim();
    if (!placeId) {
      return reply.status(400).send({ error: "placeId is required" });
    }

    const referer = request.headers.origin?.trim()
      ? `${request.headers.origin.trim().replace(/\/$/, "")}/`
      : request.headers.referer?.trim() || undefined;

    try {
      const place = await fetchPlaceDetails(apiKey, placeId, referer);
      const timezone = await fetchTimezone(apiKey, place.latitude, place.longitude, referer);

      return {
        data: {
          ...place,
          timezone,
        },
      };
    } catch (error) {
      request.log.warn({ error, placeId }, "place_details_failed");
      return reply.status(502).send({ error: "Place details are unavailable right now." });
    }
  });
}
