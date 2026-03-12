/**
 * Renders a standalone HTML page inside an iframe that fills the available space.
 */
export function IframePage({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      src={src}
      title={title}
      className="w-full h-[calc(100vh-3.5rem-2.75rem)] border-0"
      sandbox="allow-scripts allow-same-origin allow-popups"
    />
  );
}
