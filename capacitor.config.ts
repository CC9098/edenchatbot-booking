import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cc9098.edenchatbotbooking",
  appName: "醫天圓",
  webDir: "public",
  server: {
    url: "https://edenchatbot-booking.vercel.app/chat",
    iosScheme: "https",
  },
};

export default config;
