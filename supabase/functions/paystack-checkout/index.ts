import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. Handle CORS preflight requests from React
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, amount, planType, userId } = await req.json();

    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');

    // 2. Ask Paystack to initialize a transaction
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amount * 100, // Paystack calculates in Pesewas (so 100 GHS = 10000 pesewas)
        currency: 'GHS',
        metadata: {
          user_id: userId,
          plan_type: planType, // e.g., 'pro_subscription' or 'promoted_pin'
        }
      })
    });

    const data = await response.json();

    if (!data.status) throw new Error(data.message);

    // 3. Return the Paystack Checkout URL to React
    return new Response(
      JSON.stringify({ checkoutUrl: data.data.authorization_url }), 
      { headers: { 'Content-Type': 'application/json', ...corsHeaders }, status: 200 }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { 'Content-Type': 'application/json', ...corsHeaders }, 
      status: 400 
    });
  }
});