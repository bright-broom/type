(() => {
  const script = document.currentScript;
  const root = document.documentElement;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("typeloop-appearance="))
    ?.slice("typeloop-appearance=".length);
  const [storedTheme, storedDensity, storedMotion] = (cookie ?? "").split(".");
  const theme = ["noir", "modern", "classic"].includes(storedTheme) ? storedTheme : "noir";
  const density = ["comfortable", "compact"].includes(storedDensity) ? storedDensity : "comfortable";
  const motion = ["system", "reduced"].includes(storedMotion) ? storedMotion : "system";
  const dark = theme === "noir";

  root.dataset.theme = theme;
  root.dataset.density = density;
  root.dataset.motion = motion;
  root.style.colorScheme = dark ? "dark" : "light";

  const color = script?.dataset[dark ? "darkColor" : "lightColor"];
  if (color) {
    for (const themeColor of document.querySelectorAll('meta[name="theme-color"]')) {
      themeColor.setAttribute("content", color);
    }
  }
})();
