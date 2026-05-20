import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Animated, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth, signInWithPhoneNumber } from '@react-native-firebase/auth';
import { M } from '../src/theme';
import Ic from '../src/components/Ic';
import { useAuth } from '../src/AuthContext';

const COUNTRY = { dial: '+92', flag: '🇵🇰', code: 'PK' };
const OTP_LEN = 6;
const RESEND_SECS = 45;

function safeStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, nestedValue) => {
    if (typeof nestedValue === 'object' && nestedValue !== null) {
      if (seen.has(nestedValue)) return '[Circular]';
      seen.add(nestedValue);
    }
    return nestedValue;
  }, 2);
}

function authErrorDebugPayload(err) {
  if (!err) return null;
  const payload = {};
  const keys = new Set([
    ...Object.keys(err),
    ...Object.getOwnPropertyNames(err),
    'code',
    'message',
    'nativeErrorCode',
    'nativeErrorMessage',
    'nativeErrorName',
    'nativeStackAndroid',
    'stack',
    'userInfo',
  ]);

  keys.forEach((key) => {
    const value = err[key];
    if (typeof value === 'function' || value === undefined) return;
    payload[key] = value;
  });

  return payload;
}

function phoneAuthErrorMessage(err, fallback) {
  if (__DEV__) {
    const payload = authErrorDebugPayload(err);
    console.warn(`[auth] phone sign-in failed\n${safeStringify(payload)}`);
    if (err?.stack) {
      console.warn(`[auth] phone sign-in stack\n${err.stack}`);
    }
  }

  switch (err?.code) {
    case 'auth/invalid-phone-number':
      return 'Invalid phone number. Check the digits and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/quota-exceeded':
      return 'SMS quota is exhausted for this Firebase project.';
    case 'auth/app-not-authorized':
    case 'auth/missing-client-identifier':
    case 'auth/internal-error':
      return 'Firebase phone sign-in is not fully configured for this build. Enable Phone sign-in in Firebase, then rebuild the dev client with the Firebase config files.';
    case 'auth/network-request-failed':
      return 'Network request failed. Check your connection and try again.';
    case 'auth/invalid-verification-code':
      return 'Incorrect code. Please try again.';
    case 'auth/session-expired':
      return 'Code expired. Please request a new one.';
    default:
      return err?.message || fallback;
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(Array(OTP_LEN).fill(''));
  const [confirmResult, setConfirmResult] = useState(null);
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const otpRefs = useRef([]);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(12)).current;

  const { toastMessage, clearToast } = useAuth();
  const [toast, setToast] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Show toast when forceLogout sets a message
  useEffect(() => {
    if (toastMessage) {
      setToast(toastMessage);
      toastOpacity.setValue(0);
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      const timer = setTimeout(() => {
        Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setToast(null);
          clearToast();
        });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    fade.setValue(0);
    slide.setValue(12);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [step]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const fullPhone = `${COUNTRY.dial}${phone.replace(/\D/g, '')}`;

  const sendCode = useCallback(async () => {
    setError(null);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) {
      setError('Please enter a valid phone number.');
      return;
    }
    setLoading(true);
    try {
      const confirmation = await signInWithPhoneNumber(getAuth(), fullPhone);
      setConfirmResult(confirmation);
      setOtp(Array(OTP_LEN).fill(''));
      setStep('code');
      setResendIn(RESEND_SECS);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(phoneAuthErrorMessage(err, 'Failed to send code.'));
    } finally {
      setLoading(false);
    }
  }, [phone, fullPhone]);

  const verifyCode = useCallback(async (codeStr) => {
    setError(null);
    if (codeStr.length < OTP_LEN) {
      setError('Please enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      await confirmResult.confirm(codeStr);
      router.replace('/');
    } catch (err) {
      if (err.code === 'auth/invalid-verification-code') {
        setError(phoneAuthErrorMessage(err, 'Verification failed.'));
        setOtp(Array(OTP_LEN).fill(''));
        otpRefs.current[0]?.focus();
      } else if (err.code === 'auth/session-expired') {
        setError(phoneAuthErrorMessage(err, 'Verification failed.'));
        setStep('phone');
        setConfirmResult(null);
      } else {
        setError(phoneAuthErrorMessage(err, 'Verification failed.'));
      }
    } finally {
      setLoading(false);
    }
  }, [confirmResult, router]);

  const onOtpChange = (idx, val) => {
    const cleaned = val.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, OTP_LEN).split('');
      const next = Array(OTP_LEN).fill('');
      chars.forEach((c, i) => { next[i] = c; });
      setOtp(next);
      const lastIdx = Math.min(chars.length, OTP_LEN) - 1;
      otpRefs.current[lastIdx]?.focus();
      if (chars.length === OTP_LEN) verifyCode(next.join(''));
      return;
    }
    const next = [...otp];
    next[idx] = cleaned;
    setOtp(next);
    if (cleaned && idx < OTP_LEN - 1) otpRefs.current[idx + 1]?.focus();
    if (cleaned && idx === OTP_LEN - 1) verifyCode(next.join(''));
  };

  const onOtpKey = (idx, key) => {
    if (key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
      const next = [...otp];
      next[idx - 1] = '';
      setOtp(next);
    }
  };

  const goBack = () => {
    setStep('phone');
    setOtp(Array(OTP_LEN).fill(''));
    setError(null);
    setConfirmResult(null);
    setResendIn(0);
  };

  const resend = () => {
    if (resendIn > 0 || loading) return;
    sendCode();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: M.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Toast banner */}
      {toast && (
        <Animated.View style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 16, right: 16,
          backgroundColor: '#FEF3C7',
          borderRadius: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: '#FDE68A',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          opacity: toastOpacity,
          zIndex: 100,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 6,
        }}>
          <View style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: '#FDE68A',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ic name="alarm" size={14} color="#92400E" />
          </View>
          <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: '#92400E', lineHeight: 18 }}>
            {toast}
          </Text>
          <Pressable hitSlop={8} onPress={() => {
            Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
              setToast(null);
              clearToast();
            });
          }}>
            <Ic name="close" size={14} color="#92400E" />
          </Pressable>
        </Animated.View>
      )}

      {/* Decorative gradient orb */}
      <View pointerEvents="none" style={{
        position: 'absolute', top: -80, right: -80,
        width: 260, height: 260, borderRadius: 260,
        backgroundColor: M.accentSoft, opacity: 0.6,
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute', top: 80, left: -100,
        width: 200, height: 200, borderRadius: 200,
        backgroundColor: M.agentBg, opacity: 0.5,
      }} />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: insets.top + 32, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header row on code step: back button + brand */}
        {step === 'code' && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 28,
          }}>
            <Pressable
              onPress={goBack}
              hitSlop={12}
              style={({ pressed }) => ({
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: M.surface,
                borderWidth: 1, borderColor: M.border,
                alignItems: 'center', justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Ic name="back" size={18} color={M.text} />
            </Pressable>

            <View style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              <View style={{
                width: 32, height: 32,
                borderRadius: 9,
                backgroundColor: '#FFFFFF',
                alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: M.border,
              }}>
                <Image
                  source={require('../assets/logo.png')}
                  resizeMode="contain"
                  style={{ width: 26, height: 26 }}
                />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: M.text, letterSpacing: -0.3 }}>
                KariGo
              </Text>
            </View>

            {/* Spacer to balance back button width */}
            <View style={{ width: 40 }} />
          </View>
        )}

        {/* Message badge above headline on code step */}
        {step === 'code' && (
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 20,
              backgroundColor: M.accentBg,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1,
              borderColor: M.accentSoft,
            }}>
              <Ic name="msg" size={26} color={M.accentDeep} />
            </View>
          </View>
        )}

        {/* Brand block */}
        {step === 'phone' && (
          <View style={{ alignItems: 'center', marginBottom: 36, marginTop: 24 }}>
            <View style={{
              width: 96, height: 96,
              borderRadius: 24,
              backgroundColor: '#FFFFFF',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
              overflow: 'hidden',
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.12,
              shadowRadius: 20,
              elevation: 6,
              borderWidth: 1,
              borderColor: M.border,
            }}>
              <Image
                source={require('../assets/logo.png')}
                resizeMode="contain"
                style={{ width: 80, height: 80 }}
              />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '800', color: M.text, letterSpacing: -0.5 }}>
              KariGo
            </Text>
            <Text style={{ fontSize: 13, color: M.textMute, marginTop: 4 }}>
              Skilled help, on the go.
            </Text>
          </View>
        )}

        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
          {/* Headline */}
          <Text style={{
            fontSize: 24, fontWeight: '800', color: M.text,
            letterSpacing: -0.4, marginBottom: 6,
            textAlign: step === 'code' ? 'center' : 'left',
          }}>
            {step === 'phone' ? 'Sign in to continue' : 'Verify your number'}
          </Text>
          <Text style={{
            fontSize: 14, color: M.textMute, lineHeight: 20, marginBottom: 28,
            textAlign: step === 'code' ? 'center' : 'left',
          }}>
            {step === 'phone'
              ? 'Enter your phone number and we’ll text you a 6-digit code.'
              : `We sent a 6-digit code to\n${fullPhone}`}
          </Text>

          {/* Error */}
          {error && (
            <View style={{
              backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12,
              borderWidth: 1, borderColor: '#FECACA',
              marginBottom: 16,
              flexDirection: 'row', gap: 10, alignItems: 'flex-start',
            }}>
              <View style={{
                width: 20, height: 20, borderRadius: 10,
                backgroundColor: '#FECACA',
                alignItems: 'center', justifyContent: 'center',
                marginTop: 1,
              }}>
                <Ic name="alarm" size={11} color={M.error} />
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: '#991B1B', lineHeight: 18 }}>{error}</Text>
            </View>
          )}

          {step === 'phone' ? (
            <>
              {/* Label */}
              <Text style={{
                fontSize: 12, fontWeight: '600', color: M.textMute,
                marginBottom: 8, letterSpacing: 0.3,
              }}>
                PHONE NUMBER
              </Text>

              {/* Split phone input: country chip + number */}
              <View style={{
                flexDirection: 'row',
                gap: 10,
                marginBottom: 8,
              }}>
                <View style={{
                  height: 56, paddingHorizontal: 14,
                  backgroundColor: M.surface,
                  borderRadius: 14,
                  borderWidth: 1, borderColor: M.border,
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                }}>
                  <Text style={{ fontSize: 20 }}>{COUNTRY.flag}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: M.text }}>
                    {COUNTRY.dial}
                  </Text>
                </View>

                <View style={{
                  flex: 1,
                  height: 56,
                  backgroundColor: M.surface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: phoneFocused ? M.accent : M.border,
                  paddingHorizontal: 16,
                  justifyContent: 'center',
                }}>
                  <TextInput
                    value={phone}
                    onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={() => setPhoneFocused(false)}
                    placeholder="3001234567"
                    placeholderTextColor={M.textDim}
                    keyboardType="phone-pad"
                    maxLength={11}
                    style={{
                      fontSize: 17, fontWeight: '600',
                      color: M.text, letterSpacing: 0.5,
                    }}
                  />
                </View>
              </View>

              <Text style={{ fontSize: 12, color: M.textDim, marginBottom: 24 }}>
                Standard message rates may apply.
              </Text>

              <TouchableOpacity
                onPress={sendCode}
                disabled={loading || !phone}
                activeOpacity={0.9}
                style={{
                  width: '100%', height: 56,
                  backgroundColor: (loading || !phone) ? M.borderHi : M.accent,
                  borderRadius: 14,
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: 8,
                  shadowColor: M.accent,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: (loading || !phone) ? 0 : 0.3,
                  shadowRadius: 16,
                  elevation: (loading || !phone) ? 0 : 6,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
                      Continue
                    </Text>
                    <Ic name="arrow" size={16} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* OTP boxes */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}>
                {otp.map((d, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { otpRefs.current[i] = r; }}
                    value={d}
                    onChangeText={(v) => onOtpChange(i, v)}
                    onKeyPress={({ nativeEvent }) => onOtpKey(i, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={i === 0 ? OTP_LEN : 1}
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                    selectTextOnFocus
                    style={{
                      width: 48, height: 56,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: d ? M.accent : M.border,
                      backgroundColor: M.surface,
                      textAlign: 'center',
                      fontSize: 22, fontWeight: '700',
                      color: M.text,
                    }}
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={() => verifyCode(otp.join(''))}
                disabled={loading || otp.some((d) => !d)}
                activeOpacity={0.9}
                style={{
                  width: '100%', height: 56,
                  backgroundColor: (loading || otp.some((d) => !d)) ? M.borderHi : M.accent,
                  borderRadius: 14,
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                  shadowColor: M.accent,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: (loading || otp.some((d) => !d)) ? 0 : 0.3,
                  shadowRadius: 16,
                  elevation: (loading || otp.some((d) => !d)) ? 0 : 6,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
                    Verify
                  </Text>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 13, color: M.textMute }}>
                  Didn’t get the code?
                </Text>
                <TouchableOpacity onPress={resend} disabled={resendIn > 0 || loading} hitSlop={8}>
                  <Text style={{
                    fontSize: 13, fontWeight: '700',
                    color: resendIn > 0 ? M.textDim : M.accent,
                  }}>
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>

        {/* Footer */}
        <View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: 32 }}>
          <Text style={{ fontSize: 11, color: M.textDim, textAlign: 'center', lineHeight: 16 }}>
            By continuing, you agree to KariGo’s{'\n'}
            <Text style={{ fontWeight: '600', color: M.textMute }}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={{ fontWeight: '600', color: M.textMute }}>Privacy Policy</Text>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
