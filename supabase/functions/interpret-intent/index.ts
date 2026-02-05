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

        const prompt = `Tu es l'expert en classification de YouCanGo. Ton rôle est de mapper le besoin utilisateur sur la structure exacte de la base de données.

MISSIONS DE CLASSIFICATION :

1. Identifie le "business_type" (Grand groupe) :
   - "merchant" : Pour tout achat de PRODUIT PHYSIQUE (objet, nourriture, fleurs, etc.).
   - "service" : Pour toute PRESTATION ou CONSOMMATION sur place (incluant restaurants, coiffeurs, garages).

2. Identifie la "category" exacte selon les tiroirs ci-dessous :

--- SECTION SERVICES (Prestations) ---
- "auto_maintenance" (business_type: "service")
  Ex: voiture, garage, vidange, pneus, Scenic, révision, carrosserie, contrôle technique.
- "hairdresser" (business_type: "service")
  Ex: cheveux, coupe, coiffeur, dégradé, barbe, brushing, coloration.
- "beauty_salon" (business_type: "service")
  Ex: massage, soin du visage, épilation, esthétique, spa, manucure.
- "restaurant" (business_type: "service")
  Ex: faim, manger, table, déjeuner, dîner, pizza, snack, brasserie, bar.

--- SECTION MARCHANDS (Produits Physiques) ---
- "bakery" (business_type: "merchant")
  Ex: pain, baguette, croissant, boulangerie, pâtisserie.
- "pharmacy" (business_type: "merchant")
  Ex: doliprane, médicaments, santé, pharmacie, ordonnance, soin.
- "supermarket" (business_type: "merchant")
  Ex: carrefour, courses, supermarché, alimentation générale.
- "grocery store" (business_type: "merchant")
  Ex: épicerie, tomates, fruits, légumes, café, produits frais.
- "florist" (business_type: "merchant")
  Ex: fleurs, bouquet, plantes, fleuriste, offrir.
- "bookstore" (business_type: "merchant")
  Ex: livre, bouquin, librairie, journal, magazine, papeterie.

RÈGLES DE RÉPONSE :
- Analyse le besoin réel : "tomates" -> merchant/grocery store, "vidange" -> service/auto_maintenance.
- Keywords : Extraits les 2 mots-clés essentiels en FRANÇAIS et ANGLAIS.
- Réponds UNIQUEMENT en JSON :
{
  "business_type": "string",
  "category": "string",
  "keywords": ["mot1", "mot2"],
  "intent_summary": "Résumé court en français"
}`;

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