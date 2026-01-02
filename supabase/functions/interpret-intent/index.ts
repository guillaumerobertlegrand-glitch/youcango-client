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
            
            Format attendu :
            {
                "category": "service" | "merchant",
                "keywords": ["mot1", "mot2"],
                "intent_summary": "résumé court",
                "primary_business_type": "type spécifique"
            }

            Règles :
            - Si le besoin concerne une personne ou un service pro (coiffeur, médecin, plombier), la catégorie est 'service'.
            - Si le besoin concerne un achat de produit physique (pain, fleurs, vêtements), la catégorie est 'merchant'.
            - Réponds UNIQUEMENT avec le JSON, sans explications.`

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
