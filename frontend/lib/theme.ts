/**
 * DriveIQ Design System — theme.ts
 * ─────────────────────────────────
 * Single source of truth for all design tokens.
 * Extracted from globals.css, all screen files, and Figma variable names.
 *
 * Usage:
 *   import { colors, type_, radius, space, shadow, card, input, btn, pill, page } from "../../lib/theme";
 */

import { Platform, StyleSheet } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// FONT FAMILIES (Sora + Space Mono — loaded in app/layout.tsx)
// Sora: headings & body — geometric, modern, approachable
// Space Mono: data & stats — monospace precision for metrics
// ─────────────────────────────────────────────────────────────────────────────

export const fonts = {
  // Sora (headings & body)
  regular:   "Sora_400Regular",
  medium:    "Sora_500Medium",
  semibold:  "Sora_600SemiBold",
  bold:      "Sora_700Bold",
  extrabold: "Sora_800ExtraBold",
  // Space Mono (data & stats)
  mono:      "SpaceMono_400Regular",
  monoBold:  "SpaceMono_700Bold",
};

// ─────────────────────────────────────────────────────────────────────────────
// CURSOR HELPERS (web only)
// ─────────────────────────────────────────────────────────────────────────────

export const cursor = Platform.OS === "web" ? {
  pointer:    { cursor: "pointer" as any },
  text:       { cursor: "text" as any },
  notAllowed: { cursor: "not-allowed" as any },
} : {
  pointer:    {},
  text:       {},
  notAllowed: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  // ── Page backgrounds
  pageBg:         "#F8FAFC",
  pageBgAlt:      "#F6F7FB",
  cardBg:         "#FFFFFF",
  inputBg:        "#F9FAFB",

  // ── Dark theme (instructor home, lesson)
  darkBg:         "#0D1B35",
  darkCard:       "#12243E",
  darkBorder:     "#1E2A44",
  darkText:       "#E5E7EB",
  darkSubtext:    "#9AA7BF",
  darkAccent:     "#0A8A7A",

  // ── Text
  text:           "#0F172A",
  textAlt:        "#101828",
  subtext:        "#64748B",
  subtextAlt:     "#667085",
  muted:          "#98A2B3",
  label:          "#344054",
  placeholder:    "#98A2B3",

  // ── Brand teal (primary action color)
  blue:           "#0A8A7A",
  blueDark:       "#07705F",
  blueDeep:       "#065E50",
  blueLight:      "#ECFDF8",
  blueLighter:    "#D1FAE5",
  blueBorder:     "#A7F3D0",
  blueChip:       "#B2F5EA",
  blueNote:       "#ECFDF8",
  blueNoteBorder: "#A7F3D0",

  // ── Navy (hero, accents, depth)
  purple:         "#0D1B35",
  purpleDark:     "#0D1B35",
  purpleDeep:     "#06101D",
  purpleLight:    "#F0F4FA",
  purpleLighter:  "#E8EEF6",
  purpleBorder:   "#C7D2E0",
  purpleBorderAlt:"#B8C5D6",
  purpleChip:     "#E2EAF2",
  avatarPurple:   "#1A2F55",

  // ── Green (success, completed, earned)
  green:          "#16A34A",
  greenDark:      "#166534",
  greenMid:       "#15803D",
  greenLight:     "#ECFDF3",
  greenLighter:   "#F0FDF4",
  greenBorder:    "#B7F2C8",
  greenBorderAlt: "#BBF7D0",

  // ── Yellow (achievements, badges)
  yellow:         "#F59E0B",
  yellowLight:    "#FFFBEB",
  yellowLighter:  "#FFF7E6",
  yellowBorder:   "#FCD34D",
  yellowBorderAlt:"#FFD48A",
  yellowBg:       "#FEF3C7",

  // ── Amber (drowsy behavior — distinct from yellow/achievements)
  amber:          "#D97706",
  amberDark:      "#92400E",
  amberLight:     "#FFFBEB",
  amberBorder:    "#FDE68A",
  amberBg:        "#FEF9C3",

  // ── Orange (abnormal/warning severity)
  orange:         "#F97316",
  orangeLight:    "#FFF7ED",
  orangeBorder:   "#FDBA74",

  // ── Red (errors, cancelled, destructive)
  red:            "#EF4444",
  redDark:        "#DC2626",
  redDeep:        "#E11D48",
  redLight:       "#FEE2E2",
  redBorder:      "#FECACA",

  // ── Borders & dividers
  border:         "#EAECF0",
  borderAlt:      "#E8EAF2",
  borderLight:    "#F2F4F7",
  borderMid:      "#E2E8F0",
  borderFaint:    "#F3F4F6",

  // ── Disabled / muted states
  disabled:       "#9CA3AF",
  disabledBg:     "#F3F4F6",
  disabledBorder: "#E5E7EB",

  // ── Primary dark button
  darkBtn:        "#0D1B35",

  // ── Toast / overlay
  toast:          "#1F2937",

  // ── Indigo / teal (sessions avatar, chart)
  indigo:         "#0A8A7A",
  indigoBg:       "#ECFDF8",
  indigoBorder:   "#A7F3D0",

  // ── Auth screens (gradient / frosted glass)
  authGradientA:  "#0B6A5D",
  authGradientB:  "#0D1B35",
  authGradientC:  "#12324D",
  glassCard:      "rgba(255,255,255,0.9)",
  glassBorder:    "rgba(255,255,255,0.74)",
  glassShell:     "rgba(255,255,255,0.08)",
  glassShellBorder: "rgba(255,255,255,0.12)",
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY
// Named by semantic role to match Figma layer names.
// Weight hierarchy: 400 (body light) → 500 (body) → 600 (label) → 700 (title) → 800 (display)
// ─────────────────────────────────────────────────────────────────────────────

export const type_ = StyleSheet.create({
  // Page headings
  pageTitle:        { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text, letterSpacing: -0.3 },
  pageTitleLg:      { fontFamily: fonts.extrabold, fontSize: 22, color: colors.textAlt, letterSpacing: -0.5 },
  pageSubtitle:     { fontFamily: fonts.medium, fontSize: 13, color: colors.subtext, marginTop: 4 },
  pageSubtitleBold: { fontFamily: fonts.semibold, fontSize: 13, color: colors.subtextAlt },

  // Auth screens (login / signup)
  authTitle:    { fontFamily: fonts.extrabold, fontSize: 18, color: colors.textAlt, marginTop: 6 },
  authSubtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.subtextAlt, marginTop: 6, marginBottom: 14 },

  // Cards / sections
  cardTitle:    { fontFamily: fonts.bold, fontSize: 15, color: colors.textAlt, letterSpacing: -0.2 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.text, letterSpacing: 0.2, textTransform: "uppercase" as any },
  sectionSub:   { fontFamily: fonts.medium, fontSize: 12, color: colors.subtextAlt },

  // Score displays (Space Mono — monospace precision for data readouts)
  displayScore: { fontFamily: fonts.monoBold, fontSize: 32, color: colors.text, letterSpacing: -1 },
  displayLg:    { fontFamily: fonts.monoBold, fontSize: 28, color: colors.text, letterSpacing: -0.8 },
  displayMd:    { fontFamily: fonts.monoBold, fontSize: 24, color: colors.text, letterSpacing: -0.5 },
  scoreValue:   { fontFamily: fonts.monoBold, fontSize: 15, color: colors.textAlt },
  scoreMid:     { fontFamily: fonts.monoBold, fontSize: 18 },

  // Body text
  body:         { fontFamily: fonts.medium, fontSize: 13, color: colors.text,        lineHeight: 20 },
  bodyMedium:   { fontFamily: fonts.regular, fontSize: 13, color: colors.text,        lineHeight: 20 },
  bodySm:       { fontFamily: fonts.medium, fontSize: 12, color: colors.subtextAlt,  lineHeight: 17 },

  // Form labels
  label:        { fontFamily: fonts.semibold, fontSize: 12, color: colors.label,      marginBottom: 6 },
  labelBold:    { fontFamily: fonts.bold, fontSize: 12, color: colors.textAlt,    marginBottom: 8 },
  labelSm:      { fontFamily: fonts.semibold, fontSize: 11, color: colors.subtextAlt, textTransform: "uppercase" as any, letterSpacing: 0.5 },

  // Caption
  caption:      { fontFamily: fonts.medium, fontSize: 10, color: colors.muted, letterSpacing: 0.3 },

  // Input text
  inputText:    { fontFamily: fonts.regular, fontSize: 14, color: colors.textAlt },
  inputTextSm:  { fontFamily: fonts.bold, fontSize: 12, color: colors.text },

  // Buttons
  btnPrimary:   { fontFamily: fonts.bold, color: "#FFFFFF", fontSize: 14, letterSpacing: 0.2 },
  btnSm:        { fontFamily: fonts.bold, color: "#FFFFFF", fontSize: 12 },
  btnOutline:   { fontFamily: fonts.bold, color: colors.label, fontSize: 12 },

  // Pills & chips
  pill:         { fontFamily: fonts.bold, fontSize: 11 },
  chip:         { fontFamily: fonts.bold, fontSize: 11, color: colors.text },

  // Links
  link:         { fontFamily: fonts.bold, fontSize: 12, color: "#0A8A7A" },
  linkMuted:    { fontFamily: fonts.semibold, fontSize: 12, color: colors.subtextAlt },

  // Meta (dates, IDs, vehicles)
  meta:         { fontFamily: fonts.semibold, fontSize: 11, color: colors.subtextAlt },
  metaValue:    { fontFamily: fonts.bold, fontSize: 13, color: colors.textAlt, marginTop: 2 },

  // Footer
  footer:       { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, textAlign: "center" },

  // Dark theme variants
  darkTitle:    { fontFamily: fonts.extrabold, fontSize: 26, color: "#FFFFFF" },
  darkHeading:  { fontFamily: fonts.extrabold, fontSize: 16, color: "#FFFFFF" },
  darkBody:     { fontFamily: fonts.medium, fontSize: 13, color: colors.darkSubtext },
  darkBodySm:   { fontFamily: fonts.semibold, fontSize: 11, color: colors.darkSubtext },
});

