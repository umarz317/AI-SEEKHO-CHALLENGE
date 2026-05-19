import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, getIdToken, onAuthStateChanged, signOut } from '@react-native-firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <AuthContext.Provider value={{ user, loading, idToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
