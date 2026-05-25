import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        orange: { DEFAULT: "#F08353", soft: "#FBE9E3" },
        tangerine: "#F6A958",
        beige: { DEFAULT: "#D2B06E", light: "#EAD7AC", soft: "#F7F0DD" },
        green: { DEFAULT: "#ACC095", soft: "#EEF2E8", strong: "#7A9264" },
        base: "#FAFAF8",
        surface: "#FFFFFF",
        sunken: "#F3F2EE",
        ink: {
          DEFAULT: "#3A3530",
          secondary: "#6B635B",
          tertiary: "#9A9189",
        },
        line: {
          DEFAULT: "#E8E5DF",
          strong: "#D3D2CD",
        },
        success: { DEFAULT: "#7A9264", soft: "#EEF2E8" },
        danger: { DEFAULT: "#C85A3E", soft: "#FBE9E3" },
        warning: { DEFAULT: "#D2B06E", soft: "#F7F0DD" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-1": ["48px", { lineHeight: "1.1", letterSpacing: "0.01em" }],
        "display-2": ["36px", { lineHeight: "1.15", letterSpacing: "0.01em" }],
        h1: ["28px", { lineHeight: "1.2" }],
        h2: ["22px", { lineHeight: "1.25" }],
        h3: ["18px", { lineHeight: "1.3" }],
        "body-lg": ["16px", { lineHeight: "1.6" }],
        body: ["14px", { lineHeight: "1.55" }],
        "body-sm": ["13px", { lineHeight: "1.5" }],
        label: ["12px", { lineHeight: "1.4", letterSpacing: "0.08em" }],
        meta: ["11px", { lineHeight: "1.4" }],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        full: "999px",
      },
      boxShadow: {
        "sm-warm": "0 1px 2px rgba(58, 53, 48, 0.04)",
        "md-warm": "0 2px 8px rgba(58, 53, 48, 0.06), 0 1px 2px rgba(58, 53, 48, 0.04)",
        "lg-warm": "0 8px 24px rgba(58, 53, 48, 0.08), 0 2px 6px rgba(58, 53, 48, 0.04)",
        "focus-orange": "0 0 0 3px rgba(240, 131, 83, 0.18)",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "40px",
        "2xl": "64px",
      },
    },
  },
  plugins: [],
};

export default config;
