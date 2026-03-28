import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// Helper to convert the raw Buffer into a readable Hex String (which Paystack expects)
const buf2hex = (buffer: ArrayBuffer) => {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

serve(async (req: Request) => {
  try {
    const signature = req.headers.get('x-paystack-signature');
    const bodyText = await req.text();
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');

    if (!PAYSTACK_SECRET_KEY) {
      console.error("Missing Paystack Secret Key in environment variables");
      return new Response("Server configuration error", { status: 500 });
    }

    // 1. SECURITY CHECK: Use Native Web Crypto API to generate HMAC SHA-512
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(PAYSTACK_SECRET_KEY),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
    const hash = buf2hex(signatureBuffer);

    // If the signatures don't match, it's a hacker trying to fake a payment
    if (hash !== signature) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(bodyText);

    // 2. If the payment was successful
    if (event.event === 'charge.success') {
      const { user_id, plan_type } = event.data.metadata;

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // 3. Upgrade the user's profile
      if (plan_type === 'pro_subscription') {
        await supabaseAdmin.from('profiles').update({ subscription_tier: 'pro' }).eq('id', user_id);
      } 
      else if (plan_type === 'promoted_pin') {
        await supabaseAdmin.from('profiles').update({ is_promoted: true }).eq('id', user_id);
      }
      
      // 4. Log the transaction
      await supabaseAdmin.from('transactions').insert({
        user_id: user_id,
        amount: event.data.amount / 100,
        plan_type: plan_type,
        reference: event.data.reference
      });
    }

    return new Response("Webhook processed successfully", { status: 200 });

  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response("Webhook Error", { status: 400 });
  }
});