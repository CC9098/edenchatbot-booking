const CHEUNG_DOCTOR_WHATSAPP_FALLBACKS = ['+85260260716', '+85296322476'];

function normalizeDoctorEnvKey(doctorId: string): string {
  return doctorId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function splitWhatsappRecipients(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((phone) => phone.trim())
    .filter(Boolean);
}

function uniqueWhatsappRecipients(recipients: string[]): string[] {
  const seen = new Set<string>();
  const uniqueRecipients: string[] = [];

  for (const recipient of recipients) {
    const dedupeKey = recipient.replace(/[^\d]/g, '');
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    uniqueRecipients.push(recipient);
  }

  return uniqueRecipients;
}

export function getConfiguredDoctorNotificationWhatsapps(doctorId: string): string[] {
  const normalizedRawDoctorId = doctorId.trim().toLowerCase();
  const normalizedDoctorId = normalizeDoctorEnvKey(doctorId);
  const doctorSpecificWhatsapps = splitWhatsappRecipients(
    process.env[`DOCTOR_NOTIFICATION_WHATSAPP_${normalizedDoctorId}`],
  );
  const legacyCheungWhatsapps = normalizedRawDoctorId === 'cheung'
    ? [
        ...splitWhatsappRecipients(process.env.CHEUNG_DOCTOR_WHATSAPP),
        ...CHEUNG_DOCTOR_WHATSAPP_FALLBACKS,
      ]
    : [];
  const clinicNotificationWhatsapps = splitWhatsappRecipients(process.env.CLINIC_NOTIFICATION_WHATSAPP);

  return uniqueWhatsappRecipients([
    ...doctorSpecificWhatsapps,
    ...legacyCheungWhatsapps,
    ...clinicNotificationWhatsapps,
  ]);
}
