// Anakin.ai integration. ANAKIN_API is an API key (ask_…); apps are invoked by app-id.
// Set ANAKIN_VAHAN_APP_ID / ANAKIN_CHALLAN_APP_ID / ANAKIN_PRICE_APP_ID to go live.
// Without an app-id, this returns null and callers fall back to bundled mocks — never throws.
const KEY = (process.env.ANAKIN_API ?? "").trim();

export async function anakinRun(appId: string | undefined, inputs: Record<string, unknown>): Promise<any | null> {
  if (!KEY || !appId) return null;
  try {
    const res = await fetch(`https://api.anakin.ai/v1/quickapps/${appId}/runs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        "X-Anakin-Api-Version": "2024-05-06",
      },
      body: JSON.stringify({ inputs, stream: false }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const normReg = (s?: string | null) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
