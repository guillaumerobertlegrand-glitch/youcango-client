
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function login(formData: FormData) {
    const supabase = await createClient();

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.error("Login Error:", error);
        let message = error.message;
        if (message === "Invalid login credentials") {
            message = "Identifiants incorrects. Veuillez vérifier votre email et mot de passe.";
        } else if (message === "Email not confirmed") {
            message = "Veuillez confirmer votre email avant de vous connecter.";
        }
        return redirect(`/login?error=${encodeURIComponent(message)}`);
    }

    revalidatePath("/", "layout");
    redirect("/onboardingpro/step-1-identity");
}

export async function signup(formData: FormData) {
    const supabase = await createClient();

    const rawEmail = formData.get("email") as string;
    const email = rawEmail?.trim();
    const password = formData.get("password") as string;

    // Security: Strict Regex Validation to prevent bounces
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
        console.error("Signup Blocked: Invalid Email Format", { email: rawEmail });
        return redirect(`/login?error=${encodeURIComponent("Adresse email invalide. Veuillez vérifier le format.")}`);
    }

    const emailRedirectTo = `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback`;
    console.log("Signup parameters:", { email, emailRedirectTo });

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo,
        }
    });

    // If we have a session, we are logged in (e.g. auto confirm enabled)
    if (data?.session) {
        revalidatePath("/", "layout");
        return redirect("/onboardingpro/step-1-identity");
    }

    // If we have a user but no session, success but needs confirmation
    if (data?.user) {
        revalidatePath("/", "layout");
        return redirect("/login?message=E-mail envoyé ! Validez-le pour continuer.");
    }

    if (error) {
        console.error("Signup Error:", error);
        let message = error.message;
        if (message === "User already registered") {
            message = "Un compte existe déjà avec cet email.";
        } else if (message === "Password should be at least 6 characters") {
            message = "Le mot de passe doit contenir au moins 6 caractères.";
        }
        return redirect(`/login?error=${encodeURIComponent(message)}`);
    }

    return redirect("/login?error=Erreur inconnue lors de l'inscription");
}

export async function loginWithProvider(provider: "google" | "apple") {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/auth/callback`,
        },
    });

    if (data.url) {
        redirect(data.url);
    }
}

export async function signout() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/login");
}
