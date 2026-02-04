import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { text } = await req.json()
        const apiKey = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY')

        const prompt = `Classe la demande utilisateur dans l'UNE de ces categories :
        - "auto_maintenance" (si ça parle de voiture, garage, vidange, pneus, mécanique)
        - "hairdresser" (si ça parle de cheveux, barbe, coiffeur)
        - "beauty_salon" (si ça parle de massage, soin, épilation, esthétique)
        - "restaurant" (si ça parle de manger, faim, table, restaurant)

        Réponds UNIQUEMENT avec ce format JSON :
        {"category": "le_nom_de_la_categorie", "intent_summary": "Titre court en français"}`

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt + `\nUser: "${text}"` }] }] })
        })

        const responseData = await response.json()
        const resultText = responseData.candidates?.[0]?.content?.parts?.[0]?.text
        const cleanJson = resultText.replace(/```json|```/g, '').trim()

        return new Response(JSON.stringify({ result: JSON.parse(cleanJson) }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        // Fallback : si l'IA échoue, on renvoie une catégorie par défaut au lieu d'une erreur
        return new Response(JSON.stringify({ result: { category: "restaurant", intent_summary: "Recherche" } }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })
    }
})