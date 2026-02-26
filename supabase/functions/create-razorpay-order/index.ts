import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Initialize Razorpay headers since we don't have the SDK in Edge runtime directly
const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { amount, currency = 'INR', receipt } = await req.json()

        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
            throw new Error("Razorpay credentials are not set in the environment variables.")
        }

        // Call Razorpay API to create an order
        const authString = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

        console.log(`Creating order for amount: ${amount} ${currency}`)

        const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: Math.round(amount), // must be in smallest currency unit (paise)
                currency,
                receipt,
                payment_capture: 1
            })
        })

        const orderData = await razorpayResponse.json()

        if (!razorpayResponse.ok) {
            console.error("Razorpay Error:", orderData)
            throw new Error(orderData.error?.description || "Failed to create order")
        }

        return new Response(
            JSON.stringify(orderData),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )
    } catch (error) {
        console.error("Error defining order:", error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        )
    }
})
