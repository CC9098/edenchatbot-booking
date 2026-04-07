import { buildManageBookingUrl } from '@/lib/public-url';

function normalizeToken(value: string | string[] | null | undefined): string | null {
  const normalized = Array.isArray(value) ? value[0] : value;
  const trimmed = normalized?.trim();
  return trimmed || null;
}

function extractLegacyPlaceholderToken(segment: string | undefined): string | null {
  const normalized = segment?.trim();
  if (!normalized) return null;

  const decoded = decodeURIComponent(normalized);
  const legacyPrefix = '{{1}}';
  if (!decoded.startsWith(legacyPrefix)) {
    return null;
  }

  const token = decoded.slice(legacyPrefix.length).trim();
  return token || null;
}

export function resolveLegacyManageBookingRedirect(params: {
  pathSegments?: string[];
  token?: string | string[] | null;
}): string | null {
  const pathSegments = params.pathSegments || [];
  if (pathSegments.length === 0) {
    return null;
  }

  const tokenFromQuery = normalizeToken(params.token);
  const tokenFromPath = extractLegacyPlaceholderToken(pathSegments[0]);
  const lastSegment = decodeURIComponent(pathSegments[pathSegments.length - 1] || '').trim();

  if (lastSegment === 'manage-booking') {
    return buildManageBookingUrl({
      ...((tokenFromQuery || tokenFromPath) ? { token: tokenFromQuery || tokenFromPath || undefined } : {}),
    });
  }

  if (tokenFromPath) {
    return buildManageBookingUrl({ token: tokenFromPath });
  }

  return null;
}
