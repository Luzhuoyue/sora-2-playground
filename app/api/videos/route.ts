/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/videos/route.ts
export const runtime = "nodejs";

function need(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const BASE = process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1";
const KEY  = need("OPENAI_API_KEY");

// 兼容 302.ai / OpenAI 风格创建接口
async function createJobViaGenerations(body: any) {
  const r = await fetch(`${BASE}/video/generations`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { status: r.status, data: await r.json() };
}

// 有些网关把“创建任务”合并到 /responses
async function createJobViaResponses(prompt: string, model: string, duration: number, resolution: string) {
  const r = await fetch(`${BASE}/responses`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      // 兼容 302.ai 的请求体（把文本塞到 input 里；额外参数进 extra）
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }]}],
      extra: { task: "video", duration, resolution }
    })
  });
  return { status: r.status, data: await r.json() };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt: string = body?.prompt ?? "";
    const model: string = body?.model ?? "sora-2";
    const duration: number = Number(body?.duration ?? 8);
    const resolution: string = body?.resolution ?? "720p";

    // 先走 OpenAI 风格
    let { status, data } = await createJobViaGenerations({ model, prompt, duration, resolution });

    // 404/405/415/400 等则兜底到 /responses
    if (status >= 400) {
      const fallback = await createJobViaResponses(prompt, model, duration, resolution);
      status = fallback.status;
      data = fallback.data;
    }

    // 规范化 job id
    const id = data?.id || data?.task_id || data?.job_id;
    if (!id) {
      return Response.json({ error: "create_failed", raw: data }, { status: 502 });
    }
    return Response.json({ job_id: id });
  } catch (e: any) {
    return Response.json({ error: "server_error", message: String(e?.message || e) }, { status: 500 });
  }
}
