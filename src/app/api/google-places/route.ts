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

        // 1. Find Place (to get Place ID)
        const findResponse = await fetch(
            `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address&key=${apiKey}`
        );
        const findData = await findResponse.json();

        if (!findData.candidates || findData.candidates.length === 0) {
            return NextResponse.json({ found: false });
        }

        const candidate = findData.candidates[0];
        const placeId = candidate.place_id;

        // 2. Details (to get rich data: geometry, photos, hours, website)
        const detailsResponse = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,website,opening_hours,photos&key=${apiKey}`
        );
        const detailsData = await detailsResponse.json();

        if (!detailsData.result) {
            return NextResponse.json({ found: false });
        }

        const result = detailsData.result;

        // Format Photos
        let photoUrl = null;
        if (result.photos && result.photos.length > 0) {
            const photoRef = result.photos[0].photo_reference;
            // Construct URL (client can fetch or we proxy - for now just ID/ref)
            photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${apiKey}`;
        }

        const payload = {
            found: true,
            place_id: placeId,
            name: result.name,
            address: result.formatted_address,
            lat: result.geometry?.location?.lat,
            lng: result.geometry?.location?.lng,
            website: result.website,
            opening_hours: result.opening_hours,
            photoUrl: photoUrl
        };

        return NextResponse.json(payload);

    } catch (error) {
        console.error("Google Places Error:", error);
        return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 });
    }
}
