
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, StatusBar, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, Difficulty, UserProfile, ProgressRecord } from './types';
import { TRACING_ITEMS, READING_ITEMS, SPELLING_ITEMS, MEMORY_ITEMS } from './constants';
import { TracingActivity } from './components/TracingActivity';
import { ReadingActivity } from './components/ReadingActivity';
import { SpellingActivity } from './components/SpellingActivity';
import { MemoryActivity } from './components/MemoryActivity';
import { AssessmentFlow } from './components/AssessmentFlow';
import { LoginScreen } from './components/LoginScreen';
import { SignUpScreen } from './components/SignUpScreen';
import { ParentDashboard } from './components/ParentDashboard';
import { LearningJourney } from './components/LearningJourney';
import { AdminDashboard } from './components/AdminDashboard';
import { Brain, User, Map as MapIcon, GraduationCap, ArrowLeft, LogOut, PenTool, BookOpen, Keyboard, Zap, ChevronRight, Star, Clock, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { auth, db, onAuthStateChanged, signOut, doc, getDoc, updateDoc, onSnapshot } from './firebaseConfig';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.LOGIN);
  const currentScreenRef = useRef<Screen>(Screen.LOGIN);
  const previousStatusRef = useRef<string | null>(null);

  const [selectedActivityType, setSelectedActivityType] = useState<'TRACING' | 'READING' | 'SPELLING' | 'MEMORY' | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MILD);
  const [connectionStatus, setConnectionStatus] = useState<'ONLINE' | 'OFFLINE_MODE'>('ONLINE');
  const [retryTrigger, setRetryTrigger] = useState(0);

  const setScreen = (screen: Screen) => {
      setCurrentScreen(screen);
      currentScreenRef.current = screen;
  };

  useEffect(() => {
    const checkBackend = async () => {
        try {
            const response = await fetch('https://lexilearnapp.onrender.com');
            if (response.ok) {
                console.log("✅ Backend is UP");
            }
        } catch (error) {
            console.error("❌ Backend error", error);
        }
    };
    checkBackend();
  }, []);

  const saveProfileLocally = async (profile: UserProfile) => {
      try {
          await AsyncStorage.setItem(`user_profile_${profile.uid}`, JSON.stringify(profile));
      } catch (e) {
          console.error("Failed to save profile locally", e);
      }
  };

  const handleSignOut = async () => {
      try {
        if (currentUser) {
            await AsyncStorage.removeItem(`user_profile_${currentUser.uid}`);
        }
        await signOut(auth);
      } catch (e) {
          console.error("Sign out error", e);
      }
      setCurrentUser(null);
      setScreen(Screen.LOGIN);
      previousStatusRef.current = null; // Reset status tracking
  };

  const navigateBasedOnUser = (user: UserProfile) => {
      // 1. Admin Logic
      if (user.role === 'Admin') {
          setScreen(Screen.ADMIN_DASHBOARD);
          return;
      }
      
      // 2. Pending Logic - FORCE LOGOUT
      // We do not allow PENDING users to stay in the app.
      if (user.status === 'PENDING') {
          console.log("User is PENDING. Forcing logout.");
          handleSignOut();
          return;
      }
      
      // 3. Rejected Logic
      if (user.status === 'REJECTED') {
          Alert.alert("Access Denied", "Your account application was rejected.");
          handleSignOut();
          return;
      }

      // 4. Approved Logic
      if (!user.assessmentComplete) {
          // If approved but assessment is not done -> Go to Assessment
          setScreen(Screen.ASSESSMENT);
      } else {
          // If approved and assessment is done -> Go to Home
          setScreen(Screen.HOME);
      }
  };

  const handleRetryConnection = () => {
      setLoading(true);
      setConnectionStatus('ONLINE');
      setRetryTrigger(prev => prev + 1);
  };
  
  const handleLoginSuccess = async (manualUser?: UserProfile) => {
      await AsyncStorage.removeItem('needs_reauth');
      if (manualUser) {
          await saveProfileLocally(manualUser);
          setCurrentUser(manualUser);
          navigateBasedOnUser(manualUser);
      } else {
          if (currentUser) {
              navigateBasedOnUser(currentUser);
          }
      }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user: any) => {
      if (user) {
        setConnectionStatus('ONLINE');
        
        // Initial Local Load
        try {
            const localData = await AsyncStorage.getItem(`user_profile_${user.uid}`);
            if (localData) {
                const parsedUser = JSON.parse(localData) as UserProfile;
                
                // IMPORTANT: If local data says PENDING, force logout immediately.
                if (parsedUser.status === 'PENDING') {
                    // CRITICAL: Allow Sign Up screen to process without interruption
                    if (currentScreenRef.current !== Screen.SIGN_UP) {
                         handleSignOut();
                         setLoading(false);
                         return;
                    }
                }

                if (currentScreenRef.current !== Screen.SIGN_UP) {
                    setCurrentUser(parsedUser);
                    setDifficulty(parsedUser.assignedDifficulty || Difficulty.MILD);
                    previousStatusRef.current = parsedUser.status;

                    if (loading || currentScreen === Screen.LOGIN) {
                        navigateBasedOnUser(parsedUser);
                    }
                }
            }
        } catch (e) {
            console.log("Error loading local data:", e);
        }

        const userDocRef = doc(db, "users", user.uid);
        
        const unsubscribeSnapshot = onSnapshot(userDocRef, async (docSnap: any) => {
          if (docSnap.exists()) {
              const userData = docSnap.data() as UserProfile;
              const currentStatus = userData.status;
              const prevStatus = previousStatusRef.current;

              // --- CRITICAL FIX: HANDLE PENDING -> APPROVED TRANSITION ---
              if (prevStatus === 'PENDING' && currentStatus === 'APPROVED') {
                   console.log("Transition PENDING -> APPROVED detected. Forcing logout.");
                   await handleSignOut();
                   setLoading(false);
                   return;
              }

              // --- CRITICAL FIX: HANDLE EXISTING PENDING ---
              if (currentStatus === 'PENDING') {
                  // NEW: If we are in SIGN_UP screen, ignore this snapshot. 
                  // This allows SignUpScreen to finish writing data before we kill the session.
                  if (currentScreenRef.current === Screen.SIGN_UP) {
                      console.log("In Sign Up flow. Ignoring PENDING status.");
                      return;
                  }

                  console.log("Snapshot detected PENDING status. Forcing logout.");
                  await handleSignOut();
                  setLoading(false);
                  return;
              }

              // --- NORMAL FLOW (APPROVED / REJECTED) ---
              setCurrentUser(userData);
              setDifficulty(userData.assignedDifficulty || Difficulty.MILD);
              saveProfileLocally(userData);
              previousStatusRef.current = currentStatus;

              if (loading) {
                  navigateBasedOnUser(userData);
              } else {
                 if (currentStatus === 'REJECTED') {
                     handleSignOut();
                     Alert.alert("Access Revoked", "Your account has been rejected.");
                 }
              }
              setLoading(false);
          } else {
             // Doc missing
             // CRITICAL FIX FOR SIGN UP:
             // If we are currently in SIGN_UP screen, this is expected behavior during creation.
             if (currentScreenRef.current === Screen.SIGN_UP) {
                 console.log("User doc missing during Sign Up. Allowing creation to proceed.");
                 return;
             }

             // Otherwise, treat as missing/error
             console.log("User doc missing and not in Sign Up. Signing out.");
             await handleSignOut();
             setLoading(false);
          }
        }, (error: any) => {
           console.warn("Firestore Read Error:", error.code);
           if (error.code === 'permission-denied') {
               setConnectionStatus('OFFLINE_MODE');
               if (currentUser && currentUser.status === 'APPROVED') {
                   setLoading(false);
               } else {
                   handleSignOut();
                   setLoading(false);
               }
           } else {
               setLoading(false);
           }
        });

        return () => unsubscribeSnapshot();
      } else {
        if (currentUser && currentUser.uid.startsWith('admin_manual_')) {
            setLoading(false);
        } else {
            setCurrentUser(null);
            setScreen(Screen.LOGIN);
            setLoading(false);
            previousStatusRef.current = null;
        }
      }
    });

    return unsubscribeAuth;
  }, [retryTrigger]);

  const handleActivityComplete = async (type: 'Tracing' | 'Reading' | 'Spelling' | 'Memory', score: number) => {
      const newRecord: ProgressRecord = {
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          activityType: type,
          score: score,
          details: `${type} Activity`
      };

      if (currentUser) {
          const updatedHistory = [...(currentUser.progressHistory || []), newRecord];
          const updatedUser = { ...currentUser, progressHistory: updatedHistory };
          setCurrentUser(updatedUser);
          saveProfileLocally(updatedUser);

          try {
              if (connectionStatus === 'ONLINE' && !currentUser.uid.startsWith('admin_manual_')) {
                const userRef = doc(db, "users", currentUser.uid);
                await updateDoc(userRef, {
                    progressHistory: updatedHistory
                });
              }
          } catch (e) {
              console.log("Error saving progress:", e);
          }
      }
  };

  const handleLevelProgress = async (type: 'Tracing' | 'Reading' | 'Spelling' | 'Memory', levelIndex: number) => {
      if (!currentUser) return;
      const currentSaved = currentUser[`last${type}Index` as keyof UserProfile] as number || 0;
      if (levelIndex <= currentSaved) return;

      const fieldName = `last${type}Index` as keyof UserProfile;
      const updatedUser = { ...currentUser, [fieldName]: levelIndex };
      
      setCurrentUser(updatedUser);
      saveProfileLocally(updatedUser);

      if (connectionStatus === 'ONLINE' && !currentUser.uid.startsWith('admin_manual_')) {
        try {
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, { [fieldName]: levelIndex });
        } catch (e) {
            console.log("Error saving level progress:", e);
        }
      }
  };

  const updateChildName = async (newName: string) => {
      if (currentUser) {
          const updatedUser = { ...currentUser, childName: newName };
          setCurrentUser(updatedUser);
          saveProfileLocally(updatedUser);

          if (connectionStatus === 'ONLINE' && !currentUser.uid.startsWith('admin_manual_')) {
            try {
                const userRef = doc(db, "users", currentUser.uid);
                await updateDoc(userRef, { childName: newName });
            } catch (e) {
                console.log("Error saving name:", e);
            }
          }
      }
  };

  const renderChildDashboard = () => (
    <ScrollView contentContainerStyle={styles.dashboardScroll} style={styles.background}>
       <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setScreen(Screen.HOME)} style={styles.row}>
            <ArrowLeft {...({color: "#6B7280"} as any)} />
            <Text style={{color: '#6B7280', fontWeight: 'bold', marginLeft: 4}}>Home</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <Brain size={40} {...({color: "#4A90E2"} as any)} />
          <Text style={styles.headerTitle}>Activities</Text>
        </View>
        <View style={{width: 40}} /> 
      </View>

      <Text style={styles.welcomeText}>
         Welcome, <Text style={{fontWeight: 'bold', color: '#4A90E2'}}>{currentUser?.childName}</Text>!
      </Text>
      
      <View style={styles.levelIndicator}>
          <Text style={styles.levelIndicatorLabel}>Recommended Level:</Text>
          <View style={styles.levelIndicatorBadge}>
            <Star size={16} {...({color: "#FACC15"} as any)} {...({fill: "#FACC15"} as any)} />
            <Text style={styles.levelIndicatorText}>{difficulty}</Text>
          </View>
      </View>

      <View style={styles.cardContainer}>
        <TouchableOpacity 
          onPress={() => { setSelectedActivityType('TRACING'); setScreen(Screen.TRACING); }}
          style={styles.activityCard}
        >
          <View style={[styles.iconBox, {backgroundColor: '#DBEAFE'}]}><PenTool size={32} {...({color: "#2563EB"} as any)} /></View>
          <View style={{flex: 1}}>
            <Text style={styles.activityTitle}>Tracing</Text>
            <Text style={styles.activityDesc}>Trace SVG paths</Text>
            <Text style={styles.activityDesc}>Level {currentUser?.lastTracingIndex ? currentUser.lastTracingIndex + 1 : 1}</Text>
          </View>
          <ChevronRight {...({color: "#D1D5DB"} as any)} size={28} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => { setSelectedActivityType('READING'); setScreen(Screen.READING); }}
          style={styles.activityCard}
        >
          <View style={[styles.iconBox, {backgroundColor: '#DCFCE7'}]}><BookOpen size={32} {...({color: "#16A34A"} as any)} /></View>
          <View style={{flex: 1}}>
            <Text style={styles.activityTitle}>Reading</Text>
            <Text style={styles.activityDesc}>Pronunciation & Fluency</Text>
            <Text style={styles.activityDesc}>Level {currentUser?.lastReadingIndex ? currentUser.lastReadingIndex + 1 : 1}</Text>
          </View>
          <ChevronRight {...({color: "#D1D5DB"} as any)} size={28} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => { setSelectedActivityType('SPELLING'); setScreen(Screen.SPELLING); }}
          style={styles.activityCard}
        >
          <View style={[styles.iconBox, {backgroundColor: '#FEF9C3'}]}><Keyboard size={32} {...({color: "#B45309"} as any)} /></View>
          <View style={{flex: 1}}>
            <Text style={styles.activityTitle}>Spelling</Text>
            <Text style={styles.activityDesc}>Word Construction</Text>
            <Text style={styles.activityDesc}>Level {currentUser?.lastSpellingIndex ? currentUser.lastSpellingIndex + 1 : 1}</Text>
          </View>
          <ChevronRight {...({color: "#D1D5DB"} as any)} size={28} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => { setSelectedActivityType('MEMORY'); setScreen(Screen.MEMORY); }}
          style={styles.activityCard}
        >
          <View style={[styles.iconBox, {backgroundColor: '#F3E8FF'}]}><Zap size={32} {...({color: "#9333EA"} as any)} /></View>
          <View style={{flex: 1}}>
            <Text style={styles.activityTitle}>Memory</Text>
            <Text style={styles.activityDesc}>Pattern Recall</Text>
            <Text style={styles.activityDesc}>Level {currentUser?.lastMemoryIndex ? currentUser.lastMemoryIndex + 1 : 1}</Text>
          </View>
          <ChevronRight {...({color: "#D1D5DB"} as any)} size={28} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        onPress={() => setScreen(Screen.LEARNING_JOURNEY)}
        style={styles.journeyButton}
      >
          <MapIcon size={24} {...({color: "#2563EB"} as any)} />
          <Text style={{fontWeight: 'bold', color: '#1D4ED8', marginLeft: 12}}>View Learning Map</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderLanding = () => (
    <View style={styles.landingContainer}>
      <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <LogOut size={20} {...({color: "#6B7280"} as any)} />
          <Text style={{color: '#6B7280', marginLeft: 8}}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 64}}>
          <Brain size={64} {...({color: "#4A90E2"} as any)} />
          <Text style={styles.logoText}>LexiLearn</Text>
      </View>
      
      <View style={{width: '100%', gap: 32}}>
        <TouchableOpacity 
          onPress={() => setScreen(Screen.CHILD_DASHBOARD)}
          style={styles.roleCard}
        >
          <View style={[styles.roleIconBox, {backgroundColor: '#DBEAFE'}]}><User size={48} {...({color: "#4A90E2"} as any)} /></View>
          <Text style={styles.roleTitle}>Student Area</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setScreen(Screen.DASHBOARD)}
          style={[styles.roleCard, {borderColor: 'rgba(22, 163, 74, 0.2)'}]}
        >
          <View style={[styles.roleIconBox, {backgroundColor: '#DCFCE7'}]}><GraduationCap size={48} {...({color: "#16A34A"} as any)} /></View>
          <Text style={styles.roleTitle}>Parent Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#4A90E2" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
       
       {connectionStatus === 'OFFLINE_MODE' && (
           <View style={styles.offlineBanner}>
               <View style={styles.bannerRow}>
                   <AlertTriangle size={16} {...({color: "#B45309"} as any)} />
                   <Text style={styles.offlineText}>Offline: Database Permission Denied</Text>
               </View>
               <TouchableOpacity onPress={handleRetryConnection} style={styles.retryButton}>
                   <RefreshCw size={14} {...({color: "#78350F"} as any)} />
                   <Text style={styles.retryText}>Retry Connection</Text>
               </TouchableOpacity>
           </View>
       )}

       {currentScreen === Screen.LOGIN && (
          <LoginScreen 
            onSignUpClick={() => setScreen(Screen.SIGN_UP)} 
            onLoginSuccess={handleLoginSuccess}
          />
       )}
       {currentScreen === Screen.SIGN_UP && (
          <SignUpScreen onBack={() => setScreen(Screen.LOGIN)} />
       )}
       {/* NOTE: PENDING_APPROVAL screen is removed. PENDING users are forced to logout. */}
       {currentScreen === Screen.ASSESSMENT && currentUser && (
          <AssessmentFlow 
            user={currentUser} 
            onComplete={(p) => {
                setCurrentUser(p); 
                setDifficulty(p.assignedDifficulty);
                saveProfileLocally(p);
                setScreen(Screen.HOME);
            }} 
          />
       )}
       {currentScreen === Screen.HOME && renderLanding()}
       {currentScreen === Screen.CHILD_DASHBOARD && renderChildDashboard()}
       
       {currentScreen === Screen.TRACING && (
          <TracingActivity 
            items={TRACING_ITEMS} 
            difficulty={difficulty} 
            initialIndex={currentUser?.lastTracingIndex || 0}
            onComplete={(s) => handleActivityComplete('Tracing', s)} 
            onLevelComplete={(idx) => handleLevelProgress('Tracing', idx)}
            onExit={() => setScreen(Screen.CHILD_DASHBOARD)} 
          />
       )}
       {currentScreen === Screen.READING && (
          <ReadingActivity 
            items={READING_ITEMS} 
            difficulty={difficulty} 
            initialIndex={currentUser?.lastReadingIndex || 0}
            onComplete={(s) => handleActivityComplete('Reading', s)} 
            onLevelComplete={(idx) => handleLevelProgress('Reading', idx)}
            onExit={() => setScreen(Screen.CHILD_DASHBOARD)} 
          />
       )}
       {currentScreen === Screen.SPELLING && (
          <SpellingActivity 
             items={SPELLING_ITEMS} 
             difficulty={difficulty}
             initialIndex={currentUser?.lastSpellingIndex || 0}
             onComplete={(s) => handleActivityComplete('Spelling', s)}
             onLevelComplete={(idx) => handleLevelProgress('Spelling', idx)}
             onExit={() => setScreen(Screen.CHILD_DASHBOARD)}
          />
       )}
       {currentScreen === Screen.MEMORY && (
          <MemoryActivity 
             items={MEMORY_ITEMS} 
             difficulty={difficulty}
             initialIndex={currentUser?.lastMemoryIndex || 0}
             onComplete={(s) => handleActivityComplete('Memory', s)}
             onLevelComplete={(idx) => handleLevelProgress('Memory', idx)}
             onExit={() => setScreen(Screen.CHILD_DASHBOARD)}
          />
       )}
       {currentScreen === Screen.DASHBOARD && currentUser && (
          <ParentDashboard 
             childName={currentUser.childName}
             currentDifficulty={difficulty}
             progressData={currentUser.progressHistory || []} 
             assessmentScores={currentUser.assessmentScores}
             onUpdateChildName={updateChildName}
             onExit={() => setScreen(Screen.HOME)} 
          />
       )}
       {currentScreen === Screen.LEARNING_JOURNEY && currentUser && (
          <LearningJourney user={currentUser} onExit={() => setScreen(Screen.CHILD_DASHBOARD)} />
       )}
       {currentScreen === Screen.ADMIN_DASHBOARD && currentUser && (
          <AdminDashboard 
             userEmail={currentUser.email} 
             onExit={handleSignOut}
          />
       )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFBF7',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  background: {
    backgroundColor: '#FDFBF7',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashboardScroll: {
    padding: 24,
    flexGrow: 1,
    alignItems: 'center',
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
    marginTop: Platform.OS === 'android' ? 24 : 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#2D2D2D',
    marginLeft: 8,
  },
  welcomeText: {
    fontSize: 24,
    color: '#4B5563',
    marginBottom: 16,
    textAlign: 'center',
  },
  levelIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  levelIndicatorLabel: {
    color: '#854D0E',
    fontWeight: '600',
  },
  levelIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  levelIndicatorText: {
    color: '#854D0E',
    fontWeight: 'bold',
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    padding: 16,
    borderRadius: 16,
    marginRight: 16,
  },
  activityTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  activityDesc: {
    color: '#6B7280',
  },
  journeyButton: {
    marginTop: 32,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  landingContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDFBF7',
  },
  signOutButton: {
    position: 'absolute',
    top: 48,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#2D2D2D',
    marginLeft: 12,
  },
  roleCard: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderWidth: 2,
    borderColor: 'rgba(74, 144, 226, 0.2)',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    alignItems: 'center',
  },
  roleIconBox: {
    padding: 24,
    borderRadius: 999,
    marginBottom: 24,
  },
  roleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  pendingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FDFBF7',
  },
  pendingCard: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  pendingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  pendingText: {
    fontSize: 18,
    color: '#2563EB',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  pendingSubText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22
  },
  signOutLink: {
    padding: 12,
  },
  signOutLinkText: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  cardContainer: {
    width: '100%',
    gap: 16,
  },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B'
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineText: {
    color: '#B45309',
    fontWeight: 'bold',
    fontSize: 12
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  retryText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#78350F',
  }
});

export default App;
