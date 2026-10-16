import React, { createContext, useContext, useEffect, useState } from "react";

export const ACCENTS = {
  emerald: {
    name: "Emerald Glow",
    color: "#10b981",
    hover: "#059669",
    rgb: "16, 185, 129",
    glow: "rgba(16, 185, 129, 0.25)",
  },
  indigo: {
    name: "Electric Indigo",
    color: "#6366f1",
    hover: "#4f46e5",
    rgb: "99, 102, 241",
    glow: "rgba(99, 102, 241, 0.25)",
  },
  violet: {
    name: "Cyber Violet",
    color: "#8b5cf6",
    hover: "#7c3aed",
    rgb: "139, 92, 246",
    glow: "rgba(139, 92, 246, 0.25)",
  },
  cyan: {
    name: "Neo Cyan",
    color: "#06b6d4",
    hover: "#0891b2",
    rgb: "6, 182, 212",
    glow: "rgba(6, 182, 212, 0.25)",
  },
  rose: {
    name: "Solar Rose",
    color: "#f43f5e",
    hover: "#e11d48",
    rgb: "244, 63, 94",
    glow: "rgba(244, 63, 94, 0.25)",
  },
  amber: {
    name: "Warm Amber",
    color: "#f59e0b",
    hover: "#d97706",
    rgb: "245, 158, 11",
    glow: "rgba(245, 158, 11, 0.25)",
  },
};

export const CURRENCIES = {
  USD: { symbol: "$", code: "USD", name: "US Dollar ($)" },
  EUR: { symbol: "€", code: "EUR", name: "Euro (€)" },
  GBP: { symbol: "£", code: "GBP", name: "British Pound (£)" },
  INR: { symbol: "₹", code: "INR", name: "Indian Rupee (₹)" },
  JPY: { symbol: "¥", code: "JPY", name: "Japanese Yen (¥)" },
  CAD: { symbol: "C$", code: "CAD", name: "Canadian Dollar (C$)" },
  AUD: { symbol: "A$", code: "AUD", name: "Australian Dollar (A$)" },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("inventra_theme") || "dark";
  });

  const [accent, setAccent] = useState(() => {
    return localStorage.getItem("inventra_accent") || "emerald";
  });

  const [density, setDensity] = useState(() => {
    return localStorage.getItem("inventra_density") || "normal";
  });

  const [currency, setCurrency] = useState(() => {
    return localStorage.getItem("inventra_currency") || "USD";
  });

  const [defaultThreshold, setDefaultThreshold] = useState(() => {
    const saved = localStorage.getItem("inventra_threshold");
    return saved !== null ? parseInt(saved, 10) : 10;
  });

  // Apply theme & root CSS variables
  useEffect(() => {
    localStorage.setItem("inventra_theme", theme);
    const root = document.documentElement;

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && prefersDark);

    if (isDark) {
      root.classList.add("dark");
      root.classList.remove("light");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
  }, [theme]);

  // Apply accent tokens
  useEffect(() => {
    localStorage.setItem("inventra_accent", accent);
    const root = document.documentElement;
    const active = ACCENTS[accent] || ACCENTS.emerald;

    root.style.setProperty("--accent", active.color);
    root.style.setProperty("--accent-hover", active.hover);
    root.style.setProperty("--accent-rgb", active.rgb);
    root.style.setProperty("--accent-glow", active.glow);
    root.style.setProperty("--accent-primary", active.color);
  }, [accent]);

  // Apply density
  useEffect(() => {
    localStorage.setItem("inventra_density", density);
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  // Apply currency
  useEffect(() => {
    localStorage.setItem("inventra_currency", currency);
  }, [currency]);

  // Apply default threshold
  useEffect(() => {
    localStorage.setItem("inventra_threshold", defaultThreshold.toString());
  }, [defaultThreshold]);

  const formatCurrency = (amount) => {
    const val = Number(amount) || 0;
    const curr = CURRENCIES[currency] || CURRENCIES.USD;
    return `${curr.symbol}${val.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const resetDefaults = () => {
    setTheme("dark");
    setAccent("emerald");
    setDensity("normal");
    setCurrency("USD");
    setDefaultThreshold(10);
    [
      "inventra_theme",
      "inventra_accent",
      "inventra_density",
      "inventra_currency",
      "inventra_threshold",
    ].forEach((key) => localStorage.removeItem(key));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        accent,
        setAccent,
        density,
        setDensity,
        currency,
        setCurrency,
        defaultThreshold,
        setDefaultThreshold,
        formatCurrency,
        resetDefaults,
        accents: ACCENTS,
        currencies: CURRENCIES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
