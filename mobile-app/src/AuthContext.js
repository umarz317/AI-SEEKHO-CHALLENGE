import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getAuth, getIdToken, onAuthStateChanged, signOut } from '@react-native-firebase/auth';
import { registerForceLogout } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (fbUser) => {
      setUser(fbUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const idToken = async () => {
    if (!user) return null;
    try {
      return await getIdToken(user);
    } catch {
      return null;
    }
  };

  const logout = async () => {
    await signOut(getAuth());
  };

  const forceLogout = useCallback(async (message) => {
    setToastMessage(message || 'Session expired. Please sign in again.');
    try {
      await signOut(getAuth());
    } catch {
      // already signed out
    }
  }, []);

  // Register with the API layer so it can trigger logout on 401
  useEffect(() => {
    registerForceLogout(forceLogout);
  }, [forceLogout]);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, idToken, logout, forceLogout, toastMessage, clearToast }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

