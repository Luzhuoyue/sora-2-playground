export const runtime = "nodejs";

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const BASE = process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1";
const KEY = need("OPENAI_API_KEY");

const CANDIDATE_PATHS = (id) => [
  `/video/generations/${id}`,
  `/responses/${id}`,
  `/videos/${id}`,
];

function normalize(d) {
  const rawStatus = d?.status || d?.task_status || d?.state || d?.phase;
  const progress = d?.progress ?? d?.percent ?? null;

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

export async function GET(req, context) {
  const id = context?.params?.id;
  try {
    let lastErr = null;

    for (const p of CANDIDATE_PATHS(id)) {
      try {
        const r = await fetch(`${BASE}${p}`, {
          headers: { Authorization: `Bearer ${KEY}` },
        });

        if (r.status === 404 || r.status === 405 || r.status === 415) continue;

        const data = await r.json();

        if (r.status >= 400 || data?.error) {
          lastErr = { status: r.status, data };
          continue;
        }

        return new Response(JSON.stringify(normalize(data)), { headers: { "Content-Type": "application/json" } });
      } catch (e) {
        lastErr = e;
        continue;
      }
    }

    return new Response(JSON.stringify({ error: "poll_failed", detail: String(lastErr) }), { status: 503 });
  } catch (e) {
    return new Response(JSON.stringify({ error: "server_error", message: String(e?.message || e) }), { status: 500 });
  }
}
