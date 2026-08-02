import { useThemeContext } from "../context/ThemeProvider";

export function useTheme() {
  const { theme, resolvedTheme, setTheme } = useThemeContext();
  return { theme, resolvedTheme, setTheme };
}
