"use client";

import { useSearchParams } from "next/navigation";
import { Link } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthCodeError() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error");

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <h1 className="text-xl font-bold text-red-600 mb-4">Erreur d'authentification</h1>
            <p className="text-gray-600 mb-6">Le lien semble invalide ou a expiré.</p>
            <p className="font-mono text-sm bg-gray-100 p-2 rounded mb-6">{error}</p>
            <a href="/login"><Button>Retour à la connexion</Button></a>
        </div>
    );
}
