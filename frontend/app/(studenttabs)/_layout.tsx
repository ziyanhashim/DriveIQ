import React, { useState, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet, SafeAreaView, Modal, Image,
} from "react-native";
import { router, usePathname, useGlobalSearchParams } from "expo-router";
import { Slot } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearToken } from "../../lib/token";
import { colors, type_, radius, space, shadow, fonts } from "../../lib/theme";

const TABS = [
  { name: "dashboard", label: "Dashboard" },
  { name: "sessions",  label: "Sessions" },
  { name: "reports",   label: "Reports" },
  { name: "profile",   label: "Profile" },
  { name: "settings",  label: "Settings" },
] as const;

type TabName = typeof TABS[number]["name"];
const NAV_HEIGHT = 56;

export default function StudentTabsLayout() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userName, setUserName] = useState("Student");
  const [avatarLetter, setAvatarLetter] = useState("S");

  useEffect(() => {
    AsyncStorage.multiGet(["driveiq_user_name", "driveiq_user_role"]).then(([[, name], [, role]]) => {
      if (name) { setUserName(name); setAvatarLetter(name.charAt(0).toUpperCase()); }
      if (role === "instructor") {
        router.replace("/(instructortabs)/dashboard" as any);
      } else if (!role) {
        // No role stored — not logged in, go to login
        router.replace("/");
      }
    });
  }, []);

  const { from } = useGlobalSearchParams<{ from?: string }>();

  // Map sub-routes to their parent tab
  const activeTab: TabName = (() => {
    if (pathname.includes("session-report")) {
      if (from === "reports") return "reports";
      return "dashboard";
    }
    return (TABS.find((t) => pathname.includes(t.name))?.name as TabName) ?? "dashboard";
  })();

  const navigate = (tab: TabName) => {
    setMenuOpen(false);
    setUserDropdownOpen(false);
    router.push(`/(studenttabs)/${tab}` as any);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.navbar}>
        {/* Logo */}
        <Pressable onPress={() => navigate("dashboard")} style={s.logoWrap}>
          <Image source={require("../../assets/drive-iq-logo.png")} style={s.logoImg} />
          <Text style={s.logoLabel}>DriveIQ</Text>
        </Pressable>

        {/* Desktop tabs */}
        <View style={s.tabsRow}>
          {TABS.map((tab) => {
            const active = activeTab === tab.name;
            return (
              <Pressable key={tab.name} onPress={() => navigate(tab.name)}
                style={({ pressed }) => [s.tab, active && s.tabActive, pressed && s.tabPressed]}>
                <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* User avatar + dropdown */}
        <View style={{ position: "relative" }}>
          <Pressable style={s.userWrap} onPress={() => setUserDropdownOpen((v) => !v)}>
            <View style={s.avatar}><Text style={s.avatarText}>{avatarLetter}</Text></View>
            <Text style={s.userName}>{userName}</Text>
            <Text style={s.chevron}>⌄</Text>
          </Pressable>

          {userDropdownOpen && (
            <View style={s.userDropdown}>
              {[
                { label: "My Account",     action: () => navigate("profile")  },
                { label: "Profile",        action: () => navigate("profile")  },
                { label: "Settings",       action: () => navigate("settings") },
                { label: "Help & Support", action: () => {}                    },
                { label: "Sign Out", action: async () => {
                    await clearToken();
                    await AsyncStorage.multiRemove(["driveiq_user_name","driveiq_user_email","driveiq_user_mobile","driveiq_user_role"]);
                    router.replace("/");
                  }
                },
              ].map((item, i, arr) => (
                <Pressable key={item.label}
                  onPress={() => { setUserDropdownOpen(false); item.action(); }}
                  style={({ pressed }) => [
                    s.ddItem,
                    i < arr.length - 1 && s.ddItemBorder,
                    item.label === "Sign Out" && s.ddSignOut,
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Text style={[s.ddText, item.label === "Sign Out" && s.ddSignOutText]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Mobile hamburger */}
        <Pressable style={s.hamburger} onPress={() => setMenuOpen(true)}>
          <View style={s.hamburgerLine} /><View style={s.hamburgerLine} /><View style={s.hamburgerLine} />
        </Pressable>
      </View>

      {/* Mobile Menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setMenuOpen(false)}>
          <View style={s.mobileMenu}>
            {TABS.map((tab) => {
              const active = activeTab === tab.name;
              return (
                <Pressable key={tab.name} onPress={() => navigate(tab.name)}
                  style={[s.mobileItem, active && s.mobileItemActive]}>
                  <Text style={[s.mobileLabel, active && s.mobileLabelActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <View style={s.content}><Slot /></View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.pageBg, overflow: "visible" },

  navbar:  {
    height: NAV_HEIGHT,
    backgroundColor: colors.darkBg,
    borderBottomWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    gap: space.sm,
    overflow: "visible",
    zIndex: 50,
    ...shadow.navbar,
  },

  // Logo
  logoWrap:  { flexDirection: "row", alignItems: "center", gap: space.sm, marginRight: space.md },
  logoImg:   { width: 46, height: 46, resizeMode: "contain" },
  logoLabel: { color: "#FFFFFF", fontFamily: fonts.extrabold, fontSize: 15, letterSpacing: -0.3 },

  // Tabs
  tabsRow:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  tab:           { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.sm },
  tabActive:     {},
  tabPressed:    { opacity: 0.7 },
  tabLabel:      { fontSize: 13, fontFamily: fonts.semibold, color: "rgba(255,255,255,0.5)", userSelect: "none" },
  tabLabelActive:{ color: colors.blue, fontFamily: fonts.bold, fontSize: 13, userSelect: "none" },

  // User pill
  userWrap:   { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.sm, paddingVertical: 6, borderRadius: radius.sm },
  avatar:     { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 12 },
  userName:   { fontSize: 13, fontFamily: fonts.semibold, color: "rgba(255,255,255,0.85)" },
  chevron:    { fontSize: 12, color: "rgba(255,255,255,0.5)" },

  // Hamburger
  hamburger:     { padding: space.sm, gap: 4, display: "none" },
  hamburgerLine: { width: 20, height: 2, backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 2 },

  // Mobile modal
  overlay:         { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-start", alignItems: "flex-end", paddingTop: NAV_HEIGHT + 8, paddingRight: space.lg },
  mobileMenu:      { backgroundColor: colors.cardBg, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, minWidth: 200, overflow: "hidden", ...shadow.dropdown },
  mobileItem:      { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: space.xl, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderFaint },
  mobileItemActive:{ backgroundColor: colors.blueLight },
  mobileIcon:      { fontSize: 16, color: colors.subtext },
  mobileLabel:     { fontSize: 14, fontFamily: fonts.semibold, color: colors.label, userSelect: "none" },
  mobileLabelActive:{ color: colors.blue, fontFamily: fonts.bold, userSelect: "none" },

  // Content
  content: { flex: 1, zIndex: 1 },

  // User dropdown
  userDropdown: { position: "absolute", top: 44, right: 0, backgroundColor: colors.cardBg, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, minWidth: 200, zIndex: 999, ...shadow.dropdown },
  ddItem:       { paddingHorizontal: space.xl, paddingVertical: 13 },
  ddItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderFaint },
  ddText:       { fontSize: 14, fontFamily: fonts.semibold, color: colors.label },
  ddSignOut:    { marginTop: 2 },
  ddSignOutText:{ color: colors.redDark, fontFamily: fonts.bold },
});