// ─────────────────────────────────────────────────────────────────────────────
// SPACING
// ─────────────────────────────────────────────────────────────────────────────

export const space = {
  xs:     4,
  sm:     8,
  md:     12,
  lg:     16,
  xl:     20,
  xxl:    24,
  xxxl:   32,
  page:   20,
  card:   18,
  cardLg: 22,
  sectionGap: 8,
};

// ─────────────────────────────────────────────────────────────────────────────
// BORDER RADIUS
// ─────────────────────────────────────────────────────────────────────────────

export const radius = {
  xs:     4,
  sm:     8,
  md:     10,
  input:  14,
  btn:    14,
  card:   16,
  cardLg: 18,
  cardXl: 22,
  logo:   16,
  tag:    10,
  icon:   12,
  pill:   999,
  shell:  30,
  authCard: 28,
};

// ─────────────────────────────────────────────────────────────────────────────
// SHADOWS
// ─────────────────────────────────────────────────────────────────────────────

export const shadow = {
  sm: Platform.select({
    ios:     { shadowColor: "#06101D", shadowOpacity: 0.06, shadowRadius: 6,  shadowOffset: { width: 0, height: 2 } },
    android: { elevation: 1 },
  }),
  navbar: Platform.select({
    ios:     { shadowColor: "#06101D", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
    android: { elevation: 3 },
  }),
  card: Platform.select({
    ios:     { shadowColor: "#06101D", shadowOpacity: 0.10, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 3 },
  }),
  cardRaised: Platform.select({
    ios:     { shadowColor: "#06101D", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 4 },
  }),
  dropdown: Platform.select({
    ios:     { shadowColor: "#06101D", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 8 },
  }),
  modal: Platform.select({
    ios:     { shadowColor: "#06101D", shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
    android: { elevation: 12 },
  }),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export const card = StyleSheet.create({
  base: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: space.card,
    ...shadow.sm,
  },
  lg: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.cardLg,
    padding: space.cardLg,
    ...shadow.card,
  },
  inner: {
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    padding: space.md,
  },
  dark: {
    backgroundColor: colors.darkCard,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    borderRadius: radius.cardLg,
    padding: space.cardLg,
  },
});

export const input = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  wrapError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  wrapDark: {
    backgroundColor: colors.darkBg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  field:     { flex: 1, color: colors.textAlt, fontSize: 14 },
  fieldSm:   { flex: 1, color: colors.text, fontWeight: "700", fontSize: 12, padding: 0 },
  fieldDark: { flex: 1, color: "#E5E7EB", fontWeight: "700" },
});

