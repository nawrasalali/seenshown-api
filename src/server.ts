import Fastify from 'fastify';
import cors from '@fastify/cors';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const app = Fastify({ logger: true });

await app.register(cors, { origin: true, methods: ['GET', 'POST', 'OPTIONS'], credentials: true });

const TEMPLATES = [
  'antibiotic_killing_bacteria','antibiotic_resistance','bacterial_colony',
  'blood_glucose','cancer_proliferation','cell_mitosis','enzyme_substrate',
  'epidemic_sir','immune_response','muscle_contraction','natural_selection',
  'neural_signal','osmosis','phagocytosis','predator_prey',
  'vaccine_mechanism','virus_infecting_cell','bystander_effect',
  'collective_panic','echo_chamber','influencer_vs_wordofmouth',
  'ingroup_outgroup','office_secret_leak','peer_pressure','rumour_school',
  'social_movement','social_norm_tipping','trust_collapse',
  'truth_vs_rumour','viral_misinformation',
];

const DOMAIN: Record<string,string> = {
  antibiotic_killing_bacteria:'biology',antibiotic_resistance:'biology',
  bacterial_colony:'biology',blood_glucose:'biology',
  cancer_proliferation:'biology',cell_mitosis:'biology',
  enzyme_substrate:'biology',epidemic_sir:'biology',
  immune_response:'biology',muscle_contraction:'biology',
  natural_selection:'biology',neural_signal:'biology',
  osmosis:'biology',phagocytosis:'biology',predator_prey:'biology',
  vaccine_mechanism:'biology',virus_infecting_cell:'biology',
  bystander_effect:'social',collective_panic:'social',
  echo_chamber:'social',influencer_vs_wordofmouth:'social',
  ingroup_outgroup:'social',office_secret_leak:'social',
  peer_pressure:'social',rumour_school:'social',
  social_movement:'social',social_norm_tipping:'social',
  trust_collapse:'social',truth_vs_rumour:'social',viral_misinformation:'social',
};

const jobs: Record<string,any> = {};

app.get('/health', async () => ({ status:'ok', service:'seenshown-api', templates:TEMPLATES.length, ts:new Date().toISOString() }));

