import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="bg-card border border-border shadow-sm rounded-[1.5rem] p-6 sm:p-8">
        <p className="text-xs font-bold tracking-widest text-primary uppercase mb-2 font-sans">About</p>
        <h1 className="mb-3 text-4xl font-bold text-foreground sm:text-5xl font-serif tracking-tight">
          A small starter with room to grow.
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-muted-foreground font-sans">
          TanStack Start gives you type-safe routing, server functions, and
          modern SSR defaults. Use this as a clean foundation, then layer in
          your own routes, styling, and add-ons.
        </p>
      </section>
    </main>
  )
}
