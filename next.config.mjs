const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
      "jsonwebtoken",
      "mongodb",
      "bcryptjs",
      "cloudinary",
      "razorpay",
      "twilio",
      "redis",
    ],
  },
};

export default nextConfig;
