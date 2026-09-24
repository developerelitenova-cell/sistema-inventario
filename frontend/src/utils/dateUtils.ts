/**
 * Formatea una fecha ISO a la zona horaria de Colombia (Bogotá),
 * asegurándose de que el navegador la trate como UTC si no viene con offset.
 */
export function formatBogotaTime(dateString: string | null | undefined): string {
    if (!dateString) return '—';
    
    // Si la fecha que envía el backend es naive (sin 'Z'), la forzamos a UTC
    const utcString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
    
    return new Date(utcString).toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}
