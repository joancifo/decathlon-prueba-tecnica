type PageShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <main
      className={`min-h-screen bg-zinc-50 p-6 text-zinc-950 ${className}`.trim()}
    >
      {children}
    </main>
  );
}
