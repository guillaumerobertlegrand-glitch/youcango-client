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

        // 1. Legacy Text Search
        // Docs: https://developers.google.com/maps/documentation/places/web-service/search-text
        const searchRes = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`);
        const searchData = await searchRes.json();

        if (searchData.status !== 'OK' || !searchData.results || searchData.results.length === 0) {
            console.error("Google Legacy API Error/Empty:", searchData);
            return NextResponse.json({
                found: false,
                googleStatus: searchData.status,
                googleError: searchData.error_message || 'No places found'
            });
        }

        const candidate = searchData.results[0]; // Take best match
        const placeId = candidate.place_id;

        // 2. Legacy Place Details
        // Docs: https://developers.google.com/maps/documentation/places/web-service/details
        const detailsRes = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,website,opening_hours,photos,place_id&key=${apiKey}`);
        const detailsData = await detailsRes.json();

        if (detailsData.status !== 'OK' || !detailsData.result) {
            return NextResponse.json({ found: false, googleError: detailsData.error_message });
        }

        const details = detailsData.result;

        // 3. Format Response with Legacy Photo URL
        let photoUrl = null;
        if (details.photos && details.photos.length > 0) {
            const photoRef = details.photos[0].photo_reference;
            // Legacy Photo URL format
            // Use NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for the client-side URL
            photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
        }

        return NextResponse.json({
            found: true,
            place_id: details.place_id,
            name: details.name,
            address: details.formatted_address,
            lat: details.geometry?.location?.lat,
            lng: details.geometry?.location?.lng,
            website: details.website,
            opening_hours: details.opening_hours,
            photoUrl: photoUrl
        });

    } catch (error) {
        console.error("Google Places Error:", error);
        return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 });
    }
}
