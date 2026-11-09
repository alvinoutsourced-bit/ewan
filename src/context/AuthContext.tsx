import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  isAdmin: boolean;
  isGuard: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, fullName: string, requestedRole: UserRole) => Promise<void>;
  loginAsDemoGuard: () => void;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const isAllowedAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized === 'alvindelacruz917@gmail.com' ||
    normalized === 'alvindelacruz917' ||
    normalized.startsWith('alvindelacruz917@')
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [demoGuard, setDemoGuard] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('demo_guard_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Fetch or create user profile in Firestore
  const syncUserProfile = async (firebaseUser: User) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      const isAdminUser = isAllowedAdmin(firebaseUser.email);

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        
        // Strict role enforcement: Only alvindelacruz917 can have role ADMIN.
        // If an existing profile was marked ADMIN but email is not alvindelacruz917, force to GUARD!
        const correctRole: UserRole = isAdminUser ? 'ADMIN' : 'GUARD';

        if (data.role !== correctRole) {
          const updated: UserProfile = { ...data, role: correctRole };
          await setDoc(userRef, updated, { merge: true });
          setUserProfile(updated);
        } else {
          setUserProfile(data);
        }
      } else {
        // Create initial profile for new user.
        // Google sign-in or registration defaults strictly to GUARD unless email is alvindelacruz917.
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          fullName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Guard Officer',
          email: firebaseUser.email || '',
          role: isAdminUser ? 'ADMIN' : 'GUARD',
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
      }
    } catch (err) {
      console.warn('Failed to sync user profile with Firestore, using in-memory state:', err);
      const isAdminUser = isAllowedAdmin(firebaseUser.email);
      setUserProfile({
        uid: firebaseUser.uid,
        fullName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Staff User',
        email: firebaseUser.email || '',
        role: isAdminUser ? 'ADMIN' : 'GUARD',
        status: 'ACTIVE'
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setDemoGuard(null);
        localStorage.removeItem('demo_guard_user');
        await syncUserProfile(currentUser);
      } else {
        if (!demoGuard) {
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogleHandler = async () => {
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await syncUserProfile(res.user);
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmailHandler = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      await syncUserProfile(res.user);
    } catch (err: any) {
      console.error('Email sign-in failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmailHandler = async (
    email: string, 
    pass: string, 
    fullName: string, 
    _requestedRole: UserRole
  ) => {
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      if (fullName) {
        await updateProfile(res.user, { displayName: fullName });
      }
      const isAdminUser = isAllowedAdmin(email);
      const newProfile: UserProfile = {
        uid: res.user.uid,
        fullName: fullName || email.split('@')[0],
        email: email,
        role: isAdminUser ? 'ADMIN' : 'GUARD',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', res.user.uid), newProfile);
      setUserProfile(newProfile);
    } catch (err: any) {
      console.error('Sign-up failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginAsDemoGuard = () => {
    const demoProfile: UserProfile = {
      uid: 'guard_demo_session_01',
      fullName: 'Gate Guard Officer',
      email: 'guard@marhs.edu.ph',
      role: 'GUARD',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    setDemoGuard(demoProfile);
    setUserProfile(demoProfile);
    localStorage.setItem('demo_guard_user', JSON.stringify(demoProfile));
  };

  const signOutUserHandler = async () => {
    setLoading(true);
    try {
      if (user) {
        await signOut(auth);
      }
      setDemoGuard(null);
      localStorage.removeItem('demo_guard_user');
      setUser(null);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const activeEmail = userProfile?.email || user?.email || (demoGuard ? demoGuard.email : null);
  const isAdmin = isAllowedAdmin(activeEmail);
  const currentRole: UserRole = isAdmin ? 'ADMIN' : 'GUARD';
  const isGuard = true; // All authenticated users have access to guard scanner mode

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile: userProfile || demoGuard,
        role: currentRole,
        loading,
        isAdmin,
        isGuard,
        signInWithGoogle: signInWithGoogleHandler,
        signInWithEmail: signInWithEmailHandler,
        signUpWithEmail: signUpWithEmailHandler,
        loginAsDemoGuard,
        signOutUser: signOutUserHandler
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
