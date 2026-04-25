import { useEffect, useState } from "react";

// Reactive boolean reflecting `documentElement` having the `dark` class.
// Driven by next-themes' resolved theme; we observe the class so subscribers
// re-render the moment the theme actually applies, not when the preference
// changes.
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(() =>
    typeof document === "undefined" ? false : document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}
