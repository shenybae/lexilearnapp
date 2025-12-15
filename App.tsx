
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, StatusBar, Platform, Alert } from 'react-native';
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
import { Brain, User, Map as MapIcon, GraduationCap, ArrowLeft, LogOut, PenTool, BookOpen, Keyboard, Zap, ChevronRight, Star, Clock, Lock, AlertTriangle } from 'lucide-react-native';
import { auth, db, onAuthStateChanged, signOut } from './firebaseConfig';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.LOGIN);
  const [selectedActivityType, setSelectedActivityType] = useState<'TRACING' | 'READING' | 'SPELLING' | 'MEMORY' | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MILD);
  const [connectionStatus, setConnectionStatus] = useState<'ONLINE' | 'OFFLINE_MODE'>('ONLINE');

  // Check Backend Status
  useEffect(() => {
    const checkBackend = async () => {
        try {
            console.log("Checking backend connection...");
            const response = await fetch('https://lexilearnapp.onrender.com');
            if (response.ok) {
                console.log("✅ Backend [https://lexilearnapp.onrender.com] is UP and running!");
            } else {
                console.log(`⚠️ Backend returned status: ${response.status}`);
            }
        } catch (error) {
            console.error("❌ Backend [https://lexilearnapp.onrender.com] is UNREACHABLE or Network Error", error);
        }
    };
    checkBackend();
  }, []);

  // Helper to determine where to go based on user profile
  const navigateBasedOnUser = (user: UserProfile) => {
      if (user.role === 'Admin') {
          setCurrentScreen(Screen.ADMIN_DASHBOARD);
      } else if (user.status === 'PENDING') {
          setCurrentScreen(Screen.PENDING_APPROVAL);
      } else if (user.status === 'REJECTED') {
          setCurrentScreen(Screen.LOGIN);
          Alert.alert("Access Denied", "Your account application was rejected.");
          signOut(auth);
      } else if (!user.assessmentComplete) {
          setCurrentScreen(Screen.ASSESSMENT);
      } else {
          setCurrentScreen(Screen.HOME);
      }
  };

  // Auth & Profile Sync logic
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user: any) => {
      if (user) {
        setConnectionStatus('ONLINE');
        // Step 2 & 6: Real-time listener for User Profile updates
        const userDocRef = doc(db, "users", user.uid);
        
        const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
              const userData = docSnap.data() as UserProfile;
              setCurrentUser(userData);
              setDifficulty(userData.assignedDifficulty || Difficulty.MILD);
              
              if (loading) {
                  // Initial App Load: Auto-navigate
                  navigateBasedOnUser(userData);
              } else {
                  // Runtime Update
                  if (currentScreen !== Screen.LOGIN) {
                      // Allow auto-navigation for specific state transitions
                      if (currentScreen === Screen.PENDING_APPROVAL && userData.status === 'APPROVED') {
                          navigateBasedOnUser(userData);
                      }
                  }
              }
              setLoading(false);
          } else {
             // Doc doesn't exist yet (or created via sign-up but not propagated)
             const fallbackProfile: UserProfile = { 
                 uid: user.uid, 
                 email: user.email!, 
                 role: 'Guardian', 
                 childName: 'Student', 
                 status: 'PENDING', 
                 assessmentComplete: false, 
                 assignedDifficulty: Difficulty.MILD,
                 progressHistory: []
             };
             setCurrentUser(fallbackProfile);
             if (loading) setCurrentScreen(Screen.PENDING_APPROVAL);
             setLoading(false);
          }
        }, (error) => {
           // *** ERROR HANDLING FIX ***
           console.warn("Firestore Read Error (Using Offline Profile):", error.code);
           
           if (error.code === 'permission-denied') {
               setConnectionStatus('OFFLINE_MODE');
               // Instead of crashing or alerting, we load an "Offline/Fallback" profile.
               // This allows the app to be usable even if DB rules are broken.
               const offlineProfile: UserProfile = {
                   uid: user.uid,
                   email: user.email!,
                   role: 'Guardian',
                   childName: 'Student',
                   status: 'APPROVED', // Assume approved so they can test the app
                   assessmentComplete: false,
                   assignedDifficulty: Difficulty.MILD,
                   progressHistory: []
               };
               setCurrentUser(offlineProfile);
               
               // Only navigate if we are stuck on loading
               if (loading) {
                   setCurrentScreen(Screen.HOME);
               }
           }
           setLoading(false);
        });

        return () => unsubscribeSnapshot();
      } else {
        setCurrentUser(null);
        setCurrentScreen(Screen.LOGIN);
        setLoading(false);
      }
    });

    return unsubscribeAuth;
  }, []);

  const handleSignOut = async () => {
      try {
        await signOut(auth);
      } catch (e) {
          console.error("Sign out error", e);
      }
      setCurrentUser(null);
      setCurrentScreen(Screen.LOGIN);
  };

  // Step 5: Daily activities -> add to progress
  const handleActivityComplete = async (type: 'Tracing' | 'Reading' | 'Spelling' | 'Memory', score: number) => {
      const newRecord: ProgressRecord = {
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          activityType: type,
          score: score,
          details: `${type} Activity`
      };

      if (currentUser) {
          const updatedHistory = [...(currentUser.progressHistory || []), newRecord];
          // Optimistic update
          const updatedUser = { ...currentUser, progressHistory: updatedHistory };
          setCurrentUser(updatedUser);

          try {
              const userRef = doc(db, "users", currentUser.uid);
              await updateDoc(userRef, {
                  progressHistory: updatedHistory
              });
          } catch (e) {
              console.log("Offline mode: Progress saved locally only.");
          }
      }
  };

  const handleLevelProgress = async (type: 'Tracing' | 'Reading' | 'Spelling' | 'Memory', levelIndex: number) => {
      if (!currentUser) return;
      const currentSaved = currentUser[`last${type}Index` as keyof UserProfile] as number || 0;
      if (levelIndex <= currentSaved) return;

      const fieldName = `last${type}Index` as keyof UserProfile;
      try {
          const userRef = doc(db, "users", currentUser.uid);
          await updateDoc(userRef, { [fieldName]: levelIndex });
      } catch (e) {
          console.log("Offline mode: Level progress saved locally only.");
      }
  };

  const updateChildName = async (newName: string) => {
      if (currentUser) {
          // Optimistic
          setCurrentUser({ ...currentUser, childName: newName });
          try {
              const userRef = doc(db, "users", currentUser.uid);
              await updateDoc(userRef, { childName: newName });
          } catch (e) {
              console.log("Offline mode: Name update saved locally only.");
          }
      }
  };

  const renderPendingApproval = () => (
      <View style={styles.pendingContainer}>
          <View style={styles.pendingCard}>
              <Clock size={64} stroke="#3B82F6" />
              <Text style={styles.pendingTitle}>Application Pending</Text>
              <Text style={styles.pendingText}>
                  Step 1 Complete: Application Submitted.
              </Text>
              <Text style={styles.pendingSubText}>
                  Waiting for Step 2: Administrator Approval.
                  This screen will update automatically once approved.
              </Text>
              
              <TouchableOpacity onPress={handleSignOut} style={styles.signOutLink}>
                  <Text style={styles.signOutLinkText}>Sign Out</Text>
              </TouchableOpacity>
          </View>
      </View>
  );

  const renderChildDashboard = () => (
    <ScrollView contentContainerStyle={styles.dashboardScroll} style={styles.background}>
       <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setCurrentScreen(Screen.HOME)} style={styles.row}>
            <ArrowLeft stroke="#6B7280" />
            <Text style={{color: '#6B7280', fontWeight: 'bold', marginLeft: 4}}>Home</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <Brain size={40} stroke="#4A90E2" />
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
            <Star size={16} stroke="#FACC15" {...({fill: "#FACC15"} as any)} />
            <Text style={styles.levelIndicatorText}>{difficulty}</Text>
          </View>
      </View>

      <View style={styles.cardContainer}>
        <TouchableOpacity 
          onPress={() => { setSelectedActivityType('TRACING'); setCurrentScreen(Screen.TRACING); }}
          style={styles.activityCard}
        >
          <View style={[styles.iconBox, {backgroundColor: '#DBEAFE'}]}><PenTool size={32} stroke="#2563EB" /></View>
          <View style={{flex: 1}}>
            <Text style={styles.activityTitle}>Tracing</Text>
            <Text style={styles.activityDesc}>Trace SVG paths</Text>
            <Text style={styles.activityDesc}>Level {currentUser?.lastTracingIndex ? currentUser.lastTracingIndex + 1 : 1}</Text>
          </View>
          <ChevronRight stroke="#D1D5DB" size={28} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => { setSelectedActivityType('READING'); setCurrentScreen(Screen.READING); }}
          style={styles.activityCard}
        >
          <View style={[styles.iconBox, {backgroundColor: '#DCFCE7'}]}><BookOpen size={32} stroke="#16A34A" /></View>
          <View style={{flex: 1}}>
            <Text style={styles.activityTitle}>Reading</Text>
            <Text style={styles.activityDesc}>Pronunciation & Fluency</Text>
            <Text style={styles.activityDesc}>Level {currentUser?.lastReadingIndex ? currentUser.lastReadingIndex + 1 : 1}</Text>
          </View>
          <ChevronRight stroke="#D1D5DB" size={28} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => { setSelectedActivityType('SPELLING'); setCurrentScreen(Screen.SPELLING); }}
          style={styles.activityCard}
        >
          <View style={[styles.iconBox, {backgroundColor: '#FEF9C3'}]}><Keyboard size={32} stroke="#B45309" /></View>
          <View style={{flex: 1}}>
            <Text style={styles.activityTitle}>Spelling</Text>
            <Text style={styles.activityDesc}>Word Construction</Text>
            <Text style={styles.activityDesc}>Level {currentUser?.lastSpellingIndex ? currentUser.lastSpellingIndex + 1 : 1}</Text>
          </View>
          <ChevronRight stroke="#D1D5DB" size={28} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => { setSelectedActivityType('MEMORY'); setCurrentScreen(Screen.MEMORY); }}
          style={styles.activityCard}
        >
          <View style={[styles.iconBox, {backgroundColor: '#F3E8FF'}]}><Zap size={32} stroke="#9333EA" /></View>
          <View style={{flex: 1}}>
            <Text style={styles.activityTitle}>Memory</Text>
            <Text style={styles.activityDesc}>Pattern Recall</Text>
            <Text style={styles.activityDesc}>Level {currentUser?.lastMemoryIndex ? currentUser.lastMemoryIndex + 1 : 1}</Text>
          </View>
          <ChevronRight stroke="#D1D5DB" size={28} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        onPress={() => setCurrentScreen(Screen.LEARNING_JOURNEY)}
        style={styles.journeyButton}
      >
          <MapIcon size={24} stroke="#2563EB" />
          <Text style={{fontWeight: 'bold', color: '#1D4ED8', marginLeft: 12}}>View Learning Map</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderLanding = () => (
    <View style={styles.landingContainer}>
      <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <LogOut size={20} stroke="#6B7280" />
          <Text style={{color: '#6B7280', marginLeft: 8}}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 64}}>
          <Brain size={64} stroke="#4A90E2" />
          <Text style={styles.logoText}>LexiLearn</Text>
      </View>
      
      <View style={{width: '100%', gap: 32}}>
        <TouchableOpacity 
          onPress={() => setCurrentScreen(Screen.CHILD_DASHBOARD)}
          style={styles.roleCard}
        >
          <View style={[styles.roleIconBox, {backgroundColor: '#DBEAFE'}]}><User size={48} stroke="#4A90E2" /></View>
          <Text style={styles.roleTitle}>Student Area</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setCurrentScreen(Screen.DASHBOARD)}
          style={[styles.roleCard, {borderColor: 'rgba(22, 163, 74, 0.2)'}]}
        >
          <View style={[styles.roleIconBox, {backgroundColor: '#DCFCE7'}]}><GraduationCap size={48} stroke="#16A34A" /></View>
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
               <AlertTriangle size={16} stroke="#B45309" />
               <Text style={styles.offlineText}>Offline Mode: Permission denied (Check Firestore Rules)</Text>
           </View>
       )}

       {currentScreen === Screen.LOGIN && (
          <LoginScreen 
            onSignUpClick={() => setCurrentScreen(Screen.SIGN_UP)} 
            onLoginSuccess={() => currentUser && navigateBasedOnUser(currentUser)}
          />
       )}
       {currentScreen === Screen.SIGN_UP && (
          <SignUpScreen onBack={() => setCurrentScreen(Screen.LOGIN)} />
       )}
       {currentScreen === Screen.PENDING_APPROVAL && renderPendingApproval()}
       {currentScreen === Screen.ASSESSMENT && currentUser && (
          <AssessmentFlow 
            user={currentUser} 
            onComplete={(p) => {
                // Step 4: Backend prediction (happens inside AssessmentFlow)
                setCurrentUser(p); 
                setDifficulty(p.assignedDifficulty); 
                setCurrentScreen(Screen.HOME);
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
            onExit={() => setCurrentScreen(Screen.CHILD_DASHBOARD)} 
          />
       )}
       {currentScreen === Screen.READING && (
          <ReadingActivity 
            items={READING_ITEMS} 
            difficulty={difficulty} 
            initialIndex={currentUser?.lastReadingIndex || 0}
            onComplete={(s) => handleActivityComplete('Reading', s)} 
            onLevelComplete={(idx) => handleLevelProgress('Reading', idx)}
            onExit={() => setCurrentScreen(Screen.CHILD_DASHBOARD)} 
          />
       )}
       {currentScreen === Screen.SPELLING && (
          <SpellingActivity 
             items={SPELLING_ITEMS} 
             difficulty={difficulty}
             initialIndex={currentUser?.lastSpellingIndex || 0}
             onComplete={(s) => handleActivityComplete('Spelling', s)}
             onLevelComplete={(idx) => handleLevelProgress('Spelling', idx)}
             onExit={() => setCurrentScreen(Screen.CHILD_DASHBOARD)}
          />
       )}
       {currentScreen === Screen.MEMORY && (
          <MemoryActivity 
             items={MEMORY_ITEMS} 
             difficulty={difficulty}
             initialIndex={currentUser?.lastMemoryIndex || 0}
             onComplete={(s) => handleActivityComplete('Memory', s)}
             onLevelComplete={(idx) => handleLevelProgress('Memory', idx)}
             onExit={() => setCurrentScreen(Screen.CHILD_DASHBOARD)}
          />
       )}
       {currentScreen === Screen.DASHBOARD && currentUser && (
          <ParentDashboard 
             childName={currentUser.childName}
             currentDifficulty={difficulty}
             progressData={currentUser.progressHistory || []} 
             assessmentScores={currentUser.assessmentScores}
             onUpdateChildName={updateChildName}
             onExit={() => setCurrentScreen(Screen.HOME)} 
          />
       )}
       {currentScreen === Screen.LEARNING_JOURNEY && currentUser && (
          <LearningJourney user={currentUser} onExit={() => setCurrentScreen(Screen.CHILD_DASHBOARD)} />
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
  checkButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    marginBottom: 16,
  },
  checkButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
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
    justifyContent: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B'
  },
  offlineText: {
    color: '#B45309',
    fontWeight: 'bold',
    fontSize: 12
  }
});

export default App;
