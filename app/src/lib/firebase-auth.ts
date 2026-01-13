"use client";

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  User,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase";

// Sign in with email/password
export const signIn = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (error: unknown) {
    const firebaseError = error as { message: string };
    return { user: null, error: firebaseError.message };
  }
};

// Sign up with email/password
export const signUp = async (email: string, password: string, displayName?: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    return { user: result.user, error: null };
  } catch (error: unknown) {
    const firebaseError = error as { message: string };
    return { user: null, error: firebaseError.message };
  }
};

// Sign in with Google - Tries popup first, falls back to redirect
// Popup works in browser automation, redirect works in embedded browsers
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    // Force account selection every time
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    // Try popup first (works in browser automation and most contexts)
    try {
      const result = await signInWithPopup(auth, provider);
      return { user: result.user, error: null };
    } catch (popupError: unknown) {
      const popupFirebaseError = popupError as { code?: string; message: string };
      // If popup is blocked or fails, fall back to redirect
      if (popupFirebaseError.code === 'auth/popup-blocked' || 
          popupFirebaseError.code === 'auth/popup-closed-by-user' ||
          popupFirebaseError.code === 'auth/cancelled-popup-request') {
        // Use redirect as fallback
        await signInWithRedirect(auth, provider);
        return { user: null, error: null };
      }
      // Re-throw other errors
      throw popupError;
    }
  } catch (error: unknown) {
    const firebaseError = error as { message: string };
    return { user: null, error: firebaseError.message };
  }
};

// Check for redirect result after Google sign-in
// Call this on app initialization (e.g., in AuthContext)
export const checkRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      return { user: result.user, error: null };
    }
    return { user: null, error: null };
  } catch (error: unknown) {
    const firebaseError = error as { message: string };
    return { user: null, error: firebaseError.message };
  }
};

// Sign out
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    return { error: null };
  } catch (error: unknown) {
    const firebaseError = error as { message: string };
    return { error: firebaseError.message };
  }
};

// Auth state listener
export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};

