import React, { useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";

type Role = "student" | "instructor";

export default function ConsentScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const role = (params.role as Role) || "student";

  const [agreed, setAgreed] = useState(false);

  const canContinue = useMemo(() => agreed, [agreed]);

  const onContinue = () => {
    if (!canContinue) return;

    if (role === "student") {
      router.replace("/(studenttabs)/dashboard");
      return;
    }

    router.replace("/(instructortabs)/dashboard");
  };

  return (
    <SafeAreaView style={s.safe}>
      <LinearGradient
        colors={["#0B6A5D", "#0D1B35", "#12324D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.bg}
      >
        <View style={s.bgGlowTop} />
        <View style={s.bgGlowBottom} />

        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.shell}>
            {/* Logo */}
            <View style={s.logoWrap}>
              <LinearGradient
                colors={["#0D1B35", "#1A2F55"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.logoCircle}
              >
                <Text style={s.logoText}>DI</Text>
              </LinearGradient>
            </View>

            <Text style={s.h1}>Recording Consent</Text>
            <Text style={s.subtitle}>
              DriveIQ records video and audio during real driving lessons for quality
              assurance. Recordings are stored securely and are accessible only by
              managers.
            </Text>

            {/* Toggle card */}
            <View style={s.toggleCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleTitle}>I understand and agree</Text>
                <Text style={s.toggleSub}>
                  You must agree before continuing.
                </Text>
              </View>

              <Switch
                value={agreed}
                onValueChange={setAgreed}
                trackColor={{ false: "#D0D5DD", true: "#0A8A7A" }}
                thumbColor={Platform.OS === "android" ? "#FFFFFF" : undefined}
              />
            </View>

            {/* Action */}
            <Pressable
              onPress={onContinue}
              disabled={!canContinue}
              style={[s.primaryBtn, !canContinue && { opacity: 0.5 }]}
            >
              <LinearGradient
                colors={canContinue ? ["#0A8A7A", "#07705F"] : ["#7C8AA5", "#667085"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.primaryBtnFill}
              >
                <Text style={s.primaryBtnText}>Accept & Continue</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => router.replace("/")}
              style={s.linkBtn}
            >
              <Text style={s.linkText}>Back to Login</Text>
            </Pressable>

            {/* Privacy helper */}
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Privacy Note",
                  "This is a mock consent screen. Hook to backend/legal text later."
                )
              }
              style={s.helperBtn}
            >
              <Text style={s.helperText}>View Privacy Details</Text>
            </Pressable>

            <Text style={s.footer}>© 2025 DriveIQ. All rights reserved.</Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0D1B35" },
  bg: { flex: 1 },
  bgGlowTop: {
    position: "absolute", top: -140, left: -80,
    width: 340, height: 340, borderRadius: 999,
    backgroundColor: "rgba(10,138,122,0.26)",
  },
  bgGlowBottom: {
    position: "absolute", bottom: -140, right: -80,
    width: 360, height: 360, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: "center",
  },

  shell: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    shadowColor: "#06101D",
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },

  logoWrap: { alignSelf: "flex-start", marginBottom: 20 },
  logoCircle: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF", fontSize: 18,
    fontFamily: "Sora_800ExtraBold", letterSpacing: -0.8,
  },

  h1: {
    fontSize: 24, lineHeight: 30,
    color: "#0D1B35", fontFamily: "Sora_800ExtraBold",
    letterSpacing: -0.6, marginBottom: 10,
  },
  subtitle: {
    fontSize: 13, color: "#64748B",
    fontFamily: "Sora_500Medium", lineHeight: 20,
    marginBottom: 20,
  },

  toggleCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#F8FAFC", borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: "#E8ECF0",
    marginBottom: 20,
  },
  toggleTitle: {
    fontSize: 14, fontFamily: "Sora_700Bold", color: "#0D1B35",
  },
  toggleSub: {
    marginTop: 4, fontSize: 12, color: "#64748B",
    fontFamily: "Sora_500Medium", lineHeight: 17,
  },

  primaryBtn: { borderRadius: 14, overflow: "hidden" },
  primaryBtnFill: {
    paddingVertical: 16, alignItems: "center", justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF", fontFamily: "Sora_700Bold",
    fontSize: 15, letterSpacing: -0.2,
  },

  linkBtn: { marginTop: 16, alignItems: "center", paddingVertical: 10 },
  linkText: { color: "#64748B", fontFamily: "Sora_600SemiBold", fontSize: 13 },

  helperBtn: { marginTop: 8, alignSelf: "center", paddingVertical: 8, paddingHorizontal: 12 },
  helperText: { color: "#0A8A7A", fontFamily: "Sora_700Bold", fontSize: 12 },

  footer: {
    marginTop: 16, color: "#94A3B8", fontSize: 11,
    fontFamily: "SpaceMono_400Regular", letterSpacing: 0.5,
    textAlign: "center",
  },
});
