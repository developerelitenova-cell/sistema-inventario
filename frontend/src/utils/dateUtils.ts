/**
 * Utilidades para formatear fechas a la zona horaria oficial de Colombia (America/Bogota, UTC-5).
 * Se asegura de interpretar fechas sin timezone como UTC para calcular la hora correcta en Bogotá.
 */

export function ensureUtcIso(dateString: string): string {
  const trimmed = dateString.trim();
  // Si ya termina en Z o tiene offset tipo +00:00 o -05:00
  if (trimmed.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}Z`;
}

export function formatBogotaDateTime(
  dateString: string | Date | null | undefined,
  includeSeconds: boolean = true
): string {
  if (!dateString) return '—';
  try {
    const isoStr = typeof dateString === 'string' ? ensureUtcIso(dateString) : dateString.toISOString();
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(dateString);

    return d.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true,
    });
  } catch {
    return String(dateString);
  }
}

export function formatBogotaDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  try {
    const isoStr = typeof dateString === 'string' ? ensureUtcIso(dateString) : dateString.toISOString();
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(dateString);

    return d.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  } catch {
    return String(dateString);
  }
}

export function formatBogotaTime(dateString: string | null | undefined): string {
  return formatBogotaDateTime(dateString, false);
}
