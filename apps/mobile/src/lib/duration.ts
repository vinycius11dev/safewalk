/** Short duration for the screen: "45 min", "1 h" or "4 h 28 min". */
export function durationLabel(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/** The same duration in full words, for screen readers. */
export function durationSpoken(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  const hourText = `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const minuteText = `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  if (hours === 0) return minuteText;
  return minutes === 0 ? hourText : `${hourText} e ${minuteText}`;
}
