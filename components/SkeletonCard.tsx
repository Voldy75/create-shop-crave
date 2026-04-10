export function RecipeSkeleton() {
  return (
    <div className="w-full rounded-2xl p-6 space-y-4 animate-pulse" style={{ background: "var(--cc-surface)", border: "1px solid var(--cc-border)" }}>
      {/* Header */}
      <div className="space-y-2">
        <div className="h-3 w-24 rounded-full" style={{ background: "var(--cc-surface-3)" }} />
        <div className="h-6 w-3/4 rounded-lg" style={{ background: "var(--cc-surface-3)" }} />
        <div className="h-4 w-full rounded-lg" style={{ background: "var(--cc-surface-2)" }} />
        <div className="h-4 w-2/3 rounded-lg" style={{ background: "var(--cc-surface-2)" }} />
      </div>
      {/* Meta chips */}
      <div className="flex gap-2">
        <div className="h-6 w-16 rounded-full" style={{ background: "var(--cc-surface-3)" }} />
        <div className="h-6 w-20 rounded-full" style={{ background: "var(--cc-surface-3)" }} />
        <div className="h-6 w-14 rounded-full" style={{ background: "var(--cc-surface-3)" }} />
      </div>
      {/* Grid */}
      <div className="grid md:grid-cols-2 gap-6 mt-4">
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--cc-surface-2)" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg shrink-0" style={{ background: "var(--cc-surface-3)" }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-3/4 rounded" style={{ background: "var(--cc-surface-3)" }} />
                <div className="h-3 w-1/2 rounded" style={{ background: "var(--cc-surface-3)" }} />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-7 h-7 rounded-full shrink-0" style={{ background: "var(--cc-surface-3)" }} />
              <div className="flex-1 space-y-1.5 pt-0.5">
                <div className="h-3.5 w-full rounded" style={{ background: "var(--cc-surface-2)" }} />
                <div className="h-3.5 w-5/6 rounded" style={{ background: "var(--cc-surface-2)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RestaurantSkeleton() {
  return (
    <div className="w-full rounded-2xl p-6 space-y-4 animate-pulse" style={{ background: "var(--cc-surface)", border: "1px solid var(--cc-border)" }}>
      {/* Header */}
      <div className="space-y-2">
        <div className="h-3 w-20 rounded-full" style={{ background: "var(--cc-surface-3)" }} />
        <div className="h-6 w-2/3 rounded-lg" style={{ background: "var(--cc-surface-3)" }} />
        <div className="h-4 w-1/2 rounded-lg" style={{ background: "var(--cc-surface-2)" }} />
      </div>
      {/* Grid */}
      <div className="grid md:grid-cols-2 gap-6 mt-4">
        <div className="space-y-5">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-[4/3] rounded-xl w-full" style={{ background: "var(--cc-surface-2)" }} />
              <div className="h-4 w-3/4 rounded" style={{ background: "var(--cc-surface-3)" }} />
              <div className="h-3 w-1/2 rounded" style={{ background: "var(--cc-surface-2)" }} />
            </div>
          ))}
        </div>
        <div className="rounded-2xl min-h-[300px]" style={{ background: "var(--cc-surface-2)" }} />
      </div>
    </div>
  );
}
