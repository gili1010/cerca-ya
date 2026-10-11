import styles from "./business-hours.module.css";

const hours = Array.from({ length: 24 }, (_, n) => String(n).padStart(2, "0"));
const quarters = ["00", "15", "30", "45"];

export function BusinessHoursTimeSelect({ label, description, value, onChange }: {
  label: string; description: string; value: string; onChange: (value: string) => void;
}) {
  const [hour, minute] = value.split(":");
  // Preserve an existing non-quarter minute without silently changing stored hours.
  const minutes = quarters.includes(minute) ? quarters : [...quarters, minute].sort();
  return <div className={styles.timeField}>
    <span>{label}</span>
    <div className={styles.timeSelect}>
      <select aria-label={`${description}, ${label.toLowerCase()}, hora`} value={hour} onChange={event => onChange(`${event.target.value}:${minute}`)}>
        {hours.map(item => <option key={item} value={item}>{item}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label={`${description}, ${label.toLowerCase()}, minutos`} value={minute} onChange={event => onChange(`${hour}:${event.target.value}`)}>
        {minutes.map(item => <option key={item} value={item}>{item}</option>)}
      </select>
    </div>
  </div>;
}
