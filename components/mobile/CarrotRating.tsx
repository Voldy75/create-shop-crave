import { Carrot } from "@/components/mascots";

/**
 * Ratings are carrots, not stars — the design's `.rating` / `.rating .off`
 * pair. Empty carrots keep their shape and desaturate rather than disappearing,
 * so the row always reads as "n out of 5".
 */
export function CarrotRating({
  value,
  max = 5,
  size = 16,
}: {
  value: number;
  max?: number;
  size?: number;
}) {
  return (
    <span className="rating" role="img" aria-label={`${value} out of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <Carrot key={i} width={size} height={size} className={i < value ? undefined : "off"} />
      ))}
    </span>
  );
}
