// app/api/videos/[id]/route.ts
export const runtime = "nodejs";

function need(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const BASE = process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1";
const KEY  = need("OPENAI_API_KEY");

// 尝试多种候选查询路径，兼容不同网关实现
const CANDIDATE_PATHS = (id: string) => [
  `/video/generations/${id}`, // OpenAI 风格
  `/responses/${id}`,         // 一些网关把任务状态也挂在 /responses/{id}
  `/videos/${id}`             // 个别网关的自定义路径
];

// 把不同返回字段，统一成前端识别的结构
function normalize(d: any) {
  // 可能的状态字段
  const rawStatus = d?.status || d?.task_status || d?.state || d?.phase;
  const progress  = d?.progress ?? d?.percent ?? null;

  // 可能的结果 url 字段
  const url =
    d?.output?.url ||
    d?.result?.url ||
    d?.data?.url ||
    d?.video?.url ||
    null;

  const thumbnail =
    d?.output?.thumbnail ||
    d?.result?.thumbnail ||
    d?.data?.thumbnail ||
    null;

  const error = d?.error || d?.message || null;

  let status = rawStatus;
  if (!status && url) status = "succeeded";

  return { status, progress, url, thumbnail, error, raw: d };
}

export async function GET(_: Request, { params }: { params: { id: string }}) {
  const id = params.id;
  try {
    let lastErr: any = null;

    for (const p of CANDIDATE_PATHS(id)) {
      try {
        const r = await fetch(`${BASE}${p}`, {
          headers: { "Authorization": `Bearer ${KEY}` }
        });

        // 404/405/415 等认为该路径不支持，换下一个
        if (r.status === 404 || r.status === 405 || r.status === 415) continue;

        const data = await r.json();

        // 有些网关 200 里也返回错误体
        if (r.status >= 400 || data?.error) {
          lastErr = { status: r.status, data };
          continue;
        }

        return Response.json(normalize(data));
      } catch (e) {
        lastErr = e;
        continue;
      }
    }

    // 所有候选都失败
    return Response.json({ error: "poll_failed", detail: String(lastErr) }, { status: 503 });
  } catch (e: any) {
    return Response.json({ error: "server_error", message: String(e?.message || e) }, { status: 500 });
  }
}
