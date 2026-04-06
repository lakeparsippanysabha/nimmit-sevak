export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-8 border-t border-border px-4 py-8 text-center text-sm font-medium text-muted-foreground font-sans">
      &copy; {year} Nimit Sevak Application. All rights reserved.
    </footer>
  );
}
