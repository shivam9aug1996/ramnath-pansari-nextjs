const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
      "jose",
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
