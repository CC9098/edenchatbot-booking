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
