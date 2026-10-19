import styles from "./publish-flow.module.css";

/** Presentation only: the domain retains its steps, validation and persistence. */
export function PublishProgress({ steps, current }: { steps: readonly string[]; current: number }) {
  return <nav className={styles.progress} aria-label="Progreso del formulario">
    <p aria-live="polite" aria-atomic="true"><strong>Paso {current + 1} de {steps.length}</strong><span>{steps[current]}</span></p>
    <ol style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>{steps.map((label, index) => <li key={label} aria-label={`Paso ${index + 1}: ${label}`} aria-current={index === current ? "step" : undefined} data-current={index === current}><span aria-hidden="true">{index + 1}</span><span>{label}</span></li>)}</ol>
  </nav>;
}
