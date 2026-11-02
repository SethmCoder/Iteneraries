import type { Metadata } from "next";
import { ExploreWorkspace } from "@/components/explore/explore-workspace";

export const metadata: Metadata = {
  title: "Award Explorer",
  description:
    "Explore award hotels and estimated average flight prices on a world map.",
};

export default function ExplorePage() {
  return <ExploreWorkspace />;
}
