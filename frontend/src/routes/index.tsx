import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Construction Intelligence Hub" },
      {
        name: "description",
        content:
          "AI-powered construction command center: risk, safety, materials, equipment, workforce, and RAG document intelligence.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  return (
    <>
      <AppShell />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
