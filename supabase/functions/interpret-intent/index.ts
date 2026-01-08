import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { text } = await req.json()
        const apiKey = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY')
        if (!apiKey) {
            throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY')
        }

        const now = new Date();
        const prompt = `Tu es l'intelligence artificielle de YouCanGo, une application de disponibilité en temps réel.
            Date/Heure actuelle (ISO) : "${now.toISOString()}"
            L'utilisateur dit : "${text}"
            Interprète son besoin et extrais les informations structurées au format JSON uniquement.
            
            Catégories autorisées (choisis la plus proche) :
            - "bakery" (pain, viennoiserie, pâtisserie)
            - "restaurant" (manger, déjeuner, dîner)
            - "hairdresser" (coiffeur, coupe, barbe)
            - "beauty_salon" (soin, esthétique, massage)
            - "florist" (fleurs, bouquet, plante, rose, composition)
            - "grocery" (courses, supermarché, alimentation - HORS FLEURS)

            Analyse temporelle et Mode :
            - "merchant" (achat produit) : PEUT être "delayed" (différé) si une heure future est précisée ET qu'elle est dans PLUS DE 15 MINUTES (ex: "dans 30 min", "à 18h").
            - Si l'heure précisée est PROCHE (< 15 min), c'est "immediacy".
            - "service" (prestation temps/espace) : DOIT TOUJOURS être "immediacy" (immédiat), même si l'utilisateur mentionne le futur.
            
            Règles :
            - Si le besoin concerne une mise à disposition de temps ou d'espace (coiffeur, restaurant/table, médecin, garage), la catégorie est 'service'.
            - Si le besoin concerne un achat de produit physique à emporter (boulangerie, fleurs, vêtements, gâteau), la catégorie est 'merchant'.
            - IMPORTANT : Traduis TOUJOURS les 'keywords' en Anglais (ex: 'coiffeur' -> 'barber', 'haircut'). La recherche database se fait en anglais.
            - Pour "merchant" SEULEMENT : 
                - Si date future > 15 min : intent_mode="delayed" et calcul "scheduled_at" (ISO 8601).
                - Si date future <= 15 min : intent_mode="immediacy".
            - Pour "service" : Force TOUJOURS intent_mode="immediacy". Si l'utilisateur a demandé une date future, ajoute "(Note: Service is Real-Time Only)" dans le intent_summary.
            - Réponds UNIQUEMENT with le JSON, sans explications.`

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 1024,
                }
            })
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(`Google API error: ${JSON.stringify(errorData)}`)
        }

        const responseData = await response.json()
        const resultText = responseData.candidates?.[0]?.content?.parts?.[0]?.text

        if (!resultText) {
            throw new Error('Empty response from Gemini')
        }

        const data = JSON.parse(resultText.replace(/```json/g, '').replace(/```/g, '').trim())

        return new Response(
            JSON.stringify({ result: data }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error) {
        console.error('[AI ERROR]:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400
            }
        )
    }
})
