/** Visible marker for content that must be replaced with the live site's text. */
export function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="ph-marker">[PLACEHOLDER] {children}</span>;
}
