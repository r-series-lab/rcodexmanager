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
  bg: "rgba(243,246,250,0.58)",
  panel: "rgba(250,252,255,0.72)",
  line: "rgba(52,76,96,0.14)",
  text: "#17202b",
  muted: "rgba(63,79,97,0.68)",
  accent: "#5c7085",
  accentHover: "#455a70",
  success: "#3f8269",
  warning: "#a86c1c",
};

const darkTokens = {
  bg: "rgba(10,12,15,0.78)",
  panel: "rgba(24,29,36,0.72)",
  line: "rgba(226,232,240,0.12)",
  text: "#f2f6f4",
  muted: "rgba(221,231,229,0.62)",
  accent: "#8fb8ea",
  accentHover: "#b6d2f4",
  success: "#86c2a0",
  warning: "#ecc26f",
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
        fontSize: "1.02rem",
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
        contrastText: dark ? "#07111d" : "#ffffff",
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
            minHeight: 30,
            borderRadius: 8,
            paddingInline: 10,
            transition:
              "background-color 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease",
            "&.MuiButton-containedPrimary": {
              backgroundColor: tokens.accent,
              boxShadow: dark
                ? "0 10px 22px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.14)"
                : "0 10px 22px rgba(49,95,187,0.14)",
              "&:hover": {
                backgroundColor: tokens.accentHover,
              },
            },
            "&.MuiButton-outlined": {
              borderColor: tokens.line,
              backgroundColor: dark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.58)",
              "&:hover": {
                borderColor: tokens.accent,
                backgroundColor: dark ? "rgba(143,184,234,0.1)" : "rgba(92,112,133,0.08)",
              },
            },
            "&.Mui-focusVisible": {
              outline: `2px solid ${dark ? "rgba(128,166,232,0.72)" : "rgba(49,95,187,0.62)"}`,
              outlineOffset: 2,
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
            width: 30,
            height: 30,
            borderRadius: 9,
            border: `1px solid ${tokens.line}`,
            backgroundColor: dark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.64)",
            color: tokens.text,
            transition: "background-color 140ms ease, border-color 140ms ease, color 140ms ease",
            "&:hover": {
              borderColor: tokens.accent,
              backgroundColor: dark ? "rgba(143,184,234,0.1)" : "rgba(92,112,133,0.1)",
            },
            "&.Mui-focusVisible": {
              outline: `2px solid ${dark ? "rgba(128,166,232,0.72)" : "rgba(49,95,187,0.62)"}`,
              outlineOffset: 2,
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
            maxWidth: "100%",
          },
          label: {
            overflow: "hidden",
            textOverflow: "ellipsis",
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
            backgroundColor: dark ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.7)",
            fontSize: "0.78rem",
            transition: "background-color 140ms ease, border-color 140ms ease",
            "&.Mui-focused": {
              backgroundColor: dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.96)",
            },
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
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            border: `1px solid ${tokens.line}`,
            backgroundImage: "none",
            boxShadow: dark
              ? "0 28px 72px rgba(0,0,0,0.46)"
              : "0 24px 64px rgba(28,48,68,0.18)",
            backdropFilter: "blur(28px) saturate(1.22)",
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
