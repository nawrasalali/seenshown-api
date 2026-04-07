import Fastify from 'fastify';
import cors from '@fastify/cors';
import Anthropic from '@anthropic-ai/sdk';
const anthropic=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
const app=Fastify({logger:true});
await app.register(cors,{origin:true,methods:['GET','POST','OPTIONS'],credentials:true});
const T=['antibiotic_killing_bacteria','antibiotic_resistance','bacterial_colony','blood_glucose','cancer_proliferation','cell_mitosis','enzyme_substrate','epidemic_sir','immune_response','muscle_contraction','natural_selection','neural_signal','osmosis','phagocytosis','predator_prey','vaccine_mechanism','virus_infecting_cell','bystander_effect','collective_panic','echo_chamber','influencer_vs_wordofmouth','ingroup_outgroup','office_secret_leak','peer_pressure','rumour_school','social_movement','social_norm_tipping','trust_collapse','truth_vs_rumour','viral_misinformation'];
const D:Record<string,string>={antibiotic_killing_bacteria:'biology',antibiotic_resistance:'biology',bacterial_colony:'biology',blood_glucose:'biology',cancer_proliferation:'biology',cell_mitosis:'biology',enzyme_substrate:'biology',epidemic_sir:'biology',immune_response:'biology',muscle_contraction:'biology',natural_selection:'biology',neural_signal:'biology',osmosis:'biology',phagocytosis:'biology',predator_prey:'biology',vaccine_mechanism:'biology',virus_infecting_cell:'biology',bystander_effect:'social',collective_panic:'social',echo_chamber:'social',influencer_vs_wordofmouth:'social',ingroup_outgroup:'social',office_secret_leak:'social',peer_pressure:'social',rumour_school:'social',social_movement:'social',social_norm_tipping:'social',trust_collapse:'social',truth_vs_rumour:'social',viral_misinformation:'social'};
const jobs:Record<string,any>={};
app.get('/health',async()=>({status:'ok',service:'seenshown-api',templates:T.length,ts:new Date().toISOString()}));
app.post('/v1/simulate',async(req:any,reply:any)=>{
  const b:any=req.body||{};const q=(b.query||'').trim();
  if(!q||q.length<2)return reply.code(400).send({error:'Query too short'});
  try{
    let id=(b.templateId&&T.includes(b.templateId))?b.templateId:null;
    if(!id){const m=await anthropic.messages.create({model:'claude-sonnet-4-20250514',max_tokens:200,system:'Return ONLY valid JSON.',messages:[{role:'user',content:'Templates:'+T.join(',')+'\nQuery:'+JSON.stringify(q.slice(0,200))+'\nReturn:{"templateId":"<id>"}'}]});try{const p=JSON.parse(m.content[0].text.trim().replace(/```(?:json)?/g,'').trim());id=T.includes(p.templateId)?p.templateId:'virus_infecting_cell';}catch{id='virus_infecting_cell';}}
    const nm=await anthropic.messages.create({model:'claude-sonnet-4-20250514',max_tokens:500,system:'Return ONLY a JSON array.',messages:[{role:'user',content:'Sim:'+id+' Query:'+q.slice(0,80)+' Return:[{"phase":0,"text":"..."},{"phase":1,"text":"..."},{"phase":2,"text":"..."}]'}]});
    let n=[];try{n=JSON.parse(nm.content[0].text.trim().replace(/```(?:json)?/g,'').trim());}catch{}
    return reply.send({templateId:id,confidence:0.9,parameterOverrides:{},narration:n,fallback:false,domain:D[id]||'biology'});
  }catch(err){app.log.error(err);return reply.send({templateId:'virus_infecting_cell',confidence:0.5,parameterOverrides:{},narration:[{phase:0,text:'Watch how this process unfolds.'},{phase:1,text:'Entities interact via causal rules.'},{phase:2,text:'This drives the real-world mechanism.'}],fallback:true,domain:'biology'});}
});
app.post('/v1/query',async(req:any,reply:any)=>{
  const b:any=req.body||{};
  const question=(b.question||'').trim();
  const mode=b.mode==='custom'?'custom':'fast';
  if(!question||question.length<3)return reply.code(400).send({error:'Question too short'});
  if(mode==='fast'){
    try{
      const p='Templates:'+T.map((t,i)=>i+':'+t).join(',')+'\nQuestion:'+JSON.stringify(question.slice(0,300))+'\nReturn JSON:{"templateId":"<id>","matchLabel":"<2-5 words>","domain":"<biology|social|physics|chemistry|neuroscience|finance|climate|immunology>","confidence":0.9,"narration":[{"phase":0,"text":"<45w answering the question>"},{"phase":1,"text":"<45w deeper mechanism>"},{"phase":2,"text":"<45w outcome>"}],"explanation":"<2-3 sentences answering question>","keypoints":[{"icon":"<emoji>","title":"<term>","detail":"<20w>"},{"icon":"<emoji>","title":"<term>","detail":"<20w>"},{"icon":"<emoji>","title":"<term>","detail":"<20w>"}]}';
      const msg=await anthropic.messages.create({model:'claude-sonnet-4-20250514',max_tokens:1200,system:'SeenShown AI: pick best simulation, write narration. Return ONLY valid JSON.',messages:[{role:'user',content:p}]});
      const r=JSON.parse(msg.content[0].text.trim().replace(/```(?:json)?/g,'').trim());
      if(!T.includes(r.templateId))r.templateId='virus_infecting_cell';
      return reply.send({mode:'fast',question,templateId:r.templateId,matchLabel:r.matchLabel||r.templateId,domain:r.domain||D[r.templateId]||'biology',confidence:r.confidence||0.8,narration:r.narration||[],explanation:r.explanation||'',keypoints:r.keypoints||[]});
    }catch(err){app.log.error(err);return reply.send({mode:'fast',question,templateId:'virus_infecting_cell',matchLabel:'Closest match',domain:'biology',confidence:0.4,narration:[{phase:0,text:'Initialising simulation for your question. Particles self-organise into the system.'},{phase:1,text:'Core mechanism in action. Each particle follows field equations from the science.'},{phase:2,text:'This demonstrates causal rules governing this real-world phenomenon.'}],explanation:'Particle Field Biology renders the closest simulation to your question in real time.',keypoints:[{icon:'⚡',title:'Particle Field Biology™',detail:'Field equations, not pre-made animations.'},{icon:'🎯',title:'Causal simulation',detail:'Entities follow rules from real science.'},{icon:'🔬',title:'60fps rendering',detail:'35,000 particles, no download needed.'}],fallback:true});}
  }
  const jobId='job_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
  jobs[jobId]={status:'queued',question,created:Date.now()};
  (async()=>{
    try{
      jobs[jobId].status='processing';
      const p='Create particle simulation for:'+JSON.stringify(question.slice(0,300))+'\nReturn JSON:{"title":"<title>","domain":"<domain>","narration":[{"phase":0,"text":"<50w>"},{"phase":1,"text":"<50w>"},{"phase":2,"text":"<50w>"}],"explanation":"<3 sentences>","keypoints":[{"icon":"<emoji>","title":"<term>","detail":"<20w>"},{"icon":"<emoji>","title":"<term>","detail":"<20w>"},{"icon":"<emoji>","title":"<term>","detail":"<20w>"}],"visualSpec":{"background":"<hex>","primaryColor":"<hex>","secondaryColor":"<hex>","accentColor":"<hex>"},"drawCode":"// Canvas2D. Params:ctx,W,H,t(0-3000),phase(0-2). 25 lines max.\\nconst bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,\'#02040e\');bg.addColorStop(1,\'#040810\');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);"}';
      const msg=await anthropic.messages.create({model:'claude-sonnet-4-20250514',max_tokens:2500,system:'SeenShown simulation designer. Return ONLY valid JSON.',messages:[{role:'user',content:p}]});
      const r=JSON.parse(msg.content[0].text.trim().replace(/```(?:json)?/g,'').trim());
      jobs[jobId]={...jobs[jobId],status:'done',result:{mode:'custom',question,title:r.title||question,domain:r.domain||'biology',narration:r.narration||[],explanation:r.explanation||'',keypoints:r.keypoints||[],visualSpec:r.visualSpec||{},drawCode:r.drawCode||"ctx.fillStyle='#02040e';ctx.fillRect(0,0,W,H);",isCustom:true},completed:Date.now()};
    }catch(err){app.log.error(err);jobs[jobId].status='error';jobs[jobId].error='Generation failed.';}
  })();
  return reply.send({mode:'custom',jobId,status:'queued',message:'Generating your simulation... usually 10-15 seconds.'});
});
app.get('/v1/query/job/:jobId',async(req:any,reply:any)=>{
  const{jobId}=req.params as any;const job=jobs[jobId];
  if(!job)return reply.code(404).send({error:'Job not found'});
  if(job.status==='done')return reply.send({status:'done',result:job.result});
  if(job.status==='error')return reply.send({status:'error',error:job.error});
  return reply.send({status:job.status});
});
app.post('/webhooks/stripe',async(_:any,r:any)=>r.send({received:true}));
app.post('/v1/partner/apply',async(_:any,r:any)=>r.send({success:true}));
app.post('/v1/embed/validate',async(_:any,r:any)=>r.send({valid:true}));
app.post('/v1/checkout',async(_:any,r:any)=>r.code(400).send({error:'Not configured'}));
const port=parseInt(process.env.PORT||'3001');
await app.listen({port,host:'0.0.0.0'});
console.log('SeenShown API on port '+port);
