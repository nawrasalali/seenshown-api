// ============================================
// STRIPE CHECKOUT ROUTE
// Add to api/src/server.ts or import as module
// ============================================

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

// POST /v1/checkout — create Stripe checkout session
export async function checkoutRoute(request: any, reply: any) {
  const { priceId, userId } = request.body as { priceId: string; userId: string };

  if (!priceId || !userId) {
    return reply.code(400).send({ error: 'Missing priceId or userId' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/account?upgrade=success`,
      cancel_url: `${process.env.APP_URL}?upgrade=cancelled`,
      client_reference_id: userId,
      metadata: { userId },
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 7,
      },
    });

    return reply.send({ sessionId: session.id });
  } catch (err: any) {
    return reply.code(500).send({ error: err.message });
  }
}

// POST /webhooks/stripe — handle subscription events
export async function stripeWebhookRoute(
  request: any,
  reply: any,
  supabase: any
) {
  const sig = request.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      request.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return reply.code(400).send({ error: `Webhook Error: ${err.message}` });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (!userId) break;

      // Determine tier from price ID
      const priceId = subscription.items.data[0]?.price.id;
      const tierMap: Record<string, string> = {
        [process.env.STRIPE_PRO_PRICE_ID!]: 'pro',
        [process.env.STRIPE_TEAM_PRICE_ID!]: 'team',
      };
      const tier = tierMap[priceId] ?? 'free';

      await supabase.from('profiles').update({
        tier,
        stripe_customer_id: subscription.customer as string,
      }).eq('id', userId);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (!userId) break;
      await supabase.from('profiles').update({ tier: 'free' }).eq('id', userId);
      break;
    }

    case 'invoice.payment_failed': {
      // Could send email notification here
      break;
    }
  }

  return reply.send({ received: true });
}
