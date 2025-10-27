export const runtime = "nodejs";

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const BASE = process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1";
const KEY = need("OPENAI_API_KEY");

async function createJobViaGenerations(body) {
  const r = await fetch(`${BASE}/video/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}

async function createJobViaResponses(prompt, model, duration, resolution) {
  const r = await fetch(`${BASE}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }]}],
      extra: { task: "video", duration, resolution },
    }),
  });
  return { status: r.status, data: await r.json() };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const prompt = body?.prompt ?? "";
    const model = body?.model ?? "sora-2";
    const duration = Number(body?.duration ?? 8);
    const resolution = body?.resolution ?? "720p";

    let { status, data } = await createJobViaGenerations({ model, prompt, duration, resolution });

    if (status >= 400) {
      const fb = await createJobViaResponses(prompt, model, duration, resolution);
      status = fb.status;
      data = fb.data;
    }

    const id = data?.id || data?.task_id || data?.job_id;
    if (!id) return new Response(JSON.stringify({ error: "create_failed", raw: data }), { status: 502 });

    return new Response(JSON.stringify({ job_id: id }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "server_error", message: String(e?.message || e) }), { status: 500 });
  }
}
