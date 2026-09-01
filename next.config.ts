import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@neo4j-labs/agent-memory"],
};

export default withEve(nextConfig);
