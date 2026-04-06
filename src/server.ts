import Fastify from 'fastify';
import cors from '@fastify/cors';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const app = Fastify({ logger: true });

await app.register(cors, { origin: true, methods: ['GET','POST','OPTIONS'], credentials: true });

const TEMPLATES = ['antibiotic_killing_bacteria','antibiotic_resistance','bacterial_colony','blood_glucose','cancer_proliferation','cell_mitosis','enzyme_substrate','epidemic_sir','immune_response','muscle_contraction','natural_selection','neural_signal','osmosis','phagocytosis','predator_prey','vaccine_mechanism','virus_infecting_cell','bystander_effect','collective_panic','echo_chamber','influencer_vs_wordofmouth','ingroup_outgroup','office_secret_leak','peer_pressure','rumour_school','social_movement','social_norm_tipping','trust_collapse','truth_vs_rumour','viral_misinformation'];
const DOMAIN = {antibiotic_killing_bacteria:'biology',antibiotic_resistance:'biology',bacterial_colony:'biology',blood_glucose:'biology',cancer_proliferation:'biology',cell_mitosis:'biology',enzyme_substrate:'biology',epidemic_sir:'biology',immune_response:'biology',muscle_contraction:'biology',natural_selection:'biology',neural_signal:'biology',osmosis:'biology',phagocytosis:'biology',predator_prey:'biology',vaccine_mechanism:'biology',virus_infecting_cell:'biology',bystander_effect:'social',collective_panic:'social',echo_chamber:'social',influencer_vs_wordofmouth:'social',ingroup_outgroup:'social',office_secret_leak:'social',peer_pressure:'social',rumour_school:'social',social_movement:'social',social_norm_tipping:'social',trust_collapse:'social',truth_vs_rumour:'social',viral_misinformation:'social'};

app.get('/health', async () => ({ status: 'ok', service: 'seenshown-api', templates: TEMPLATES.length, ts: new Date().toISOString() }));

app.get('/v1/templates', async (req, reply) => {
    const { data } = await supabase.from('templates').select('id,domain,title,description').eq('active', true);
    return reply.send({ templates: data || [] });
});

app.post('/v1/simulate', async (req, reply) => {
    const body = req.body || {};
    const query = (body.query || '').trim();
    if (!query || query.length < 2) return reply.code(400).send({ error: 'Query too short' });
    try {
          let templateId = body.templateId && TEMPLATES.includes(body.templateId) ? body.templateId : null;
          if (!templateId) {
                  const msg = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 200, system: 'Return ONLY valid JSON.', messages: [{ role: 'user', content: 'Templates: ' + TEMPLATES.join(',') + '. Query: "' + query.slice(0,200) + '". Return: {"templateId":"<id>"}' }] });
                  const parsed = JSON.parse(msg.content[0].text.trim().replace(/```(?:json)?/g,'').trim());
                  templateId = TEMPLATES.includes(parsed.templateId) ? parsed.templateId : 'virus_infecting_cell';
          }
          const narMsg = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 500, system: 'Return ONLY a JSON array.', messages: [{ role: 'user', content: 'Simulation: "' + templateId + '". Query: "' + query.slice(0,100) + '". Write 5 narration hooks tick 0-1600. Return: [{"tick":0,"text":"..."}]' }] });
          const narration = JSON.parse(narMsg.content[0].text.trim().replace(/```(?:json)?/g,'').trim());
          return reply.send({ templateId, confidence: 0.9, parameterOverrides: {}, narration: Array.isArray(narration) ? narration : [], fallback: false, domain: DOMAIN[templateId] || 'biology' });
    } catch(err) {
          app.log.error(err);
          return reply.send({ templateId: 'virus_infecting_cell', confidence: 0.5, parameterOverrides: {}, narration: [{tick:0,text:'Watch how this biological process unfolds.'},{tick:600,text:'Observe the entities interacting.'},{tick:1400,text:'This mechanism drives real-world biology.'}], fallback: true, domain: 

              }
                            });

    app.post('/webhooks/stripe', async (req, reply) => reply.send({ received: true }));
        app.post('/v1/partner/apply', async (req, reply) => reply.send({ success: true }));
        app.post('/v1/embed/validate', async (req, reply) => reply.send({ valid: true }));
        app.post('/v1/checkout', async (req, reply) => reply.code(400).send({ error: 'Not configured' }));

    const port = parseInt(process.env.PORT || '3001');
        await app.listen({ port, host: '0.0.0.0' });
        console.log('SeenShown API running on port ' + port);
        
