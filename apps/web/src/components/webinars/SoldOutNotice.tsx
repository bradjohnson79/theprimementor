export default function SoldOutNotice({ detail }: { detail: string }) {
  return (
    <div
      role="status"
      className="rounded-2xl border-2 border-amber-100 bg-amber-300 px-5 py-5 shadow-[0_0_48px_rgba(251,191,36,0.45)]"
    >
      <p className="text-sm font-bold uppercase tracking-[0.32em] text-slate-950">Sold out</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">Registration is closed</p>
      <p className="mt-1 text-sm font-medium leading-6 text-slate-900">{detail}</p>
    </div>
  );
}
