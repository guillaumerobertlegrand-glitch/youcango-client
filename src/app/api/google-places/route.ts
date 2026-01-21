import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { query } = await req.json();

        if (!query) {
            return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_PLACES_API_KEY;
        if (!apiKey) {
            console.error("Missing GOOGLE_PLACES_API_KEY");
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // 1. Text Search (New V1 API)
        // Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
        const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.name,places.displayName,places.formattedAddress,places.id'
            },
            body: JSON.stringify({ textQuery: query })
        });

        const searchData = await searchRes.json();

        if (!searchData.places || searchData.places.length === 0) {
            console.error("Google New API Error/Empty:", searchData);
            return NextResponse.json({
                found: false,
                googleStatus: searchRes.status,
                googleError: searchData.error?.message || 'No places found'
            });
        }

        const candidate = searchData.places[0]; // Take best match
        const placeId = candidate.name.split('/').pop(); // "places/ChIJ..." -> "ChIJ..." 

        // 2. Place Details (New V1 API)
        // Docs: https://developers.google.com/maps/documentation/places/web-service/place-details
        const detailsRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,websiteUri,regularOpeningHours,photos'
            }
        });

        const detailsData = await detailsRes.json();

        if (detailsData.error) {
            return NextResponse.json({ found: false, googleError: detailsData.error.message });
        }

        // 3. Format Response
        let photoUrl = null;
        if (detailsData.photos && detailsData.photos.length > 0) {
            const photoName = detailsData.photos[0].name; // "places/{placeId}/photos/{photoId}"
            // Use the media endpoint to get the image
            // We return the direct Google URL that the frontend can use or a proxy URL.
            // Google V1 Media URL format:
            photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&maxWidthPx=400&key=${apiKey}`;
        }

        // 4. Adapt to Frontend Expectation
        // Frontend expects: { found: true, place_id, name, address, lat, lng, website, opening_hours, photoUrl }

        return NextResponse.json({
            found: true,
            place_id: detailsData.id,
            name: detailsData.displayName?.text,
            address: detailsData.formattedAddress,
            lat: detailsData.location?.latitude,
            lng: detailsData.location?.longitude,
            website: detailsData.websiteUri,
            opening_hours: detailsData.regularOpeningHours, // Note: Structure might differ from Legacy (periods vs openNow). Frontend might need adjustment if it parses hours strictly.
            photoUrl: photoUrl
        });

    } catch (error) {
        console.error("Google Places Error:", error);
        return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 });
    }
}
