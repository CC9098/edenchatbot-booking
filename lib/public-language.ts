/** Only the public English site and booking journey currently have English copy. */
export function isEnglishPublicRoute(pathname: string, language?: string | null): boolean {
  if (pathname === "/en" || pathname.startsWith("/en/")) return true;
  return language === "en" && [
    "/booking", "/booking-whatsapp", "/manage-booking", "/manage", "/cancel", "/reschedule",
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
