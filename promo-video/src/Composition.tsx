import {
  AbsoluteFill,
  Composition,
  Easing,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

const FPS = 30;
const SCENE = { intro: 150, feature: 180, outro: 150 };
const colors = {
  ink: "#070b12",
  blue: "#8fb8ea",
  cyan: "#72e2d0",
  purple: "#c0a6ff",
  green: "#7be0a6",
  gold: "#e7c56e",
  text: "#f5f8ff",
  muted: "#9ba8bc",
};
const fontFamily =
  "Inter, -apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif";
const SCREEN_MAX_WIDTH = 996;
const SCREEN_TOP = 520;
const SCREEN_CHROME_HEIGHT = 35;
const SCREEN_ASPECTS: Record<string, number> = {
  "profile-workspace.png": 1440 / 900,
  "session-center.png": 1160 / 792,
  "auth-vault.png": 1160 / 792,
  "remote-channels.png": 1160 / 792,
  "model-routing.png": 1160 / 792,
};
const fade = (frame: number, duration: number) =>
  interpolate(frame, [0, 18, duration - 20, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
const entrance = (frame: number) =>
  interpolate(frame, [0, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const Background = () => (
  <AbsoluteFill
    style={{
      backgroundColor: colors.ink,
      backgroundImage:
        "radial-gradient(circle at 80% 18%, rgba(143, 184, 234, 0.2), transparent 30%), radial-gradient(circle at 12% 86%, rgba(114, 226, 208, 0.13), transparent 27%), linear-gradient(135deg, #070b12 0%, #0b111c 55%, #070b12 100%)",
      overflow: "hidden",
    }}
  >
    <div className="grid-overlay" />
    <div className="grain-overlay" />
  </AbsoluteFill>
);
const BrandMark = ({ size = 52 }: { size?: number }) => (
  <Img
    src={staticFile("assets/rcodexmanager.png")}
    style={{
      width: size,
      height: size,
      objectFit: "contain",
      borderRadius: 14,
    }}
  />
);
const Eyebrow = ({
  children,
  accent = colors.blue,
}: {
  children: string;
  accent?: string;
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 16px",
      border: `1px solid ${accent}55`,
      borderRadius: 999,
      backgroundColor: `${accent}12`,
      color: accent,
      fontFamily,
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: "0.12em",
    }}
  >
    <span
      style={{
        width: 24,
        height: 2,
        backgroundColor: accent,
        display: "inline-block",
      }}
    />
    {children}
  </div>
);

const Intro = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const appear = entrance(frame);
  return (
    <AbsoluteFill
      style={{ opacity: fade(frame, durationInFrames), fontFamily }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 72px",
          scale: interpolate(frame, [0, durationInFrames], [0.97, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <div
          style={{
            opacity: appear,
            translate: `${interpolate(frame, [0, 28], [-30, 0], { extrapolateRight: "clamp" })}px 0px`,
          }}
        >
          <BrandMark size={76} />
        </div>
        <div style={{ height: 42 }} />
        <Eyebrow>RCODEXMANAGER / PRODUCT FILM</Eyebrow>
        <div style={{ height: 26 }} />
        <h1
          style={{
            margin: 0,
            maxWidth: 1160,
            color: colors.text,
            fontSize: 70,
            lineHeight: 1.06,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            opacity: appear,
            translate: `${interpolate(frame, [0, 32], [34, 0], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) })}px 0px`,
          }}
        >
          让每个 Profile，都拥有
          <br />
          <span style={{ color: colors.blue }}>清晰、独立的工作上下文</span>
        </h1>
        <div style={{ height: 30 }} />
        <p
          style={{
            margin: 0,
            color: colors.muted,
            fontSize: 28,
            letterSpacing: "0.04em",
            opacity: interpolate(frame, [18, 50], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          从认证、会话到模型路由，把 Codex 工作区真正管理起来。
        </p>
        <div style={{ height: 72 }} />
        <div style={{ display: "flex", gap: 14, opacity: appear }}>
          {["Profiles", "Sessions", "Auth", "Routes"].map((label, index) => (
            <div
              key={label}
              style={{
                padding: "12px 22px",
                border: `1px solid ${index === 0 ? "rgba(143,184,234,0.65)" : "rgba(155,168,188,0.2)"}`,
                borderRadius: 999,
                color: index === 0 ? colors.blue : colors.muted,
                fontSize: 19,
                letterSpacing: "0.12em",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
      <div className="hero-orbit orbit-one" />
      <div className="hero-orbit orbit-two" />
    </AbsoluteFill>
  );
};

type FeatureProps = {
  image: string;
  eyebrow: string;
  title: string;
  description: string;
  accent?: string;
  index: string;
};
const FeatureScene = ({
  image,
  eyebrow,
  title,
  description,
  accent = colors.blue,
  index,
}: FeatureProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const shellWidth = SCREEN_MAX_WIDTH;
  const imageHeight = Math.round(
    shellWidth / (SCREEN_ASPECTS[image] ?? 16 / 9),
  );
  const shellHeight = imageHeight + SCREEN_CHROME_HEIGHT;
  return (
    <AbsoluteFill
      style={{ opacity: fade(frame, durationInFrames), fontFamily }}
    >
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          top: 92,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          opacity: entrance(frame),
          translate: `0px ${interpolate(frame, [0, 28], [24, 0], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) })}px`,
        }}
      >
        <div>
          <Eyebrow accent={accent}>{eyebrow}</Eyebrow>
          <h2
            style={{
              margin: "24px 0 0",
              color: colors.text,
              fontSize: 48,
              lineHeight: 1.16,
              letterSpacing: "-0.03em",
            }}
          >
            {title}
          </h2>
          <p
            style={{
              margin: "16px 0 0",
              display: "flex",
              alignItems: "center",
              gap: 12,
              maxWidth: 860,
              color: colors.muted,
              fontSize: 21,
              letterSpacing: "0.03em",
            }}
          >
            <span style={{ color: accent, fontSize: 16 }}>●</span>
            {description}
          </p>
        </div>
        <div
          style={{
            color: accent,
            fontSize: 20,
            letterSpacing: "0.18em",
            fontWeight: 700,
          }}
        >
          {index}
        </div>
      </div>
      <div
        className="screen-shell"
        style={{
          position: "absolute",
          left: "50%",
          width: shellWidth,
          marginLeft: -shellWidth / 2,
          top: SCREEN_TOP,
          height: shellHeight,
          opacity: entrance(frame),
          scale: interpolate(frame, [0, durationInFrames], [1.045, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: `0px ${interpolate(frame, [0, 32], [28, 0], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) })}px`,
        }}
      >
        <div className="screen-chrome">
          <div style={{ display: "flex", gap: 8 }}>
            <span
              className="chrome-dot"
              style={{ backgroundColor: "#ff6b6b" }}
            />
            <span
              className="chrome-dot"
              style={{ backgroundColor: "#f0c674" }}
            />
            <span
              className="chrome-dot"
              style={{ backgroundColor: "#59d38c" }}
            />
          </div>
          <div
            style={{ color: "#68768a", fontSize: 13, letterSpacing: "0.12em" }}
          >
            RCODEXMANAGER / PROFILE WORKSPACE
          </div>
          <div style={{ width: 58 }} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: `${SCREEN_CHROME_HEIGHT}px 0 0`,
            overflow: "hidden",
            backgroundColor: "#0b1018",
          }}
        >
          <Img
            src={staticFile(`assets/${image}`)}
            style={{
              width: "100%",
              height: "100%",
            objectFit: "contain",
            objectPosition: "center",
            scale: interpolate(frame, [0, durationInFrames], [1, 1.02], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          />
          <div className="screen-vignette" />
        </div>
        <div
          className="screen-sheen"
          style={{
            translate: `${interpolate(frame, [0, durationInFrames], [-900, 1100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.linear })}px 0px`,
          }}
        />
      </div>
      <div
        className="feature-footer"
        style={{
          top: "auto",
          bottom: 110,
          opacity: interpolate(frame, [20, 52], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <span>ONE PROFILE WORKSPACE</span>
        <span style={{ color: accent }}>●</span>
        <span>CLARITY BY DEFAULT</span>
      </div>
    </AbsoluteFill>
  );
};

const Outro = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        opacity: fade(frame, durationInFrames),
        fontFamily,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          opacity: entrance(frame),
          scale: interpolate(frame, [0, 35], [0.92, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <BrandMark size={132} />
        <h2
          style={{
            margin: "34px 0 0",
            color: colors.text,
            fontSize: 68,
            letterSpacing: "-0.04em",
          }}
        >
          让每个工作上下文，都更清晰。
        </h2>
        <p
          style={{
            margin: "20px 0 0",
            color: colors.muted,
            fontSize: 24,
            letterSpacing: "0.16em",
          }}
        >
          rCodexManager · Control the context around Codex
        </p>
        <div
          style={{
            marginTop: 40,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              padding: "16px 28px",
              borderRadius: 16,
              border: "1px solid rgba(119,174,252,0.34)",
              background: "linear-gradient(180deg, rgba(119,174,252,0.2), rgba(119,174,252,0.06))",
              color: colors.text,
              fontSize: 25,
              fontWeight: 700,
            }}
          >
            Website · rcm.rurie.top
          </div>
          <div style={{ color: colors.muted, fontSize: 23, letterSpacing: "0.04em" }}>
            GitHub · github.com/r-series-lab/rcodexmanager
          </div>
        </div>
        <div
          style={{
            marginTop: 44,
            color: colors.blue,
            fontSize: 18,
            letterSpacing: "0.22em",
            fontWeight: 700,
          }}
        >
          RCODEXMANAGER / MANAGE WITH CONFIDENCE
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const RcodexManagerPromo: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <Sequence durationInFrames={SCENE.intro}>
      <Intro />
    </Sequence>
    <Sequence from={SCENE.intro} durationInFrames={SCENE.feature}>
      <FeatureScene
        image="profile-workspace.png"
        eyebrow="01 / PROFILE WORKSPACE"
        title="先看全局，再进入每个 Profile"
        description="账号、认证、额度、会话和运行状态集中对比，工作区始终保持清晰。"
        index="01"
      />
    </Sequence>
    <Sequence
      from={SCENE.intro + SCENE.feature}
      durationInFrames={SCENE.feature}
    >
      <FeatureScene
        image="session-center.png"
        eyebrow="02 / SESSION CENTER"
        title="会话索引有边界，详情按需打开"
        description="用搜索、Profile 和摘要快速定位，再进入需要阅读的那一条会话。"
        accent={colors.cyan}
        index="02"
      />
    </Sequence>
    <Sequence
      from={SCENE.intro + SCENE.feature * 2}
      durationInFrames={SCENE.feature}
    >
      <FeatureScene
        image="auth-vault.png"
        eyebrow="03 / AUTH VAULT"
        title="认证状态，集中看见、稳妥管理"
        description="把登录态、备份和恢复入口放在同一个管理中心，切换更有把握。"
        accent={colors.green}
        index="03"
      />
    </Sequence>
    <Sequence
      from={SCENE.intro + SCENE.feature * 3}
      durationInFrames={SCENE.feature}
    >
      <FeatureScene
        image="remote-channels.png"
        eyebrow="04 / REMOTE CHANNELS"
        title="远程渠道，连接到真正的工作流"
        description="让微信、飞书等远程入口与目标 Profile 对齐，协作不再失去上下文。"
        accent={colors.gold}
        index="04"
      />
    </Sequence>
    <Sequence
      from={SCENE.intro + SCENE.feature * 4}
      durationInFrames={SCENE.feature}
    >
      <FeatureScene
        image="model-routing.png"
        eyebrow="05 / MODEL ROUTING"
        title="模型与服务路由，透明可控"
        description="从 Provider 预设到代理状态，给每个 Profile 更合适的运行路径。"
        accent={colors.purple}
        index="05"
      />
    </Sequence>
    <Sequence
      from={SCENE.intro + SCENE.feature * 5}
      durationInFrames={SCENE.outro}
    >
      <Outro />
    </Sequence>
  </AbsoluteFill>
);

export const RemotionComposition = () => (
  <Composition
    id="RCodexManagerPromo"
    component={RcodexManagerPromo}
    durationInFrames={SCENE.intro + SCENE.feature * 5 + SCENE.outro}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
