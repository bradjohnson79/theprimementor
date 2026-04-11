interface EmptyStateProps {
  title: string;
  message?: string;
}

export default function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center text-center">
      <div className="mb-4 text-4xl text-white/20">◇</div>
      <h3 className="text-lg font-medium text-white/60">{title}</h3>
      {message && <p className="mt-1 text-sm text-white/40">{message}</p>}
    </div>
  );
}
