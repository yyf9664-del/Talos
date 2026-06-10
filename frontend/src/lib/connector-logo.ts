/** Connector brand-logo helpers.
 *
 * Strategy: derive the brand domain from a connector's MCP URL (or an
 * explicit override) and fetch a colour logo from DeBounce's free logo
 * service. The UI falls back to a first-letter colour block when the
 * remote logo is missing or the app is offline.
 */

/** Connectors whose brand domain differs from their MCP host, or that have
 * no URL at all (local stdio connectors). */
const DOMAIN_OVERRIDES: Record<string, string> = {
  github: "github.com",
  bigquery: "google.com",
  wiley: "wiley.com",
  biorxiv: "biorxiv.org",
  "c-trials": "clinicaltrials.gov",
  chembl: "ebi.ac.uk",
  "google-workspace": "google.com",
  ms365: "microsoft.com",
  pubmed: "ncbi.nlm.nih.gov",
};

/** Best-effort registrable domain: keep the last two labels of the host.
 * Handles `mcp.slack.com` → `slack.com`, `mcp.eu.amplitude.com` →
 * `amplitude.com`, `api.fireflies.ai` → `fireflies.ai`, etc. */
function registrableDomain(host: string): string {
  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return host;
  return labels.slice(-2).join(".");
}

/** Resolve the brand domain for a connector, or null if none can be derived. */
export function connectorDomain(id: string, url: string): string | null {
  if (DOMAIN_OVERRIDES[id]) return DOMAIN_OVERRIDES[id];
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return registrableDomain(host) || null;
  } catch {
    return null;
  }
}

/** DeBounce logo URL for a connector (free, no key, monogram fallback). */
export function connectorLogoUrl(id: string, url: string): string | null {
  const domain = connectorDomain(id, url);
  return domain ? `https://logo.debounce.com/${domain}` : null;
}

const FALLBACK_HUES = [210, 260, 330, 20, 150, 190, 280, 40, 100, 0];

/** Deterministic background colour for the first-letter fallback block. */
export function connectorFallbackColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const hue = FALLBACK_HUES[Math.abs(hash) % FALLBACK_HUES.length];
  return `hsl(${hue} 55% 45%)`;
}

/** First display letter for the fallback block. */
export function connectorInitial(name: string, id: string): string {
  const source = name?.trim() || id;
  return source.charAt(0).toUpperCase() || "?";
}
