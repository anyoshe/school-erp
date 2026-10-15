export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      <div className="h-8 w-48 rounded-lg bg-stone-200" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-stone-100 border border-stone-200" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-stone-100 border border-stone-200" />
    </div>
  );
}
