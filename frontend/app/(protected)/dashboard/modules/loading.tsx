export default function ModulesLoading() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-textMuted">Loading module...</p>
      </div>
    </div>
  );
}
