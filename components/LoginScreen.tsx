
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Modal, Pressable, StyleSheet } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { Brain, Lock, Mail, AlertCircle, User, Users, ClipboardList, ChevronDown } from 'lucide-react-native';

interface LoginProps {
  onDemoLogin?: (role: 'Guardian' | 'Admin') => void;
  onSignUpClick?: () => void;
}

export const LoginScreen: React.FC<LoginProps> = ({ onDemoLogin, onSignUpClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Guardian' | 'Admin'>('Guardian');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // App.tsx auth listener will handle the rest
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError('Failed to log in. Please check your connection.');
      }
      setLoading(false);
    }
  };

  const handleDemo = () => {
    if (onDemoLogin) {
      onDemoLogin(role);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Brain size={48} color="#4A90E2" />
          </View>
          <Text style={styles.title}>LexiLearn</Text>
          <Text style={styles.subtitle}>Dyslexia Support Platform</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <AlertCircle size={20} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Category Picker */}
          <View>
            <Text style={styles.label}>User Category</Text>
            <TouchableOpacity 
              onPress={() => setRoleModalVisible(true)}
              style={styles.inputContainer}
            >
              <View style={styles.iconPos}>
                <Users size={20} color="#9CA3AF" />
              </View>
              <Text style={styles.inputText}>{role === 'Guardian' ? 'Guardian' : 'Administrator'}</Text>
              <ChevronDown size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Role Selection Modal */}
          <Modal visible={roleModalVisible} transparent animationType="fade">
            <Pressable onPress={() => setRoleModalVisible(false)} style={styles.modalOverlay}>
               <View style={styles.modalContent}>
                  <TouchableOpacity onPress={() => { setRole('Guardian'); setRoleModalVisible(false); }} style={styles.modalItem}>
                    <Text style={styles.modalText}>Guardian</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setRole('Admin'); setRoleModalVisible(false); }} style={styles.modalItem}>
                    <Text style={styles.modalText}>Administrator</Text>
                  </TouchableOpacity>
               </View>
            </Pressable>
          </Modal>

          <View>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <View style={styles.iconPos}>
                <Mail size={20} color="#9CA3AF" />
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
                 <Lock size={20} color="#9CA3AF" />
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
              <ClipboardList size={20} color="#7E22CE" /> 
              <Text style={styles.signUpText}>Don't have an account? Apply Here</Text>
           </TouchableOpacity>
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or test without account</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity 
          onPress={handleDemo}
          style={styles.demoButton}
        >
          <User size={20} color="#66BB6A" />
          <Text style={styles.demoButtonText}>Try Demo {role} Account</Text>
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
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalText: {
    textAlign: 'center',
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
  dividerContainer: {
    marginVertical: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    flex: 1,
  },
  dividerText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  demoButton: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#66BB6A',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  demoButtonText: {
    color: '#66BB6A',
    fontWeight: 'bold',
    fontSize: 18,
  },
  footerText: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 14,
    color: '#9CA3AF',
  },
});
