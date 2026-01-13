
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Modal, Pressable, Alert, StyleSheet } from 'react-native';
import { auth, db, signInWithEmailAndPassword, signOut, doc, getDoc, collection, query, where, getDocs } from '../firebaseConfig';
import { Brain, Lock, Mail, AlertCircle, Users, ClipboardList, ChevronDown, ShieldCheck } from 'lucide-react-native';
import { UserProfile, Difficulty } from '../types';

interface LoginProps {
  onSignUpClick?: () => void;
  onLoginSuccess: (user?: UserProfile) => void;
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
      setError("Please enter both email/username and password.");
      return;
    }

    setLoading(true);
    setError('');

    let loginIdentifier = email.trim();
    const cleanedPassword = password.trim();

    // 0. Username Resolution for Guardians
    // If input does not contain '@' and role is Guardian, try to find email by username
    if (role === 'Guardian' && !loginIdentifier.includes('@')) {
        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("username", "==", loginIdentifier));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                setError("Username not found.");
                setLoading(false);
                return;
            }
            
            const userData = snapshot.docs[0].data() as UserProfile;
            if (userData.email) {
                loginIdentifier = userData.email;
            }
        } catch (err: any) {
            console.error("Username lookup failed", err);
            // If offline or permission issue, we can't look up username.
            // But we will let it fail at authentication step or show specific error.
            if (err.code === 'permission-denied') {
                setError("Connection error. Please check internet.");
                setLoading(false);
                return;
            }
        }
    }

    if (role === 'Admin') {
        let manualLoginSuccess = false;
        
        // 1. Try Manual Firestore Check (Requested Feature)
        try {
            console.log(`Attempting Manual Admin Login for: ${loginIdentifier}`);
            const adminsRef = collection(db, "admin");
            // Exact match query
            const q = query(adminsRef, where("email", "==", loginIdentifier), where("password", "==", cleanedPassword));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                console.log("Manual Admin Document Found!");
                // SUCCESS: Verified against Firestore credentials
                const adminProfile: UserProfile = {
                    uid: 'admin_manual_' + Date.now(),
                    email: loginIdentifier,
                    childName: 'Administrator',
                    role: 'Admin',
                    status: 'APPROVED',
                    assessmentComplete: true,
                    assignedDifficulty: Difficulty.MILD
                };
                onLoginSuccess(adminProfile);
                return; 
            } else {
                console.log("Manual Admin Check: No document matched.");
            }
        } catch (err: any) {
            // If permission denied, it means rules haven't updated or restrict public access.
            // We ignore this specific error and fall back to Standard Auth.
            if (err.code !== 'permission-denied') {
                console.warn("Manual check error:", err);
            } else {
                console.log("Manual check skipped due to permissions. Falling back to Auth.");
            }
        }

        // 2. Standard Firebase Auth Fallback
        try {
            console.log("Attempting Firebase Auth Login...");
            await signInWithEmailAndPassword(auth, loginIdentifier, cleanedPassword);
            
            // Verify if this email is in the admin whitelist
            const adminsRef = collection(db, "admin");
            const qAuth = query(adminsRef, where("email", "==", loginIdentifier));
            
            try {
                const snapAuth = await getDocs(qAuth);
                if (snapAuth.empty) {
                    await signOut(auth);
                    setError("Access Denied. Email not found in admin list.");
                    setLoading(false);
                    return;
                }
            } catch (permErr) {
                console.warn("Could not verify admin list membership due to permissions.", permErr);
            }

            // Auth success
            const adminProfileAuth: UserProfile = {
                  uid: auth.currentUser?.uid || 'admin_auth',
                  email: loginIdentifier,
                  childName: 'Administrator',
                  role: 'Admin',
                  status: 'APPROVED',
                  assessmentComplete: true,
                  assignedDifficulty: Difficulty.MILD
            };
            onLoginSuccess(adminProfileAuth);

        } catch (err: any) {
            console.error("Admin Login Error", err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                setError("Invalid admin credentials. Please check your email and password.");
            } else if (err.code === 'permission-denied') {
                setError("Database Permission Error. Please check security rules.");
            } else {
                setError("Login failed. Please check your connection.");
            }
            setLoading(false);
        }
    } else {
        // Guardian Login (Standard Flow)
        try {
          // 1. Authenticate
          const userCredential = await signInWithEmailAndPassword(auth, loginIdentifier, cleanedPassword);
          const uid = userCredential.user.uid;

          // 2. Verify User Profile
          const userDocRef = doc(db, "users", uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const userData = userSnap.data() as UserProfile;
            const dbRole = userData.role || 'Guardian';

            if (dbRole !== 'Guardian') {
              await signOut(auth);
              setError(`Access Denied. Account role is ${dbRole}, but tried to log in as Guardian.`);
              setLoading(false);
              return;
            }
            
            // --- STRICT STATUS CHECKS ---
            // If REJECTED, block login.
            if (userData.status === 'REJECTED') {
                await signOut(auth);
                Alert.alert("Access Denied", "Your application has been rejected by the administrator.");
                setError("Account application rejected.");
                setLoading(false);
                return;
            }

            // If PENDING, block login and show alert.
            if (userData.status === 'PENDING') {
                await signOut(auth);
                Alert.alert(
                    "Application Pending", 
                    "Your account is waiting for administrator approval.\n\nYou will receive an email once approved. Please try again later."
                );
                setError("Account pending approval.");
                setLoading(false);
                return;
            }

            // Success - Only reach here if APPROVED
            onLoginSuccess(userData);
            
          } else {
            // Document missing?
            await signOut(auth);
            setError("Account data not found. Please contact support.");
            setLoading(false);
          }

        } catch (err: any) {
          console.error(err);
          if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
            setError('Invalid credentials.');
          } else if (err.code === 'auth/invalid-email') {
            setError('Please enter a valid email address.');
          } else {
            setError('Failed to log in. Please check your connection.');
          }
          setLoading(false);
        }
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Brain size={48} {...({color: "#4A90E2"} as any)} />
          </View>
          <Text style={styles.title}>LexiLearn</Text>
          <Text style={styles.subtitle}>Dyslexia Support Platform</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <AlertCircle size={20} {...({color: "#DC2626"} as any)} />
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
                {role === 'Admin' ? <ShieldCheck size={20} {...({color: "#4A90E2"} as any)} /> : <Users size={20} {...({color: "#9CA3AF"} as any)} />}
              </View>
              <Text style={[styles.inputText, role === 'Admin' && { fontWeight: 'bold', color: '#4A90E2' }]}>
                {role === 'Guardian' ? 'Guardian' : 'Administrator'}
              </Text>
              <ChevronDown size={20} {...({color: "#9CA3AF"} as any)} />
            </TouchableOpacity>
          </View>

          {/* Role Selection Modal */}
          <Modal visible={roleModalVisible} transparent animationType="fade">
            <Pressable onPress={() => setRoleModalVisible(false)} style={styles.modalOverlay}>
               <View style={styles.modalContent}>
                  <Text style={styles.modalHeader}>Select Account Type</Text>
                  <TouchableOpacity onPress={() => { setRole('Guardian'); setRoleModalVisible(false); }} style={styles.modalItem}>
                    <View style={{marginRight: 12}}>
                        <Users size={24} {...({color: "#4B5563"} as any)} />
                    </View>
                    <Text style={styles.modalText}>Guardian</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setRole('Admin'); setRoleModalVisible(false); }} style={[styles.modalItem, {borderBottomWidth: 0}]}>
                    <View style={{marginRight: 12}}>
                        <ShieldCheck size={24} {...({color: "#4A90E2"} as any)} />
                    </View>
                    <Text style={styles.modalText}>Administrator</Text>
                  </TouchableOpacity>
               </View>
            </Pressable>
          </Modal>

          <View>
            <Text style={styles.label}>Email or Username</Text>
            <View style={styles.inputWrapper}>
              <View style={styles.iconPos}>
                <Mail size={20} {...({color: "#9CA3AF"} as any)} />
              </View>
              <TextInput 
                value={email}
                onChangeText={setEmail}
                style={styles.textInput}
                placeholder="Email or Username"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
               <View style={styles.iconPos}>
                 <Lock size={20} {...({color: "#9CA3AF"} as any)} />
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
              <ClipboardList size={20} {...({color: "#7E22CE"} as any)} /> 
              <Text style={styles.signUpText}>Don't have an account? Apply Here</Text>
           </TouchableOpacity>
        </View>

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
  footerText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
    color: '#9CA3AF',
  },
});
