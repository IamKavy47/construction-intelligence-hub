import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "sonner";
import { getAuthSession } from "@/lib/auth.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Construction Intelligence Hub" },
      {
        name: "description",
        content:
          "AI-powered construction command center: risk, safety, materials, equipment, workforce, and RAG document intelligence.",
      },
      { property: "og:title", content: "Construction Intelligence Hub" },
      {
        property: "og:description",
        content:
          "AI-powered construction command centre for schedule, materials, risk, safety and daily reporting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    const { username } = await getAuthSession();
    if (!username) throw redirect({ to: "/auth" });
    return { username };
  },
  component: IndexPage,
});

function IndexPage() {
  const { username } = Route.useLoaderData();
  return (
    <>
      <AppShell username={username} />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
