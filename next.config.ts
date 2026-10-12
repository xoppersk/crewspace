import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Crewspace front end (fixture phase): plain Next config.
     The previous build's Tailwind Turbopack CSS rule and cache-component
     flags were removed with the old src tree — the new build uses plain
     CSS variables only, per the design handover. */
};

export default nextConfig;
