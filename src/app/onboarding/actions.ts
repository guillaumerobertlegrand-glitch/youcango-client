'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import Stripe from 'stripe';


// Initialize Stripe lazily or check for key
const getStripe = () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new Error("STRIPE_SECRET_KEY is not defined");
    }
    return new Stripe(key, {
        apiVersion: '2025-12-15.clover',
        typescript: true,
    });
};


export async function updateProfile(formData: FormData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Not authenticated' };
    }

    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    // Phone will be added later or is optional
    // const phone = formData.get('phone') as string; 

    if (!firstName || !lastName) {
        return { error: 'First name and last name are required' };
    }

    const { error } = await supabase
        .from('profiles')
        .update({
            first_name: firstName,
            last_name: lastName,
            updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

    if (error) {
        console.error('Error updating profile:', error);
        return { error: 'Failed to update profile' };
    }

    revalidatePath('/', 'layout');
    return { success: true };
}

export async function createSetupIntent() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Not authenticated' };
    }

    try {
        const stripe = getStripe();
        const setupIntent = await stripe.setupIntents.create({
            metadata: {
                user_id: user.id,
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return { clientSecret: setupIntent.client_secret };
    } catch (error: any) {
        console.error('CRITICAL: Error creating setup intent:', {
            message: error.message,
            stack: error.stack,
            type: error.type,
            raw: error
        });
        return { error: `Failed to create setup intent: ${error.message || 'Unknown error'}` };
    }
}
