// ============================================
// ADDITIONAL API ROUTES
// Add these to server.ts
// ============================================

// POST /v1/embed/validate
// Called by embed.js before rendering an iframe
export async function embedValidateRoute(
  request: any,
  reply: any,
  supabase: any
) {
  const { apiKey, templateId } = request.body as {
    apiKey: string;
    templateId: string;
  };

  if (!apiKey || !templateId) {
    return reply.code(400).send({ error: 'Missing apiKey or templateId' });
  }

  // 'test' key always passes (for smoke tests and demos)
  if (apiKey === 'test') {
    return reply.send({ valid: true, orgName: 'Demo', tier: 'starter' });
  }

  const { data: partner } = await supabase
    .from('partners')
    .select('id, org_name, tier, active, api_calls_this_month, api_calls_limit')
    .eq('api_key', apiKey)
    .single();

  if (!partner || !partner.active) {
    return reply.code(401).send({ valid: false, error: 'Invalid API key' });
  }

  if (partner.api_calls_this_month >= partner.api_calls_limit) {
    return reply.code(429).send({
      valid: false,
      error: 'Monthly API limit reached. Upgrade at partners.seenshown.com',
    });
  }

  // Increment embed view count
  await supabase
    .from('partners')
    .update({ api_calls_this_month: partner.api_calls_this_month + 1 })
    .eq('id', partner.id);

  await supabase.from('api_usage').insert({
    partner_id: partner.id,
    endpoint: '/v1/embed/validate',
    template_id: templateId,
    status_code: 200,
  });

  return reply.send({
    valid: true,
    orgName: partner.org_name,
    tier: partner.tier,
  });
}

// GET /v1/templates
// Returns the full template registry (for partner API consumers)
export async function templatesRoute(request: any, reply: any, supabase: any) {
  const { data } = await supabase
    .from('templates')
    .select('id, domain, title, description, difficulty')
    .eq('active', true)
    .order('domain')
    .order('title');

  return reply.send({ templates: data ?? [] });
}

// POST /v1/partner/apply
// Submit a partner application (stored for manual review)
export async function partnerApplyRoute(
  request: any,
  reply: any,
  supabase: any
) {
  const { orgName, email, useCase, expectedVolume } = request.body as {
    orgName: string;
    email: string;
    useCase: string;
    expectedVolume: string;
  };

  if (!orgName || !email || !useCase) {
    return reply.code(400).send({ error: 'Missing required fields' });
  }

  // Store application for manual review
  const { error } = await supabase.from('partner_applications').insert({
    org_name: orgName,
    contact_email: email,
    use_case: useCase,
    expected_volume: expectedVolume,
    status: 'pending',
  });

  if (error) {
    // Duplicate email
    if (error.code === '23505') {
      return reply.code(409).send({ error: 'Application already submitted for this email' });
    }
    return reply.code(500).send({ error: 'Failed to submit application' });
  }

  return reply.send({ success: true, message: "Application received. We'll be in touch within 2 business days." });
}
