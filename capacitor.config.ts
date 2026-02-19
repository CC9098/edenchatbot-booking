import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cc9098.edenchatbotbooking",
  appName: "Eden Booking",
  webDir: "public",
  server: {
    url: "https://edenchatbot-booking.vercel.app/",
    iosScheme: "https",
  },
};

export default config;
