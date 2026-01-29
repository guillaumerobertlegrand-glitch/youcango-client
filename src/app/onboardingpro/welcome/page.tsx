"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function WelcomePage() {
    const router = useRouter();
    const supabase = createClient();
    const [name, setName] = useState<string>("");
    const [orgName, setOrgName] = useState<string>("");

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Get Profile and Org
                const { data: pro } = await supabase
                    .from('professionals')
                    .select('first_name, organizations(name)')
                    .eq('user_id', user.id)
                    .single();

                if (pro) {
                    setName(pro.first_name || "");
                    // @ts-ignore
                    const org = Array.isArray(pro.organizations) ? pro.organizations[0] : pro.organizations;
                    setOrgName(org?.name || "votre établissement");
                }
            }
        };
        fetchData();

        const timer = setTimeout(() => {
            router.push("/pro/active-session");
        }, 4000);

        return () => clearTimeout(timer);
    }, [router, supabase]);

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-[#F5F5F7] p-6 font-sans">
            <div className="max-w-[400px] w-full text-center animate-in fade-in zoom-in duration-700">
                <h1 className="text-[28px] font-medium text-gray-900 tracking-tight leading-relaxed">
                    Bonjour {name}.<br />
                    Bienvenue dans l'espace équipe de {orgName}.
                </h1>
            </div>
        </div>
    );
}
