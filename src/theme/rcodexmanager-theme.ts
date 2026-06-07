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
  bg: "#f5f7fa",
  panel: "rgba(255,255,255,0.86)",
  line: "rgba(62,78,99,0.14)",
  text: "#182231",
  muted: "#69788c",
  accent: "#315fbb",
  accentHover: "#3d6fcd",
  success: "#168a55",
  warning: "#b7791f",
};

const darkTokens = {
  bg: "#080d13",
  panel: "rgba(16,22,31,0.86)",
  line: "rgba(139,169,208,0.13)",
  text: "#f2f6fb",
  muted: "rgba(218,226,238,0.62)",
  accent: "#80a6e8",
  accentHover: "#96b7f0",
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
              boxShadow: dark
                ? "0 10px 22px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.14)"
                : "0 10px 22px rgba(49,95,187,0.14)",
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
              backgroundColor: dark ? "rgba(128,166,232,0.09)" : "rgba(49,95,187,0.07)",
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
              : "0 24px 64px rgba(37,55,79,0.18)",
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