export const btn = StyleSheet.create({
  primary: {
    borderRadius: radius.btn,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.blue,
  },
  primaryDisabled: { backgroundColor: colors.disabled },
  outline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBg,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  darkAccent: {
    backgroundColor: colors.darkAccent,
    padding: 14,
    borderRadius: radius.card,
    alignItems: "center",
  },
  danger: {
    backgroundColor: colors.redDark,
    borderRadius: radius.btn,
    paddingVertical: 14,
    alignItems: "center",
  },
});

export const pill = StyleSheet.create({
  base:       { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  dark:       { backgroundColor: colors.darkBtn,   borderColor: colors.darkBtn,         borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  light:      { backgroundColor: "#F2F4F7",         borderColor: colors.border,          borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  passed:     { backgroundColor: "#DCFCE7",          borderColor: colors.greenBorderAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  failed:     { backgroundColor: colors.redLight,    borderColor: colors.redBorder,       borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  blue:       { backgroundColor: colors.purpleChip,  borderColor: colors.blueChip,        borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  cancelled:  { backgroundColor: colors.redDeep,     borderColor: colors.redDeep,         borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  completed:  { backgroundColor: colors.green,       borderColor: colors.green,           borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
});

export const avatar = StyleSheet.create({
  sm:   { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.purpleDark,  alignItems: "center", justifyContent: "center" },
  md:   { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.indigoBg,    alignItems: "center", justifyContent: "center" },
  lg:   { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.avatarPurple, alignItems: "center", justifyContent: "center" },
  xl:   { width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.avatarPurple, alignItems: "center", justifyContent: "center" },
  textSm: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  textMd: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  textLg: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  textXl: { color: "#FFFFFF", fontWeight: "700", fontSize: 30 },
  // Sessions-specific (indigo tint)
  sessions: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.indigoBg, alignItems: "center", justifyContent: "center" },
  sessionsText: { color: colors.indigo, fontWeight: "700", fontSize: 12 },
});

export const page = StyleSheet.create({
  base:      { flex: 1, backgroundColor: colors.pageBg },
  alt:       { flex: 1, backgroundColor: colors.pageBgAlt },
  content:   { padding: space.page, paddingBottom: 40, gap: 16 },
  dark:      { flex: 1, backgroundColor: colors.darkBg, padding: space.page, paddingTop: 60 },
  center:    { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },
  centerText:{ marginTop: 12, fontSize: 13, fontWeight: "600", color: colors.subtext },
});

export const divider = StyleSheet.create({
  base:  { height: 1, backgroundColor: colors.border,      marginVertical: space.card },
  faint: { height: 1, backgroundColor: colors.borderLight, marginVertical: space.lg  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SEMANTIC TINT PALETTES
// Used for icon boxes, info banners, tinted card backgrounds.
// ─────────────────────────────────────────────────────────────────────────────

export const tint = {
  blue:   { bg: "#ECFDF8",           border: "#A7F3D0",             icon: "#0A8A7A",         text: "#065E50"         },
  purple: { bg: "#F0F4FA",           border: "#C7D2E0",             icon: "#0D1B35",         text: "#06101D"         },
  green:  { bg: colors.greenLight,   border: colors.greenBorderAlt, icon: colors.green,      text: colors.greenDark  },
  yellow: { bg: colors.yellowLight,  border: colors.yellowBorder,   icon: colors.yellow,     text: "#854D0E"         },
  red:    { bg: colors.redLight,     border: colors.redBorder,      icon: colors.redDeep,    text: colors.redDark    },
  indigo: { bg: colors.indigoBg,     border: colors.indigoBorder,   icon: colors.indigo,     text: "#3730A3"         },
  amber:  { bg: colors.amberBg,      border: colors.amberBorder,    icon: colors.amber,      text: colors.amberDark  },
  orange: { bg: colors.orangeLight,  border: colors.orangeBorder,   icon: colors.orange,     text: "#C2410C"         },
} as const;

export type TintKey = keyof typeof tint;