app.post('/v1/simulate', async (req,reply) => {
  const body:any = req.body||{};
  const query = (body.query||'').trim();
  if(!query||query.length<2) return reply.code(400).send({error:'Query too short'});
  try {
    let templateId = (body.templateId&&TEMPLATES.includes(body.templateId))?body.templateId:null;
    if(!templateId){
      const msg = await anthropic.messages.create({model:'claude-sonnet-4-20250514',max_tokens:200,system:'Return ONLY valid JSON.',messages:[{role:'user',content:'Templates: '+TEMPLATES.join(',')+"\nQuery: \""+query.slice(0,200)+"\"\nReturn: {\"templateId\":\"<id>\"}"}]});
      const parsed = JSON.parse(msg.content[0].text.trim().replace(/```(?:json)?/g,'').trim());
      templateId = TEMPLATES.includes(parsed.templateId)?parsed.templateId:'virus_infecting_cell';
    }
    const narMsg = await anthropic.messages.create({model:'claude-sonnet-4-20250514',max_tokens:500,system:'Return ONLY a JSON array.',messages:[{role:'user',content:'Simulation: "'+templateId+'". Query: "'+query.slice(0,100)+'". 5 narration hooks tick 0-1600. Return: [{"tick":0,"text":"..."}]'}]});
    const narration = JSON.parse(narMsg.content[0].text.trim().replace(/```(?:json)?/g,'').trim());
    return reply.send({templateId,confidence:0.9,parameterOverrides:{},narration:Array.isArray(narration)?narration:[],fallback:false,domain:DOMAIN[templateId]||'biology'});
  } catch(err){
    app.log.error(err);
    return reply.send({templateId:'virus_infecting_cell',confidence:0.5,parameterOverrides:{},narration:[{tick:0,text:'Watch how this biological process unfolds.'},{tick:800,text:'Entities interact according to causal rules.'},{tick:1600,text:'This mechanism drives the real-world process.'}],fallback:true,domain:'biology'});
  }
});

// /v1/query — FREE TEXT ENGINE
app.post('/v1/query', async (req,reply) => {
  const body:any = req.body||{};
  const question = (body.question||'').trim();
  const mode = body.mode==='custom'?'custom':'fast';
  if(!question||question.length<3) return reply.code(400).send({error:'Question too short'});

  if(mode==='fast'){
    try {
      const msg = await anthropic.messages.create({
        model:'claude-sonnet-4-20250514',max_tokens:1200,
        system:'You are SeenShown\'s AI engine. Pick the best simulation template for any question and write engaging narration. Return ONLY valid JSON, no markdown.',
        messages:[{role:'user',content:`Available simulation templates (pick exactly one id):\n${TEMPLATES.map((t,i)=>i+': '+t).join(', ')}\n\nUser question: "${question.slice(0,300)}"\n\nReturn this exact JSON:\n{\n  "templateId": "<one id from the list>",\n  "matchLabel": "<2-5 word description>",\n  "domain": "<biology|social|chemistry|physics|neuroscience|finance|climate|immunology>",\n  "confidence": <0.0-1.0>,\n  "narration": [\n    {"phase":0,"text":"<45 word narration phase 1 answering the question>"},\n    {"phase":1,"text":"<45 word narration phase 2 deeper mechanism>"},\n    {"phase":2,"text":"<45 word narration phase 3 outcome and significance>"}\n  ],\n  "explanation": "<2-3 sentence scientific explanation>",\n  "keypoints": [\n    {"icon":"<emoji>","title":"<concept>","detail":"<25 word explanation>"},\n    {"icon":"<emoji>","title":"<concept>","detail":"<25 word explanation>"},\n    {"icon":"<emoji>","title":"<concept>","detail":"<25 word explanation>"}\n  ]\n}`}]
      });
      const raw = msg.content[0].text.trim().replace(/```(?:json)?/g,'').trim();
      const result = JSON.parse(raw);
      if(!TEMPLATES.includes(result.templateId)) result.templateId='virus_infecting_cell';
      return reply.send({
        mode:'fast',question,
        templateId:result.templateId,
        matchLabel:result.matchLabel||result.templateId,
        domain:result.domain||DOMAIN[result.templateId]||'biology',
        confidence:result.confidence||0.8,
        narration:result.narration||[],
        explanation:result.explanation||'',
        keypoints:result.keypoints||[],
      });
    } catch(err){
      app.log.error(err);
      return reply.send({mode:'fast',question,templateId:'virus_infecting_cell',matchLabel:'Closest simulation',domain:'biology',confidence:0.4,narration:[{phase:0,text:'Initialising simulation for your question. Watch particles self-organise into the system structure.'},{phase:1,text:'The simulation shows the core mechanism. Each particle follows field equations derived from the underlying science.'},{phase:2,text:'This particle field simulation demonstrates the causal rules governing this real-world phenomenon.'}],explanation:'This shows the closest matching process to your question using Particle Field Biology™.',keypoints:[{icon:'⚡',title:'Particle Field Biology™',detail:'Every simulation is generated from field equations, not pre-made animations.'},{icon:'🎯',title:'Causal simulation',detail:'Entities follow rules derived from real science.'},{icon:'🔬',title:'Real-time rendering',detail:'35,000 particles self-organise in your browser at 60fps.'}],fallback:true});
    }
  }

  // CUSTOM MODE — queue it, return jobId immediately
  const jobId = 'job_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
  jobs[jobId] = {status:'queued',question,created:Date.now()};

  (async()=>{
    try {
      jobs[jobId].status='processing';
      const msg = await anthropic.messages.create({
        model:'claude-sonnet-4-20250514',max_tokens:2500,
        system:'You are SeenShown\'s simulation designer. Create new particle field simulations for any question. Return ONLY valid JSON.',
        messages:[{role:'user',content:`Create a brand new SeenShown particle simulation for: "${question.slice(0,300)}"\n\nThe simulation renders on Canvas 2D with particles, gradient backgrounds, and sine-wave motion.\n\nReturn this exact JSON:\n{\n  "title": "<simulation title>",\n  "domain": "<biology|social|chemistry|physics|neuroscience|finance|climate|immunology>",\n  "narration": [\n    {"phase":0,"text":"<50 word narration phase 1>"},\n    {"phase":1,"text":"<50 word narration phase 2>"},\n    {"phase":2,"text":"<50 word narration phase 3>"}\n  ],\n  "explanation": "<3 sentence scientific explanation>",\n  "keypoints": [\n    {"icon":"<emoji>","title":"<concept>","detail":"<25 word detail>"},\n    {"icon":"<emoji>","title":"<concept>","detail":"<25 word detail>"},\n    {"icon":"<emoji>","title":"<concept>","detail":"<25 word detail>"}\n  ],\n  "visualSpec": {\n    "background": "<dark hex>",\n    "primaryColor": "<hex>",\n    "secondaryColor": "<hex>",\n    "accentColor": "<hex>"\n  },\n  "drawCode": "// Canvas 2D draw function body. Params: ctx,W,H,t(tick 0-3000),phase(0-2). Max 35 lines.\nconst bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#02040e');bg.addColorStop(1,'#04080e');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);\n// YOUR ENTITIES HERE\nconst vg=ctx.createRadialGradient(W/2,H/2,H*.3,W/2,H/2,H*.7);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.5)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);"\n}`}]
      });
      const raw = msg.content[0].text.trim().replace(/```(?:json)?/g,'').trim();
      const result = JSON.parse(raw);
      jobs[jobId]={...jobs[jobId],status:'done',result:{
        mode:'custom',question,
        title:result.title||question,
        domain:result.domain||'biology',
        narration:result.narration||[],
        explanation:result.explanation||'',
        keypoints:result.keypoints||[],
        visualSpec:result.visualSpec||{},
        drawCode:result.drawCode||"ctx.fillStyle='#02040e';ctx.fillRect(0,0,W,H);",
        isCustom:true,
      },completed:Date.now()};
    } catch(err){
      app.log.error(err);
      jobs[jobId].status='error';
      jobs[jobId].error='Generation failed. Please try again.';
    }
  })();

  return reply.send({mode:'custom',jobId,status:'queued',message:'Generating your simulation... usually 10-15 seconds.'});
});

app.get('/v1/query/job/:jobId', async (req,reply) => {
  const {jobId} = req.params as any;
  const job = jobs[jobId];
  if(!job) return reply.code(404).send({error:'Job not found'});
  if(job.status==='done') return reply.send({status:'done',result:job.result});
  if(job.status==='error') return reply.send({status:'error',error:job.error});
  return reply.send({status:job.status});
});

app.post('/webhooks/stripe', async (_req,reply) => reply.send({received:true}));
app.post('/v1/partner/apply', async (_req,reply) => reply.send({success:true}));
app.post('/v1/embed/validate', async (_req,reply) => reply.send({valid:true}));
app.post('/v1/checkout', async (_req,reply) => reply.code(400).send({error:'Not configured'}));

const port = parseInt(process.env.PORT||'3001');
await app.listen({port,host:'0.0.0.0'});
console.log('SeenShown API running on port '+port);
