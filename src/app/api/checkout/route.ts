import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '@/lib/config';

export async function POST(req: NextRequest) {
  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.' },
      { status: 500 }
    );
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);

  const { plan } = await req.json() as { plan: 'monthly' | 'yearly' };
  const origin = req.headers.get('origin') || 'http://localhost:3000';

  const priceConfig = plan === 'yearly'
    ? { unit_amount: 4900, recurring: { interval: 'year' as const } }
    : { unit_amount: 499, recurring: { interval: 'month' as const } };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `OmniDoxa Pro (${plan === 'yearly' ? 'Annual' : 'Monthly'})`,
            description: 'Ad-free experience, unlimited stories, custom layout',
          },
          ...priceConfig,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/pricing?success=true&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?canceled=true`,
  });

  return NextResponse.json({ url: session.url });
}
