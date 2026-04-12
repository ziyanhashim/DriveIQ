import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  ImageBackground,
  Image,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { apiPost } from "../lib/api";
import { setToken } from "../lib/token";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 940;

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const canLogin = useMemo(() => {
    return identifier.trim().length > 0 && password.trim().length > 0;
  }, [identifier, password]);

  const onLogin = async () => {
    if (!canLogin) return;

    try {
      const res = await apiPost("/auth/login", {
        email: identifier.trim().toLowerCase(),
        password,
      });

      await setToken(res.access_token);
      if (res.user?.name) {
        await AsyncStorage.setItem("driveiq_user_name", res.user.name);
      }
      if (res.user?.role) {
        await AsyncStorage.setItem("driveiq_user_role", res.user.role);
      }

      const backendRole = res.user?.role;

      if (backendRole === "instructor") {
        router.replace("/(instructortabs)/dashboard");
      } else {
        router.replace("/(studenttabs)/dashboard");
      }
    } catch (e: any) {
      Alert.alert("Login failed", e?.message || "Login failed");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={["#0B6A5D", "#0D1B35", "#12324D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bg}
      >
        <View style={styles.bgGlowTop} />
        <View style={styles.bgGlowBottom} />
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isWide ? styles.scrollContentWide : styles.scrollContentStacked,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.shell, isWide ? styles.shellWide : styles.shellStacked]}>
            {/* ── Form (left on wide, bottom on mobile) ── */}
            <View style={[styles.formPanel, isWide ? styles.formPanelWide : styles.formPanelStacked]}>
              <View style={styles.logoWrap}>
                <Image source={require("../assets/drive-iq-logo-darkblue.png")} style={styles.logoImg} />
                <Text style={styles.logoLabel}>DriveIQ</Text>
              </View>

              <Text style={styles.h1}>Welcome Back</Text>
              <Text style={styles.cardSubtitle}>Log in to access your dashboard</Text>

              <Text style={[styles.label, { marginTop: 28 }]}>Email</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="Enter your email"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>

              <Text style={[styles.label, styles.labelSpacing]}>Password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  style={styles.input}
                />
              </View>

              <View style={styles.rememberRow}>
                <Pressable
                  onPress={() => setRemember((v) => !v)}
                  style={styles.checkboxRow}
                >
                  <View style={[styles.checkbox, remember && styles.checkboxOn]}>
                    {remember ? <Text style={styles.checkMark}>✓</Text> : null}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </Pressable>
              </View>

              <Pressable
                disabled={!canLogin}
                onPress={onLogin}
                style={[styles.loginBtn, !canLogin && styles.loginBtnDisabled]}
              >
                <LinearGradient
                  colors={!canLogin ? ["#7C8AA5", "#667085"] : ["#0A8A7A", "#07705F"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginBtnFill}
                >
                  <Text style={styles.loginBtnText}>Sign In</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => router.push("/signup")}
                style={styles.registerBtn}
              >
                <Text style={styles.registerPrefix}>Don't have an account?</Text>
                <Text style={styles.registerText}>Register</Text>
              </Pressable>

              <Text style={styles.footer}>© 2025 DriveIQ. All rights reserved.</Text>
            </View>

            {/* ── Image (right on wide, top on mobile) ── */}
            <View style={[styles.mediaPanelOuter, isWide ? styles.mediaPanelOuterWide : styles.mediaPanelOuterStacked]}>
              <ImageBackground
                source={require("../assets/road-bg3.jpg")}
                resizeMode="cover"
                style={styles.mediaPanel}
                imageStyle={styles.mediaImage}
              >
                <LinearGradient
                  colors={["rgba(7,18,35,0.10)", "rgba(7,18,35,0.50)", "rgba(7,18,35,0.75)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.mediaOverlay}
                >
                  <View style={{ flex: 1 }} />
                  <View style={styles.heroBlock}>
                    <Text style={styles.heroText}>Smart driving insights, all in one place.</Text>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0D1B35" },
  bg: { flex: 1 },
  bgGlowTop: {
    position: "absolute",
    top: -140,
    left: -80,
    width: 340,
    height: 340,
    borderRadius: 999,
    backgroundColor: "rgba(10,138,122,0.26)",
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: -140,
    right: -80,
    width: 360,
    height: 360,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  scrollContentWide: {
    justifyContent: "center",
  },
  scrollContentStacked: {
    justifyContent: "flex-start",
  },
  // ── Shell: white rounded container holding both halves ──
  shell: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#06101D",
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  shellWide: {
    flexDirection: "row",
    minHeight: 620,
  },
  shellStacked: {
    flexDirection: "column-reverse",
  },

  // ── Form panel (left on wide) ──
  formPanel: {
    justifyContent: "center",
    padding: 40,
  },
  formPanelWide: {
    flex: 1,
  },
  formPanelStacked: {
    width: "100%",
    padding: 24,
  },

  // ── Logo ──
  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "flex-start",
    marginBottom: 24,
  },
  logoImg: {
    width: 44,
    height: 44,
    resizeMode: "contain",
  },
  logoLabel: {
    color: "#0D1B35",
    fontSize: 22,
    fontFamily: "Sora_700Bold",
    letterSpacing: -0.8,
  },

  // ── Heading ──
  h1: {
    fontSize: 32,
    lineHeight: 38,
    color: "#0D1B35",
    fontFamily: "Sora_800ExtraBold",
    letterSpacing: -1,
  },
  cardSubtitle: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Sora_400Regular",
    marginTop: 6,
  },

  // ── Form fields ──
  label: {
    color: "#0D1B35",
    fontSize: 12,
    fontFamily: "Sora_600SemiBold",
    letterSpacing: -0.1,
    marginBottom: 8,
  },
  labelSpacing: { marginTop: 16 },
  inputWrap: {
    backgroundColor: "#F4F6F8",
    borderWidth: 1,
    borderColor: "#E8ECF0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    color: "#0D1B35",
    fontSize: 15,
    fontFamily: "Sora_500Medium",
  },

  // ── Remember me ──
  rememberRow: {
    marginTop: 16,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxRow: { flexDirection: "row", alignItems: "center" },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#D0D5DD",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxOn: {
    backgroundColor: "#0A8A7A",
    borderColor: "#0A8A7A",
  },
  checkMark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Sora_800ExtraBold",
  },
  rememberText: {
    fontSize: 13,
    color: "#334155",
    fontFamily: "Sora_500Medium",
  },

  // ── Sign in button ──
  loginBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnFill: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Sora_700Bold",
    letterSpacing: -0.2,
  },

  // ── Register link ──
  registerBtn: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  registerPrefix: {
    color: "#64748B",
    fontSize: 12,
    fontFamily: "Sora_400Regular",
  },
  registerText: {
    color: "#0A8A7A",
    fontSize: 12,
    fontFamily: "Sora_700Bold",
  },

  // ── Footer ──
  footer: {
    marginTop: 24,
    color: "#94A3B8",
    fontSize: 11,
    fontFamily: "SpaceMono_400Regular",
    letterSpacing: 0.5,
    textAlign: "center",
  },

  // ── Image panel (right on wide) ──
  mediaPanelOuter: {
    padding: 8,
  },
  mediaPanelOuterWide: {
    flex: 1,
  },
  mediaPanelOuterStacked: {
    width: "100%",
    minHeight: 220,
  },
  mediaPanel: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 22,
  },
  mediaImage: {
    borderRadius: 22,
    width: "100%",
    height: "100%",
  },
  mediaOverlay: {
    flex: 1,
    padding: 24,
    justifyContent: "flex-end",
  },
  heroBlock: {
    maxWidth: 320,
  },
  heroText: {
    fontSize: 18,
    lineHeight: 26,
    color: "#FFFFFF",
    fontFamily: "Sora_700Bold",
    letterSpacing: -0.3,
  },
});
