import styles from "./publish-flow.module.css";

/** Routes an existing validator message to its field; does not validate or alter input. */
export function fieldFeedback(error: string, prefixes: readonly string[]) {
  return prefixes.some(prefix => error.startsWith(prefix)) ? error : "";
}

export function PublishFieldFeedback({ id, message }: { id: string; message: string }) {
  return message ? <span id={id} className={styles.fieldError}>{message}</span> : null;
}
