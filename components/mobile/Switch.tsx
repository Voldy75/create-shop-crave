/**
 * Token-only toggle switch.
 *
 * meshi-b ships no switch component, but three artboards (2c, 7c) draw the
 * same pill-and-knob. This reproduces it once rather than inlining the same
 * ~10 style props at each call site.
 *
 * Presentational only — the caller owns the state and puts this inside its
 * own <button>, so there is no nested-interactive markup.
 */
export function Switch({ on }: { on: boolean }) {
  return (
    <span
      role="presentation"
      style={{
        width: 50,
        height: 30,
        borderRadius: 99,
        background: on ? "var(--m-forest)" : "var(--m-ink-faint)",
        position: "relative",
        flex: "none",
        transition: "background .15s ease",
      }}
    >
      <i
        style={{
          position: "absolute",
          top: 3,
          left: on ? 23 : 3,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--m-card)",
          transition: "left .15s ease",
        }}
      />
    </span>
  );
}
