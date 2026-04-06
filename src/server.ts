/**
 * SeenShown API Server
 * Fastify — production ready
 *
 * Routes:
 *  GET  /health
 *  POST /v1/simulate              (consumer — auth optional)
 *  POST /v1/partner/simulate      (partner API key)
 *  POST /v1/partner/apply         (application submission)
 *  POST /v1/embed/validate        (iframe key check)
 *  GET  /v1/templates             (full template registry)
 *  POST /v1/checkout              (Stripe session)
 *  POST /webhooks/stripe          (Stripe events)
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import rawBody from 'fastify-raw-body';
import Anthropic from '@anthropic-ai/sdk';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ---- Clients ----
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const stripe     = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
const supabase   = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---- App ----
const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  },
});

// Raw body — required for Stripe webhook signature verification
// fastify-raw-body attaches rawBody string to request on routes that opt in
await app.register(rawBody, {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
  runFirst: true,
  routes: [],
});

await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
});

await app.register(rateLimit, {
  global: true,
  max: 120,
  timeWindow: '1 minute',
  keyGenerator: (req) =>
    (req.headers['x-api-key'] as string) ??
    req.headers['x-forwarded-for'] as string ??
    req.ip,
  errorResponseBuilder: () => ({
    error: 'Too many requests',
    retryAfter: 60,
  }),
});

// ---- Template registry (exact IDs matching /templates/ directory) ----
const TEMPLATE_IDS = [
  // Biology
  'antibiotic_killing_bacteria',
  'antibiotic_resistance',
  'bacterial_colony',
  'blood_glucose',
  'cancer_proliferation',
  'cell_mitosis',
  'enzyme_substrate',
  'epidemic_sir',
  'immune_response',
  'muscle_contraction',
  'natural_selection',
  'neural_signal',
  'osmosis',
  'phagocytosis',
  'predator_prey',
  'vaccine_mechanism',
  'virus_infecting_cell',
  // Social
  'bystander_effect',
  'collective_panic',
  'echo_chamber',
  'influencer_vs_wordofmouth',
  'ingroup_outgroup',
  'office_secret_leak',
  'peer_pressure',
  'rumour_school',
  'social_movement',
  'social_norm_tipping',
  'trust_collapse',
  'truth_vs_rumour',
  'viral_misinformation',
] as const;

type TemplateId = typeof TEMPLATE_IDS[number];

const TEMPLATE_DOMAIN: Record<TemplateId, 'biology' | 'social'> = {
  antibiotic_killing_bacteria: 'biology',
  antibiotic_resistance: 'biology',
  bacterial_colony: 'biology',
  blood_glucose: 'biology',
  cancer_proliferation: 'biology',
  cell_mitosis: 'biology',
  enzyme_substrate: 'biology',
  epidemic_sir: 'biology',
  immune_response: 'biology',
  muscle_contraction: 'biology',
  natural_selection: 'biology',
  neural_signal: 'biology',
  osmosis: 'biology',
  phagocytosis: 'biology',
  predator_prey: 'biology',
  vaccine_mechanism: 'biology',
  virus_infecting_cell: 'biology',
  bystander_effect: 'social',
  collective_panic: 'social',
  echo_chamber: 'social',
  influencer_vs_wordofmouth: 'social',
  ingroup_outgroup: 'social',
  office_secret_leak: 'social',
  peer_pressure: 'social',
  rumour_school: 'social',
  social_movement: 'social',
  social_norm_tipping: 'social',
  trust_collapse: 'social',
  truth_vs_rumour: 'social',
  viral_misinformation: 'social',
};

// ---- LLM helpers ----

async function classifyIntent(query: string) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: `You are a simulation router for SeenShown, an educational platform.
Map user queries to simulation templates. Return ONLY valid JSON, no markdown.`,
    messages: [{
      role: 'user',
      content: `Available templates: ${TEMPLATE_IDS.join(', ')}

User query: "${query.slice(0, 300)}"

Return JSON:
{
  "templateId": "<exact id from list>",
  "confidence": <0.0-1.0>,
  "parameterOverrides": {},
  "fallback": false
}

Set fallback:true and confidence<0.6 if no good match exists.`,
    }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}';

  // Strip any accidental markdown fences
  const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const parsed = JSON.parse(clean);
    // Validate templateId is in our list
    if (!TEMPLATE_IDS.includes(parsed.templateId)) {
      parsed.templateId = 'antibiotic_killing_bacteria';
      parsed.confidence = 0.4;
      parsed.fallback = true;
    }
    return parsed;
  } catch {
    return { templateId: 'antibiotic_killing_bacteria', confidence: 0.4, parameterOverrides: {}, fallback: true };
  }
}

async function generateNarration(templateId: string, query: string) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 700,
    system: 'You write narration for educational simulations. Return ONLY a valid JSON array, no markdown.',
    messages: [{
      role: 'user',
      content: `Simulation: "${templateId}" | User asked: "${query.slice(0, 200)}"

Write 5-6 narration hooks. First at tick 0, last at tick 1500+.
Max 28 words per hook. Plain language, age 10+ readable. Causally accurate.

Return JSON array only:
[{"tick": 0, "text": "..."}, ...]`,
    }],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]';
  const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const arr = JSON.parse(clean);
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('empty');
    return arr;
  } catch {
    return [
      { tick: 0,    text: `Watch how ${templateId.replace(/_/g, ' ')} works.` },
      { tick: 600,  text: 'Observe how the entities interact and affect each other.' },
      { tick: 1500, text: 'This is the mechanism that drives this process in the real world.' },
    ];
  }
}

// ---- Auth helpers ----

async function verifyUserToken(authHeader: string): Promise<string | null> {
  try {
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return null;
    const { data: { user } } = await supabase.auth.getUser(token);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function checkAndIncrementUsage(userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, simulations_today, simulations_reset_at')
    .eq('id', userId)
    .single();

  if (!profile) return true;

  const limits: Record<string, number> = { free: 5, pro: 999999, team: 999999 };
  const limit = limits[profile.tier] ?? 5;

  const resetAt = new Date(profile.simulations_reset_at);
  const now     = new Date();
  const shouldReset = now.getTime() - resetAt.getTime() > 86_400_000; // 24h
  const count       = shouldReset ? 0 : profile.simulations_today;

  if (count >= limit) return false;

  await supabase.from('profiles').update({
    simulations_today: count + 1,
    ...(shouldReset && { simulations_reset_at: now.toISOString() }),
  }).eq('id', userId);

  return true;
}

async function verifyPartnerKey(apiKey: string) {
  const { data } = await supabase
    .from('partners')
    .select('id, org_name, tier, active, api_calls_this_month, api_calls_limit')
    .eq('api_key', apiKey)
    .eq('active', true)
    .single();
  return data;
}

// ============================================================
// ROUTES
// ============================================================

// GET /health
app.get('/health', async () => ({
  status: 'ok',
  service: 'seenshown-api',
  templates: TEMPLATE_IDS.length,
  ts: new Date().toISOString(),
}));

// GET /v1/templates
app.get('/v1/templates', async (_req, reply) => {
  const { data } = await supabase
    .from('templates')
    .select('id, domain, title, description, difficulty')
    .eq('active', true)
    .order('domain').order('title');
  return reply.send({ templates: data ?? [] });
});

// POST /v1/simulate  — consumer endpoint (auth optional)
app.post('/v1/simulate', {
  config: { rateLimit: { max: 25, timeWindow: '1 minute' } },
}, async (req, reply) => {
  const body = req.body as { query?: string; domain?: string; templateId?: string };
  const query = body?.query?.trim() ?? '';

  if (!query || query.length < 3) {
    return reply.code(400).send({ error: 'Query must be at least 3 characters' });
  }

  // Optional auth — enforce usage limits for logged-in free users
  const userId = req.headers.authorization
    ? await verifyUserToken(req.headers.authorization as string)
    : null;

  if (userId) {
    const ok = await checkAndIncrementUsage(userId);
    if (!ok) {
      return reply.code(429).send({
        error: 'daily_limit_reached',
        message: 'Daily simulation limit reached. Upgrade to Pro for unlimited simulations.',
        upgradeUrl: 'https://app.seenshown.com',
      });
    }
  }

  try {
    const intent = body.templateId && TEMPLATE_IDS.includes(body.templateId as TemplateId)
      ? { templateId: body.templateId, confidence: 1.0, parameterOverrides: {}, fallback: false }
      : await classifyIntent(query);

    if (intent.fallback && intent.confidence < 0.5) {
      return reply.code(422).send({
        error: 'query_not_matched',
        message: `No simulation found for that. Did you mean: "${intent.templateId.replace(/_/g, ' ')}"?`,
        suggestion: intent.templateId,
      });
    }

    const [narration] = await Promise.all([
      generateNarration(intent.templateId, query),
      userId
        ? supabase.from('simulations').insert({
            user_id: userId,
            template_id: intent.templateId,
            query_input: query.slice(0, 500),
            parameters: intent.parameterOverrides,
            domain: TEMPLATE_DOMAIN[intent.templateId as TemplateId] ?? body.domain ?? 'biology',
          })
        : Promise.resolve(),
    ]);

    return reply.send({
      templateId: intent.templateId,
      confidence: intent.confidence,
      parameterOverrides: intent.parameterOverrides,
      narration,
      fallback: intent.fallback,
      domain: TEMPLATE_DOMAIN[intent.templateId as TemplateId],
    });

  } catch (err: any) {
    app.log.error({ err, query }, 'simulate failed');
    return reply.code(500).send({ error: 'Simulation generation failed. Please try again.' });
  }
});

// POST /v1/partner/simulate
app.post('/v1/partner/simulate', {
  config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
}, async (req, reply) => {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) return reply.code(401).send({ error: 'Missing x-api-key header' });

  const partner = await verifyPartnerKey(apiKey);
  if (!partner) return reply.code(401).send({ error: 'Invalid API key' });

  if (partner.api_calls_this_month >= partner.api_calls_limit) {
    return reply.code(429).send({
      error: 'Monthly API limit reached. Upgrade at partners.seenshown.com',
    });
  }

  const body  = req.body as { query?: string; templateId?: string };
  const query = body?.query?.trim() ?? '';

  const intent = body.templateId && TEMPLATE_IDS.includes(body.templateId as TemplateId)
    ? { templateId: body.templateId, confidence: 1.0, parameterOverrides: {}, fallback: false }
    : await classifyIntent(query || (body.templateId ?? ''));

  const narration = await generateNarration(intent.templateId, query || intent.templateId);

  // Async — don't block response
  Promise.all([
    supabase.from('partners').update({
      api_calls_this_month: partner.api_calls_this_month + 1,
    }).eq('id', partner.id),
    supabase.from('api_usage').insert({
      partner_id: partner.id,
      endpoint: '/v1/partner/simulate',
      template_id: intent.templateId,
      status_code: 200,
    }),
  ]).catch(app.log.error);

  return reply.send({
    templateId: intent.templateId,
    confidence: intent.confidence,
    narration,
    domain: TEMPLATE_DOMAIN[intent.templateId as TemplateId],
  });
});

// POST /v1/partner/apply
app.post('/v1/partner/apply', {
  config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
}, async (req, reply) => {
  const { orgName, email, useCase, expectedVolume } = req.body as {
    orgName?: string;
    email?: string;
    useCase?: string;
    expectedVolume?: string;
  };

  if (!orgName?.trim() || !email?.trim() || !useCase?.trim()) {
    return reply.code(400).send({ error: 'orgName, email, and useCase are required' });
  }

  const { error } = await supabase.from('partner_applications').insert({
    org_name:        orgName.trim(),
    contact_email:   email.trim().toLowerCase(),
    use_case:        useCase.trim(),
    expected_volume: expectedVolume ?? 'unknown',
    status:          'pending',
  });

  if (error) {
    if (error.code === '23505') {
      return reply.code(409).send({ error: 'Application already submitted for this email address' });
    }
    app.log.error(error, 'partner apply failed');
    return reply.code(500).send({ error: 'Failed to submit application' });
  }

  return reply.send({
    success: true,
    message: "Application received. We'll be in touch within 2 business days.",
  });
});

// POST /v1/embed/validate
app.post('/v1/embed/validate', {
  config: { rateLimit: { max: 200, timeWindow: '1 minute' } },
}, async (req, reply) => {
  const { apiKey, templateId } = req.body as { apiKey?: string; templateId?: string };

  if (!apiKey || !templateId) {
    return reply.code(400).send({ valid: false, error: 'Missing apiKey or templateId' });
  }

  // Test key — always valid (for smoke tests, demos, docs)
  if (apiKey === 'test') {
    return reply.send({ valid: true, orgName: 'Demo', tier: 'starter' });
  }

  const partner = await verifyPartnerKey(apiKey);

  if (!partner) {
    return reply.code(401).send({ valid: false, error: 'Invalid API key' });
  }

  if (partner.api_calls_this_month >= partner.api_calls_limit) {
    return reply.code(429).send({
      valid: false,
      error: 'Monthly embed limit reached. Upgrade at partners.seenshown.com',
    });
  }

  // Async increment
  Promise.all([
    supabase.from('partners').update({
      api_calls_this_month: partner.api_calls_this_month + 1,
    }).eq('id', partner.id),
    supabase.from('api_usage').insert({
      partner_id:  partner.id,
      endpoint:    '/v1/embed/validate',
      template_id: templateId,
      status_code: 200,
    }),
  ]).catch(app.log.error);

  return reply.send({ valid: true, orgName: partner.org_name, tier: partner.tier });
});

// POST /v1/checkout — Stripe checkout session
app.post('/v1/checkout', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
}, async (req, reply) => {
  const { priceId, userId } = req.body as { priceId?: string; userId?: string };

  if (!priceId || !userId) {
    return reply.code(400).send({ error: 'Missing priceId or userId' });
  }

  const validPrices = [
    process.env.STRIPE_PRO_PRICE_ID,
    process.env.STRIPE_TEAM_PRICE_ID,
  ].filter(Boolean);

  if (!validPrices.includes(priceId)) {
    return reply.code(400).send({ error: 'Invalid price ID' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL}/account?upgrade=success`,
      cancel_url:  `${process.env.APP_URL}?upgrade=cancelled`,
      client_reference_id: userId,
      metadata: { userId },
      allow_promotion_codes: true,
      subscription_data: { trial_period_days: 7 },
    });

    return reply.send({ sessionId: session.id });
  } catch (err: any) {
    app.log.error(err, 'checkout failed');
    return reply.code(500).send({ error: err.message });
  }
});

// POST /webhooks/stripe — subscription lifecycle events
app.post('/webhooks/stripe', {
  config: { rawBody: true },
}, async (req, reply) => {
  const sig = req.headers['stripe-signature'] as string;
  const raw = (req as any).rawBody as string;

  if (!sig || !raw) {
    return reply.code(400).send({ error: 'Missing stripe-signature or body' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    app.log.warn({ err }, 'Stripe webhook signature verification failed');
    return reply.code(400).send({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub    = event.data.object as Stripe.Subscription;
        const uid    = sub.metadata?.userId;
        if (!uid) break;

        const priceId = sub.items.data[0]?.price.id ?? '';
        const tier    =
          priceId === process.env.STRIPE_TEAM_PRICE_ID ? 'team' :
          priceId === process.env.STRIPE_PRO_PRICE_ID  ? 'pro'  : 'free';

        await supabase.from('profiles').update({
          tier,
          stripe_customer_id: sub.customer as string,
        }).eq('id', uid);

        app.log.info({ uid, tier }, 'subscription updated');
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const uid = sub.metadata?.userId;
        if (!uid) break;
        await supabase.from('profiles').update({ tier: 'free' }).eq('id', uid);
        app.log.info({ uid }, 'subscription cancelled → free');
        break;
      }

      case 'invoice.payment_failed': {
        // Could trigger email notification via Resend/Postmark
        const inv = event.data.object as Stripe.Invoice;
        app.log.warn({ customer: inv.customer }, 'payment failed');
        break;
      }
    }
  } catch (err) {
    app.log.error({ err, eventType: event.type }, 'webhook handler error');
    // Return 200 anyway — Stripe retries on non-200
  }

  return reply.send({ received: true });
});

// ============================================================
// START
// ============================================================

const port = parseInt(process.env.PORT ?? '3001', 10);

try {
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`SeenShown API → http://0.0.0.0:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
