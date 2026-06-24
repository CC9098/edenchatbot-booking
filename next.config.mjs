function decodeJwtPayload(token) {
  const payload = token?.split(".")[1];
  if (!payload) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function validatePublicSupabaseEnv() {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (publicUrl && publicUrl.trim() !== publicUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must not contain leading or trailing whitespace.");
  }

  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const publicKeyRole = decodeJwtPayload(publicKey)?.role;
  if (publicKeyRole && publicKeyRole !== "anon") {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY must be the anon key, not a service role key.");
  }
}

validatePublicSupabaseEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "edenchatbot-booking.vercel.app",
          },
        ],
        destination: "https://app.edenclinic.hk/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
