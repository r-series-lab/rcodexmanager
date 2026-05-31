import { createTheme } from "@mui/material/styles";

export type CodexManagerStyleMode = "light" | "dark";

const fontFamily = [
  '"SF Pro Display"',
  '"Avenir Next"',
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Microsoft YaHei"',
  "sans-serif",
].join(", ");

const lightTokens = {
  bg: "#f4f7fb",
  panel: "rgba(255,255,255,0.92)",
  line: "rgba(42,82,132,0.16)",
  text: "#172133",
  muted: "#66758a",
  accent: "#2563eb",
  accentHover: "#3778ff",
  success: "#168a55",
  warning: "#b7791f",
};

const darkTokens = {
  bg: "#090d13",
  panel: "rgba(16,22,31,0.92)",
  line: "rgba(139,169,208,0.14)",
  text: "#f2f6fb",
  muted: "rgba(218,226,238,0.62)",
  accent: "#4f8cff",
  accentHover: "#6aa0ff",
  success: "#54d98f",
  warning: "#f2bc5b",
};

export function createRcodexManagerTheme(styleMode: CodexManagerStyleMode) {
  const dark = styleMode === "dark";
  const tokens = dark ? darkTokens : lightTokens;

  return createTheme({
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontSize: 12,
      fontFamily,
      h5: {
        letterSpacing: 0,
        fontWeight: 800,
        fontSize: "1.08rem",
      },
      h6: {
        letterSpacing: 0,
        fontWeight: 800,
        fontSize: "0.95rem",
      },
      subtitle1: {
        fontSize: "0.88rem",
      },
      body2: {
        fontSize: "0.76rem",
      },
      button: {
        textTransform: "none",
        fontWeight: 800,
        letterSpacing: 0,
        fontSize: "0.76rem",
      },
      caption: {
        fontSize: "0.64rem",
      },
    },
    palette: {
      mode: dark ? "dark" : "light",
      primary: {
        main: tokens.accent,
        light: tokens.accentHover,
        contrastText: "#ffffff",
      },
      secondary: {
        main: dark ? "#9fb4d8" : "#64748b",
      },
      background: {
        default: tokens.bg,
        paper: tokens.panel,
      },
      text: {
        primary: tokens.text,
        secondary: tokens.muted,
      },
      divider: tokens.line,
      success: {
        main: tokens.success,
      },
      warning: {
        main: tokens.warning,
      },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
          size: "small",
        },
        styleOverrides: {
          root: {
            minHeight: 28,
            borderRadius: 8,
            paddingInline: 9,
            "&.MuiButton-containedPrimary": {
              boxShadow: dark
                ? "0 12px 24px rgba(11,78,190,0.22), inset 0 1px 0 rgba(255,255,255,0.16)"
                : "0 10px 22px rgba(37,99,235,0.18)",
            },
          },
        },
      },
      MuiIconButton: {
        defaultProps: {
          size: "small",
        },
        styleOverrides: {
          root: {
            width: 29,
            height: 29,
            borderRadius: 9,
            border: `1px solid ${tokens.line}`,
            backgroundColor: dark ? "rgba(255,255,255,0.018)" : "rgba(255,255,255,0.66)",
            color: tokens.text,
            "&:hover": {
              borderColor: tokens.accent,
              backgroundColor: dark ? "rgba(255,255,255,0.04)" : "rgba(37,99,235,0.07)",
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            height: 21,
            borderRadius: 8,
            fontWeight: 800,
            fontSize: "0.68rem",
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: "small",
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            minHeight: 30,
            borderRadius: 9,
            backgroundColor: dark ? "rgba(255,255,255,0.018)" : "rgba(255,255,255,0.72)",
            fontSize: "0.78rem",
          },
          input: {
            padding: "6px 9px",
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            minHeight: 32,
            borderRadius: 10,
            paddingBlock: 2,
            paddingInline: 9,
            fontSize: "0.78rem",
          },
          icon: {
            paddingBlock: 4,
            marginRight: 7,
          },
          message: {
            paddingBlock: 4,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            padding: "14px 16px 8px",
            fontSize: "1rem",
            fontWeight: 850,
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: "8px 16px",
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: "8px 16px 14px",
          },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            padding: 5,
          },
        },
      },
    },
  });
}
