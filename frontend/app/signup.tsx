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
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import { apiPost } from "../lib/api";
import { setToken } from "../lib/token";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Role = "student" | "instructor";

function isValidMobile(input: string) {
  const cleaned = input.trim();
  if (!cleaned) return false;

  const digitsOnly = cleaned.replace(/^\+/, "").replace(/\D/g, "");
  if (digitsOnly.length < 8 || digitsOnly.length > 15) return false;

  return /^\+?\d+$/.test(cleaned);
}

function isValidEmail(input: string) {
  const v = input.trim().toLowerCase();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function SignupScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  const [role, setRole] = useState<Role>("student");
  const [loading, setLoading] = useState(false);

  // Student fields
  const [name, setName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [mobile, setMobile] = useState("");

  // Instructor fields
  const [email, setEmail] = useState("");
  const [instructorCode, setInstructorCode] = useState("");

  // Shared fields
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Track touched fields
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const studentMobileOk = useMemo(() => isValidMobile(mobile), [mobile]);
  const studentEmailOk = useMemo(() => isValidEmail(studentEmail), [studentEmail]);
  const instructorEmailOk = useMemo(() => isValidEmail(email), [email]);
  const instructorCodeOk = useMemo(() => instructorCode.trim().length >= 4, [instructorCode]);

  const passwordLengthOk = password.length >= 6;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const validationItems = useMemo(() => {
    if (role === "student") {
      return [
        { label: "Full name (2+ chars)",  ok: name.trim().length >= 2 },
        { label: "Valid email",            ok: studentEmailOk },
        { label: "Valid mobile number",    ok: studentMobileOk },
        { label: "Password (min 6 chars)", ok: passwordLengthOk },
        { label: "Passwords match",        ok: passwordsMatch },
      ];
    }
    return [
      { label: "Valid instructor email",     ok: instructorEmailOk },
      { label: "Instructor code (4+ chars)", ok: instructorCodeOk },
      { label: "Password (min 6 chars)",     ok: passwordLengthOk },
      { label: "Passwords match",            ok: passwordsMatch },
    ];
  }, [role, name, studentEmailOk, studentMobileOk, instructorEmailOk, instructorCodeOk, passwordLengthOk, passwordsMatch]);

  const canSignup = useMemo(() => validationItems.every((v) => v.ok), [validationItems]);

  const onSignup = async () => {
    console.log("[Signup] onSignup fired. canSignup:", canSignup);

    if (!canSignup) {
      const failing = validationItems.filter((v) => !v.ok).map((v) => `• ${v.label}`).join("\n");
      Alert.alert("Please fix the following", failing);
      return;
    }

    try {
      setLoading(true);
      const isStudent = role === "student";
      const backendRole = isStudent ? "trainee" : "instructor";

      const payload: any = {
        name: isStudent ? name.trim() : email.trim().split("@")[0] || "Instructor",
        email: (isStudent ? studentEmail : email).trim().toLowerCase(),
        password,
        confirm_password: confirmPassword,
        role: backendRole,
        mobile: isStudent ? mobile.trim() : undefined,
      };

      if (!isStudent) {
        payload.institute_code = instructorCode.trim();
      }

      console.log("[Signup] Sending payload:", JSON.stringify(payload));
      const res = await apiPost("/auth/register", payload);
      console.log("[Signup] Response:", JSON.stringify(res));

      if (res?.access_token) {
        await setToken(res.access_token);
        const savedName = isStudent ? name.trim() : email.trim().split("@")[0];
        await AsyncStorage.setItem("driveiq_user_name", savedName);
        await AsyncStorage.setItem("driveiq_user_email", (isStudent ? studentEmail : email).trim().toLowerCase());
        if (isStudent) {
          await AsyncStorage.setItem("driveiq_user_mobile", mobile.trim());
        }
      }

      router.push({ pathname: "/consent", params: { role } });
    } catch (e: any) {
      console.error("[Signup] Error:", e);
      Alert.alert("Signup failed", e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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
          <View style={[s.shell, isWide && s.shellWide]}>
            {/* Logo */}
            <View style={s.logoWrap}>
              <Image source={require("../assets/drive-iq-logo-darkblue.png")} style={s.logoImg} />
              <Text style={s.logoLabel}>DriveIQ</Text>
            </View>

            <Text style={s.h1}>Create Account</Text>
            <Text style={s.subtitle}>Sign up to start using DriveIQ</Text>

            {/* Role selector */}
            <Text style={[s.label, { marginTop: 24 }]}>Choose Role</Text>
            <View style={s.rolePills}>
              <Pressable
                onPress={() => setRole("student")}
                style={[s.rolePill, role === "student" && s.rolePillActive]}
              >
                {role === "student" ? (
                  <LinearGradient
                    colors={["#0A8A7A", "#07705F"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.rolePillGradient}
                  >
                    <Text style={s.rolePillTextActive}>Student</Text>
                  </LinearGradient>
                ) : (
                  <Text style={s.rolePillText}>Student</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setRole("instructor")}
                style={[s.rolePill, role === "instructor" && s.rolePillActive]}
              >
                {role === "instructor" ? (
                  <LinearGradient
                    colors={["#0A8A7A", "#07705F"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={s.rolePillGradient}
                  >
                    <Text style={s.rolePillTextActive}>Instructor</Text>
                  </LinearGradient>
                ) : (
                  <Text style={s.rolePillText}>Instructor</Text>
                )}
              </Pressable>
            </View>

            {/* Fields */}
            {role === "student" ? (
              <>
                <Text style={s.label}>Full Name</Text>
                <View style={[s.inputWrap, touched.name && name.trim().length < 2 && s.inputError]}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    onBlur={() => touch("name")}
                    placeholder="Enter your full name"
                    placeholderTextColor="#94A3B8"
                    style={s.input}
                  />
                  {touched.name && (name.trim().length >= 2 ? <Text style={s.checkIcon}>✓</Text> : <Text style={s.crossIcon}>✗</Text>)}
                </View>

                <Text style={[s.label, s.labelSpacing]}>Email</Text>
                <View style={[s.inputWrap, touched.studentEmail && !studentEmailOk && s.inputError]}>
                  <TextInput
                    value={studentEmail}
                    onChangeText={setStudentEmail}
                    onBlur={() => touch("studentEmail")}
                    placeholder="Enter your email"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={s.input}
                  />
                  {touched.studentEmail && (studentEmailOk ? <Text style={s.checkIcon}>✓</Text> : <Text style={s.crossIcon}>✗</Text>)}
                </View>

                <Text style={[s.label, s.labelSpacing]}>Mobile Number</Text>
                <View style={[s.inputWrap, touched.mobile && !studentMobileOk && s.inputError]}>
                  <TextInput
                    value={mobile}
                    onChangeText={setMobile}
                    onBlur={() => touch("mobile")}
                    placeholder="e.g. +971501234567"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    style={s.input}
                  />
                  {touched.mobile && (studentMobileOk ? <Text style={s.checkIcon}>✓</Text> : <Text style={s.crossIcon}>✗</Text>)}
                </View>
              </>
            ) : (
              <>
                <Text style={s.label}>Instructor Email</Text>
                <View style={[s.inputWrap, touched.email && !instructorEmailOk && s.inputError]}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    onBlur={() => touch("email")}
                    placeholder="Enter instructor email"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={s.input}
                  />
                  {touched.email && (instructorEmailOk ? <Text style={s.checkIcon}>✓</Text> : <Text style={s.crossIcon}>✗</Text>)}
                </View>

                <Text style={[s.label, s.labelSpacing]}>Instructor Code</Text>
                <View style={[s.inputWrap, touched.instructorCode && !instructorCodeOk && s.inputError]}>
                  <TextInput
                    value={instructorCode}
                    onChangeText={setInstructorCode}
                    onBlur={() => touch("instructorCode")}
                    placeholder="Code provided by your company"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    style={s.input}
                  />
                  {touched.instructorCode && (instructorCodeOk ? <Text style={s.checkIcon}>✓</Text> : <Text style={s.crossIcon}>✗</Text>)}
                </View>
              </>
            )}

            <Text style={[s.label, s.labelSpacing]}>Password</Text>
            <View style={[s.inputWrap, touched.password && !passwordLengthOk && s.inputError]}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                onBlur={() => touch("password")}
                placeholder="Create a password (min 6 chars)"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                style={s.input}
              />
              {touched.password && (passwordLengthOk ? <Text style={s.checkIcon}>✓</Text> : <Text style={s.crossIcon}>✗</Text>)}
            </View>

            <Text style={[s.label, s.labelSpacing]}>Confirm Password</Text>
            <View style={[s.inputWrap, touched.confirmPassword && !passwordsMatch && s.inputError]}>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onBlur={() => touch("confirmPassword")}
                placeholder="Confirm password"
                placeholderTextColor="#94A3B8"
                secureTextEntry
                style={s.input}
              />
              {touched.confirmPassword && (passwordsMatch ? <Text style={s.checkIcon}>✓</Text> : <Text style={s.crossIcon}>✗</Text>)}
            </View>

            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={s.errorText}>Passwords do not match</Text>
            )}

            {/* Validation summary */}
            <View style={s.validationBox}>
              <Text style={s.validationTitle}>Requirements</Text>
              {validationItems.map((item, i) => (
                <View key={i} style={s.validationRow}>
                  <Text style={item.ok ? s.validationCheck : s.validationCross}>
                    {item.ok ? "✓" : "○"}
                  </Text>
                  <Text style={[s.validationLabel, item.ok && s.validationLabelDone]}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* Submit */}
            <Pressable
              onPress={onSignup}
              disabled={loading}
              style={[s.signupBtn, !canSignup && { opacity: 0.6 }]}
            >
              <LinearGradient
                colors={canSignup ? ["#0A8A7A", "#07705F"] : ["#7C8AA5", "#667085"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.signupBtnFill}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.signupBtnText}>
                    {role === "instructor" ? "Create Instructor Account" : "Create Account"}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => router.back()} style={s.linkBtn}>
              <Text style={s.linkPrefix}>Already have an account?</Text>
              <Text style={s.linkText}>Log in</Text>
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
  shellWide: {
    padding: 40,
  },

  logoWrap: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "flex-start", marginBottom: 20 },
  logoImg: { width: 44, height: 44, resizeMode: "contain" },
  logoLabel: { color: "#0D1B35", fontSize: 22, fontFamily: "Sora_700Bold", letterSpacing: -0.5 },

  h1: {
    fontSize: 26, lineHeight: 32,
    color: "#0D1B35", fontFamily: "Sora_800ExtraBold",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: "#64748B", fontSize: 13, lineHeight: 20,
    fontFamily: "Sora_400Regular", marginTop: 6,
  },

  label: {
    color: "#0D1B35", fontSize: 12,
    fontFamily: "Sora_600SemiBold",
    letterSpacing: -0.1, marginBottom: 8,
  },
  labelSpacing: { marginTop: 14 },

  rolePills: { flexDirection: "row", gap: 10, marginBottom: 18 },
  rolePill: {
    flex: 1, borderWidth: 1, borderColor: "#E8ECF0",
    borderRadius: 14, overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  rolePillActive: { borderColor: "#0A8A7A" },
  rolePillGradient: {
    paddingVertical: 12, alignItems: "center",
  },
  rolePillText: {
    fontFamily: "Sora_700Bold", fontSize: 13,
    color: "#344054", textAlign: "center",
    paddingVertical: 12,
  },
  rolePillTextActive: {
    fontFamily: "Sora_700Bold", fontSize: 13, color: "#FFFFFF",
  },

  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F4F6F8", borderWidth: 1,
    borderColor: "#E8ECF0", borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  inputError: { borderColor: "#FCA5A5", backgroundColor: "#FFF5F5" },
  input: { flex: 1, color: "#0D1B35", fontSize: 14, fontFamily: "Sora_500Medium" },
  checkIcon: { color: "#16A34A", fontFamily: "Sora_800ExtraBold", fontSize: 14, marginLeft: 8 },
  crossIcon: { color: "#DC2626", fontFamily: "Sora_800ExtraBold", fontSize: 14, marginLeft: 8 },

  errorText: {
    color: "#DC2626", fontSize: 12, marginTop: 8,
    fontFamily: "Sora_600SemiBold",
  },

  validationBox: {
    marginTop: 18, borderRadius: 14,
    borderWidth: 1, borderColor: "#E8ECF0",
    backgroundColor: "#F8FAFC", padding: 14, gap: 6,
  },
  validationTitle: {
    fontSize: 11, fontFamily: "Sora_700Bold",
    color: "#344054", marginBottom: 4,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  validationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  validationCheck: { fontSize: 13, color: "#16A34A", fontFamily: "Sora_800ExtraBold", width: 16 },
  validationCross: { fontSize: 13, color: "#9CA3AF", fontFamily: "Sora_800ExtraBold", width: 16 },
  validationLabel: { fontSize: 12, fontFamily: "Sora_600SemiBold", color: "#6B7280" },
  validationLabelDone: { color: "#16A34A" },

  signupBtn: { marginTop: 20, borderRadius: 14, overflow: "hidden" },
  signupBtnFill: {
    paddingVertical: 16, alignItems: "center", justifyContent: "center",
  },
  signupBtnText: {
    color: "#FFFFFF", fontFamily: "Sora_700Bold",
    fontSize: 15, letterSpacing: -0.2,
  },

  linkBtn: {
    marginTop: 18, flexDirection: "row",
    justifyContent: "center", alignItems: "center", gap: 6,
  },
  linkPrefix: { color: "#64748B", fontSize: 12, fontFamily: "Sora_400Regular" },
  linkText: { color: "#0A8A7A", fontSize: 12, fontFamily: "Sora_700Bold" },

  footer: {
    marginTop: 20, color: "#94A3B8", fontSize: 11,
    fontFamily: "SpaceMono_400Regular", letterSpacing: 0.5,
    textAlign: "center",
  },
});
