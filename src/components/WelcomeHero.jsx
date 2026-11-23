const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** Inline styles for the zoom-through at scroll progress `p` (transform and opacity only). */
function heroStyles(p) {
  return {
    labels: { opacity: 1 - clamp01(p / 0.3) },
    wordmark: {
      transform: `scale(${1 + 5 * p})`,
      opacity: 1 - clamp01((p - 0.5) / 0.4),
    },
  };
}

/**
 * Full-viewport opening hero with the giant LabLink wordmark (the page's h1). With motion allowed
 * it is sticky and zooms through as the page scrolls; with reduced motion it is a static section.
 * @param {{ progress: number, reduced: boolean, onStepInside: (event: Event) => void }} props
 */
export default function WelcomeHero({ progress, reduced, onStepInside }) {
  const styles = reduced ? { labels: undefined, wordmark: undefined } : heroStyles(progress);
  return (
    <section
      aria-label="Welcome"
      className={`ml-[calc(50%-50vw)] flex w-screen flex-col items-center justify-center overflow-hidden px-4 ${
        reduced ? 'relative py-24' : 'sticky top-[61px] h-[calc(100svh-61px)]'
      }`}
    >
      <p
        style={styles.labels}
        className="kicker flex items-center gap-3 text-xs text-brick sm:text-sm"
      >
        <span aria-hidden="true" className="h-px w-8 bg-brick" />
        Campus lab resource sharing
      </p>
      <h1
        style={styles.wordmark}
        className="wordmark wordmark-gradient mt-4 pb-[0.08em] text-center text-[clamp(4.5rem,18vw,15rem)] leading-none will-change-transform"
      >
        LabLink
      </h1>
      <div
        style={styles.labels}
        className={`flex w-full max-w-6xl items-end justify-between gap-4 text-sm ${
          reduced ? 'mt-16' : 'absolute inset-x-0 bottom-8 mx-auto px-4'
        }`}
      >
        <p className="text-muted">Scroll to enter.</p>
        <a href="#enter" onClick={onStepInside} className="link rounded text-base">
          Step inside <span aria-hidden="true">↘</span>
        </a>
      </div>
    </section>
  );
}
