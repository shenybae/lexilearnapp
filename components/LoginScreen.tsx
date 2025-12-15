
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Modal, Pressable, Alert, StyleSheet } from 'react-native';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from '../firebaseConfig';
import { Brain, Lock, Mail, AlertCircle, Users, ClipboardList, ChevronDown, ShieldCheck } from 'lucide-react-native';
import { Difficulty } from '../types';

interface LoginProps {
  onSignUpClick?: () => void;
  onLoginSuccess: () => void; // New prop for manual navigation trigger
}

export const LoginScreen: React.FC<LoginProps> = ({ onSignUpClick, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Guardian' | 'Admin'>('Guardian');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // 2. Fetch User Profile to verify Role
      const userDocRef = doc(db, "users", uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const dbRole = userData.role || 'Guardian';

        // 3. Strict Role Check
        if (dbRole !== role) {
          // Role mismatch: Force logout
          await signOut(auth);
          setError(`Access Denied. You are registered as a ${dbRole}, but tried to log in as ${role === 'Admin' ? 'an Administrator' : 'a Guardian'}.`);
          setLoading(false);
          return;
        }

        // Role matches -> Call onLoginSuccess to tell App.tsx to navigate
        onLoginSuccess();
        
      } else {
        // Edge case: User in Auth but not in Firestore
        await signOut(auth);
        setError("Account data not found. Please contact support.");
      }

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError('Failed to log in. Please check your connection.');
      }
    } finally {
      // If successful, loading stays true until App.tsx unmounts this screen
      // If error, we set loading false here
      if (auth.currentUser === null) {
        setLoading(false);
      }
    }
  };

  // Function to create/ensure Admin account exists in Auth and Firestore
  const handleSeedAdmin = async () => {
    setLoading(true);
    setError('');
    const adminEmail = "admin@lexilearn.com";
    const adminPass = "admin123";

    const adminProfile = {
        email: adminEmail,
        role: 'Admin',
        status: 'APPROVED',
        childName: 'System Admin',
        assessmentComplete: true,
        assignedDifficulty: Difficulty.MILD,
        progressHistory: []
    };

    try {
        // 1. Try to Create User
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
            // If successful, write to Firestore
            await setDoc(doc(db, "users", userCredential.user.uid), {
                ...adminProfile,
                uid: userCredential.user.uid
            });
            Alert.alert("Success", "Admin account created! Logging in...");
        } catch (createError: any) {
            // 2. If exists, Try to Login
            if (createError.code === 'auth/email-already-in-use') {
                const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPass);
                // Update Firestore to ensure they have Admin role
                await setDoc(doc(db, "users", userCredential.user.uid), {
                    ...adminProfile,
                    uid: userCredential.user.uid
                }, { merge: true });
                console.log("Admin logged in and profile updated.");
            } else {
                throw createError;
            }
        }
    } catch (err: any) {
        console.error("Seed Admin Error:", err);
        Alert.alert("Error", err.message || "Could not initialize admin.");
        setLoading(false); 
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Brain size={48} stroke="#4A90E2" />
          </View>
          <Text style={styles.title}>LexiLearn</Text>
          <Text style={styles.subtitle}>Dyslexia Support Platform</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <AlertCircle size={20} stroke="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Category Picker */}
          <View>
            <Text style={styles.label}>Log in as:</Text>
            <TouchableOpacity 
              onPress={() => setRoleModalVisible(true)}
              style={[styles.inputContainer, { borderColor: role === 'Admin' ? '#4A90E2' : '#E5E7EB' }]}
            >
              <View style={styles.iconPos}>
                {role === 'Admin' ? <ShieldCheck size={20} stroke="#4A90E2" /> : <Users size={20} stroke="#9CA3AF" />}
              </View>
              <Text style={[styles.inputText, role === 'Admin' && { fontWeight: 'bold', color: '#4A90E2' }]}>
                {role === 'Guardian' ? 'Guardian / Student' : 'Administrator'}
              </Text>
              <ChevronDown size={20} stroke="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Role Selection Modal */}
          <Modal visible={roleModalVisible} transparent animationType="fade">
            <Pressable onPress={() => setRoleModalVisible(false)} style={styles.modalOverlay}>
               <View style={styles.modalContent}>
                  <Text style={styles.modalHeader}>Select Account Type</Text>
                  <TouchableOpacity onPress={() => { setRole('Guardian'); setRoleModalVisible(false); }} style={styles.modalItem}>
                    <Users size={24} stroke="#4B5563" style={{marginRight: 12}} />
                    <Text style={styles.modalText}>Guardian / Student</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setRole('Admin'); setRoleModalVisible(false); }} style={[styles.modalItem, {borderBottomWidth: 0}]}>
                    <ShieldCheck size={24} stroke="#4A90E2" style={{marginRight: 12}} />
                    <Text style={styles.modalText}>Administrator</Text>
                  </TouchableOpacity>
               </View>
            </Pressable>
          </Modal>

          <View>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <View style={styles.iconPos}>
                <Mail size={20} stroke="#9CA3AF" />
              </View>
              <TextInput 
                value={email}
                onChangeText={setEmail}
                style={styles.textInput}
                placeholder="user@lexilearn.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
               <View style={styles.iconPos}>
                 <Lock size={20} stroke="#9CA3AF" />
               </View>
              <TextInput 
                value={password}
                onChangeText={setPassword}
                style={styles.textInput}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
              />
            </View>
          </View>

          <TouchableOpacity 
            onPress={handleLogin} 
            disabled={loading}
            style={styles.loginButton}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginButtonText}>Log In</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.signUpContainer}>
           <TouchableOpacity 
             onPress={onSignUpClick}
             style={styles.signUpButton}
           >
              <ClipboardList size={20} stroke="#7E22CE" /> 
              <Text style={styles.signUpText}>Don't have an account? Apply Here</Text>
           </TouchableOpacity>
        </View>

        {/* Seed Admin Button */}
        <TouchableOpacity 
          onPress={handleSeedAdmin}
          style={styles.seedButton}
        >
          <ShieldCheck size={18} stroke="#4B5563" />
          <Text style={styles.seedButtonText}>Initialize Admin Account</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Guardians must be approved by an Admin.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFBF7',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    width: '100%',
    borderWidth: 2,
    borderColor: 'rgba(74, 144, 226, 0.2)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    padding: 16,
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#2D2D2D',
  },
  subtitle: {
    color: '#6B7280',
    marginTop: 4,
  },
  form: {
    gap: 16,
  },
  errorBox: {
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#DC2626',
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    position: 'relative',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 48,
    paddingRight: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  iconPos: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  inputText: {
    flex: 1,
    color: '#1F2937',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 384,
    overflow: 'hidden',
  },
  modalHeader: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
    color: '#9CA3AF',
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalItem: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalText: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#374151',
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  textInput: {
    width: '100%',
    paddingLeft: 48,
    paddingRight: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    color: '#1F2937',
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  loginButton: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  signUpContainer: {
    marginTop: 24,
  },
  signUpButton: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: '#F3E8FF',
    borderWidth: 2,
    borderColor: '#F3E8FF',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signUpText: {
    color: '#7E22CE',
    fontWeight: 'bold',
  },
  seedButton: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
  },
  seedButtonText: {
    color: '#6B7280',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  footerText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    color: '#9CA3AF',
  },
});
