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

        const prompt = `Tu es l'intelligence artificielle de YouCanGo, une application de disponibilité en temps réel.
            L'utilisateur dit : "${text}"
            Interprète son besoin et extrais les informations structurées au format JSON uniquement.
            
            Catégories autorisées (choisis la plus proche) :
            - "bakery" (pain, viennoiserie, pâtisserie)
            - "restaurant" (manger, déjeuner, dîner)
            - "hairdresser" (coiffeur, coupe, barbe)
            - "beauty_salon" (soin, esthétique, massage)
            - "grocery" (courses, supermarché, alimentation)
            - "electronics" (réparation, téléphone, informatique)

            Analyse temporelle :
            - Si l'utilisateur utilise des termes comme "ce soir", "demain", "mardi prochain", "à 20h", c'est un besoin différé.
            - Si l'utilisateur dit "maintenant", "tout de suite" ou ne précise rien, c'est un besoin immédiat.

            Format attendu :
            {
                "category": "service" | "merchant",
                "extracted_category": "une des catégories autorisées ci-dessus",
                "keywords": ["english_term1", "english_term2"],
                "intent_summary": "résumé court inclus le moment si précisé",
                "primary_business_type": "type spécifique",
                "intent_mode": "immediacy" | "delayed",
                "scheduled_at": "ISO_DATE_STRING" | null
            }

            Règles :
            - Si le besoin concerne une mise à disposition de temps ou d'espace (coiffeur, restaurant/table, médecin, garage), la catégorie est 'service'.
            - Si le besoin concerne un achat de produit physique à emporter (boulangerie, fleurs, vêtements), la catégorie est 'merchant'.
            - IMPORTANT : Traduis TOUJOURS les 'keywords' en Anglais (ex: 'coiffeur' -> 'barber', 'haircut'). La recherche database se fait en anglais.
            - Pour "scheduled_at", convertis l'expression temporelle relative (ex: "ce soir") en une date future approximative ISO 8601. Nous sommes le ${new Date().toISOString()}.
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
