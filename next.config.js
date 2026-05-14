const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  swcMinify: false,
  images: {
    domains: [],
    unoptimized: true,
  },
  webpack: (config) => {
    const cjsAliases = {
      'motion-dom': 'node_modules/motion-dom/dist/cjs/index.js',
      'motion-utils': 'node_modules/motion-utils/dist/cjs/index.js',
      // Alias the top-level reactflow package to its single UMD bundle.
      // This ensures Background, Controls, etc. all share the SAME zustand
      // store instance. The individual @reactflow/* aliases are no longer
      // needed (and caused duplicate-zustand errors when each UMD had its own).
      'reactflow': 'node_modules/reactflow/dist/umd/index.js',
    }
    for (const [from, to] of Object.entries(cjsAliases)) {
      config.resolve.alias[from] = path.resolve(__dirname, to)
    }
    return config
  },
}

module.exports = nextConfig
