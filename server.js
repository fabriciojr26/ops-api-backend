import fastify from 'fastify';
import fetch from 'node-fetch';
import fs from 'fs';
import cors from '@fastify/cors';

const app = fastify({ logger: true });
const PORT = process.env.PORT || 8080;

const FB_PIXEL_ID = process.env.FB_PIXEL_ID || '';
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN || '';
const TEST_EVENT_CODE = process.env.TEST_EVENT_CODE || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-pro';

// System Prompt do Especialista (guardrails)
let SYSTEM_PROMPT = 'Você é o Especialista do Poder Supremo. Sua missão é levar a decisão de compra do e-book em no máximo 6 interações...';
try { SYSTEM_PROMPT = fs.readFileSync('./gemini_system_prompt.txt', 'utf-8'); } catch(e) {}

// CORS liberado (simplificado)
await app.register(cors, {
  origin: (origin, cb) => { cb(null, true); },
  methods: ['GET','POST','OPTIONS']
});

function getIP(req) {
  return (req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip || '').trim();
}

app.get('/healthz', async (_req, reply) => reply.send({ ok: true, ts: Date.now() }));

// === Meta Conversions API proxy ===
app.post('/capi', async (req, reply) => {
  try {
    const { event_name, event_id, payload, user_data, ts, url } = req.body || {};
    if (!FB_PIXEL_ID || !FB_ACCESS_TOKEN) return reply.send({ ok: true, forwarded: false });

    const ip = getIP(req);
    const ua = req.headers['user-agent'] || '';

    const body = {
      data: [{
        event_name,
        event_time: ts || Math.floor(Date.now()/1000),
        event_id,
        action_source: 'website',
        event_source_url: url || '',
        user_data: {
          client_user_agent: ua,
          client_ip_address: ip,
          fbp: user_data?.fbp || undefined,
          fbc: user_data?.fbc || undefined
          // Quando integrar email/telefone via webhook: hash SHA-256 aqui.
        },
        custom_data: payload && payload.custom_data ? payload.custom_data : payload
      }],
      test_event_code: TEST_EVENT_CODE || undefined
    };

    const res = await fetch(`https://graph.facebook.com/v18.0/${FB_PIXEL_ID}/events?access_token=${FB_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(()=>({}));
    return reply.send({ ok: true, forwarded: true, meta: data });
  } catch (e) {
    return reply.status(500).send({ ok: false, error: String(e) });
  }
});

// === Gemini orchestration ===
app.post('/gemini/chat', async (req, reply) => {
  try {
    const { state='IDLE', goal=null, count=0, payload={} } = req.body || {};

    if (!GEMINI_API_KEY) {
      if(state==='IDLE') return reply.send({ message: 'Eu sou o Especialista do Poder Supremo. Em 60s eu te digo se é para você. Qual seu objetivo agora?', buttons: ['Controle emocional','Foco/Hábito','Autoconfiança','Influência/Carreira'], nextState: 'IDLE' });
      if(state==='GOAL_SELECTED') return reply.send({ message: 'Feche os olhos 20s. Respire 4–4–4. Diga: “Eu comando a próxima decisão”. Isso é 1% do método. Quer começar hoje?', buttons: ['Quero meu acesso agora','Tenho uma dúvida'], nextState: 'GOAL_SELECTED' });
      return reply.send({ message: 'Manda a real. O que te segura agora?', buttons: ['Preço','Tempo','Ceticismo','Valores/Religião'], nextState: 'OBJECTION' });
    }

    const input = JSON.stringify({ state, goal, count, payload });
    const gemURL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: SYSTEM_PROMPT + '\nINPUT:' + input }]}],
      generationConfig: { temperature: 0.6, maxOutputTokens: 256 }
    };

    const res = await fetch(gemURL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(()=>({}));
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let out = null; try { out = JSON.parse(text); } catch { out = null; }
    if (!out || typeof out !== 'object') {
      out = state==='IDLE'
        ? { message: 'Eu sou o Especialista do Poder Supremo. Em 60s eu te digo se é para você. Qual seu objetivo agora?', buttons: ['Controle emocional','Foco/Hábito','Autoconfiança','Influência/Carreira'], nextState: 'IDLE' }
        : state==='GOAL_SELECTED'
          ? { message: 'Feche os olhos 20s. Respire 4–4–4. Diga: “Eu comando a próxima decisão”. Isso é 1% do método. Quer começar hoje?', buttons: ['Quero meu acesso agora','Tenho uma dúvida'], nextState: 'GOAL_SELECTED' }
          : { message: 'Manda a real. O que te segura agora?', buttons: ['Preço','Tempo','Ceticismo','Valores/Religião'], nextState: 'OBJECTION' };
    }
    return reply.send(out);
  } catch (e) {
    return reply.status(500).send({ ok: false, error: String(e) });
  }
});

app.post('/webhook', async (_req, reply) => reply.send({ ok: true }));

app.listen({ port: PORT, host: '0.0.0.0' }).then(()=>{
  console.log('API up on :' + PORT);
}).catch(err => { console.error(err); process.exit(1); });
