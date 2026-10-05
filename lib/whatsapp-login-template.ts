/** Authentication templates require the code in both body and copy-code URL button. */
export function buildWhatsappAuthenticationOtpParams(code: string) {
  return {
    body: { "1": code },
    buttons: [{ type: "url" as const, parameter: code }],
  };
}
