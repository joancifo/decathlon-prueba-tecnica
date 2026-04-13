type PageCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageCard({ children, className = "" }: PageCardProps) {
  return (
    <div
      className={`rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200/50 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
