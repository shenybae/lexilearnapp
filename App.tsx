
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, StyleSheet, StatusBar, Platform } from 'react-native';
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
import { Brain, User, Map as MapIcon, GraduationCap, ArrowLeft, LogOut, PenTool, BookOpen, Keyboard, Zap, ChevronRight, Star } from 'lucide-react-native';
import { auth, db } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore/lite';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.LOGIN);
  const [selectedActivityType, setSelectedActivityType] = useState<'TRACING' | 'READING' | 'SPELLING' | 'MEMORY' | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MILD);

  // Auth & Profile Sync logic
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const userData = docSnap.data() as UserProfile;
                setCurrentUser(userData);
                setDifficulty(userData.assignedDifficulty || Difficulty.MILD);
                
                if (userData.role === 'Admin') {
                    setCurrentScreen(Screen.ADMIN_DASHBOARD);
                } else if (!userData.assessmentComplete) {
                    setCurrentScreen(Screen.ASSESSMENT);
                } else {
                    setCurrentScreen(Screen.HOME);
                }
            } else {
                // New user via auth but no profile doc (rare in this flow, usually handled by SignUp)
                const fallbackProfile: UserProfile = { 
                    uid: user.uid, 
                    email: user.email!, 
                    role: 'Guardian', 
                    childName: 'Student', 
                    assessmentComplete: false, 
                    assignedDifficulty: Difficulty.MILD,
                    progressHistory: []
                };
                setCurrentUser(fallbackProfile);
                setCurrentScreen(Screen.ASSESSMENT);
            }
        } catch (e) { console.error(e); }
      } else {
        if (!currentUser) setCurrentScreen(Screen.LOGIN);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
      await signOut(auth);
      setCurrentUser(null);
      setCurrentScreen(Screen.LOGIN);
  };

  const handleDemoLogin = (role: 'Guardian' | 'Admin') => {
    const demoUser: UserProfile = {
      uid: 'demo-user-123',
      email: role === 'Admin' ? 'admin@lexilearn.com' : 'demo@lexilearn.com',
      childName: role === 'Admin' ? 'N/A' : 'Alex (Demo)',
      role: role,
      // FIX: Ensure assessmentComplete is FALSE for Guardian so they see the assessment flow
      assessmentComplete: role === 'Admin', 
      assignedDifficulty: Difficulty.MILD,
      progressHistory: [
          { date: 'Oct 20', activityType: 'Tracing', score: 85, details: 'Demo Line' },
          { date: 'Oct 21', activityType: 'Reading', score: 92, details: 'Demo Word' },
          { date: 'Oct 22', activityType: 'Spelling', score: 78, details: 'Demo Spell' },
      ]
    };
    setCurrentUser(demoUser);
    if (role === 'Admin') {
        setCurrentScreen(Screen.ADMIN_DASHBOARD);
    } else if (!demoUser.assessmentComplete) {
        setCurrentScreen(Screen.ASSESSMENT);
    } else {
        setCurrentScreen(Screen.HOME);
    }
  };

  const handleActivityComplete = async (type: 'Tracing' | 'Reading' | 'Spelling' | 'Memory', score: number) => {
      const newRecord: ProgressRecord = {
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          activityType: type,
          score: score,
          details: `${type} Activity`
      };

      if (currentUser) {
          // Optimistic local update
          const updatedHistory = [...(currentUser.progressHistory || []), newRecord];
          const updatedUser = { ...currentUser, progressHistory: updatedHistory };
          setCurrentUser(updatedUser);

          // Persist to Firebase if not demo user
          if (currentUser.uid !== 'demo-user-123') {
              try {
                  const userRef = doc(db, "users", currentUser.uid);
                  await updateDoc(userRef, {
                      progressHistory: updatedHistory
                  });
              } catch (e) {
                  console.error("Error saving progress:", e);
              }
          }
      }
  };

  const updateChildName = async (newName: string) => {
      if (currentUser) {
          const updated = { ...currentUser, childName: newName };
          setCurrentUser(updated);
          // Update Firestore if not demo
          if (currentUser.uid !== 'demo-user-123') {
              try {
                  const userRef = doc(db, "users", currentUser.uid);
                  await updateDoc(userRef, { childName: newName });
              } catch (e) {
                  console.error(e);
              }
          }
      }
  };

  const renderChildDashboard = () => (
    <ScrollView contentContainerStyle={styles.dashboardScroll} style={styles.background}>
       <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setCurrentScreen(Screen.HOME)} style={styles.row}>
            <ArrowLeft color="#6B7280" />
            <Text style={{color: '#6B7280', fontWeight: 'bold', marginLeft: 4}}>Home</Text>
        </TouchableOpacity>
        <View style={styles.row}>
          <Brain size={40} color="#4A90E2" />
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
            <Star size={16} fill="#FACC15" color="#FACC15" />
            <Text style={styles.levelIndicatorText}>{difficulty}</Text>
          </View>
      </View>

      <View style={styles.cardContainer}>
        <TouchableOpacity 
          onPress={() => { setSelectedActivityType('TRACING'); setCurrentScreen(Screen.TRACING); }}
          style={styles.activityCard}
        >
          <View style={[styles.iconBox, {backgroundColor: '#DBEAFE'}]}><PenTool size={32} color="#2563EB" /></View>
          <View style={{flex: 1}}>
            <Text style={styles.activityTitle}>Tracing</Text>
            <Text style={styles.activityDesc}>Practice lines & letters</Text>
          </View>
          <ChevronRight color="#D1D5DB" size={28} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => { setSelectedActivityType('READING'); setCurrentScreen(Screen.READING); }}
          style={styles.activityCard}
        >
          <View style={[styles.iconBox, {backgroundColor: '#DCFCE7'}]}><BookOpen size={32} color="#16A34A" /></View>
          <View style={{flex: 1}}>
            <Text style={styles.activityTitle}>Reading</Text>
            <Text style={styles.activityDesc}>Practice pronunciation</Text>
          </View>
          <ChevronRight color="#D1D5DB" size={28} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => { setSelectedActivityType('SPELLING'); setCurrentScreen(Screen.SPELLING); }}
          style={styles.activityCard}
        >
          <View style={[styles.iconBox, {backgroundColor: '#FEF9C3'}]}><Keyboard size={32} color="#B45309" /></View>
          <View style={{flex: 1}}>
            <Text style={styles.activityTitle}>Spelling</Text>
            <Text style={styles.activityDesc}>Word construction</Text>
          </View>
          <ChevronRight color="#D1D5DB" size={28} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => { setSelectedActivityType('MEMORY'); setCurrentScreen(Screen.MEMORY); }}
          style={styles.activityCard}
        >
          <View style={[styles.iconBox, {backgroundColor: '#F3E8FF'}]}><Zap size={32} color="#9333EA" /></View>
          <View style={{flex: 1}}>
            <Text style={styles.activityTitle}>Memory</Text>
            <Text style={styles.activityDesc}>Pattern recognition</Text>
          </View>
          <ChevronRight color="#D1D5DB" size={28} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        onPress={() => setCurrentScreen(Screen.LEARNING_JOURNEY)}
        style={styles.journeyButton}
      >
          <MapIcon size={24} color="#2563EB" />
          <Text style={{fontWeight: 'bold', color: '#1D4ED8', marginLeft: 12}}>View Learning Map</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderLanding = () => (
    <View style={styles.landingContainer}>
      <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <LogOut size={20} color="#6B7280" />
          <Text style={{color: '#6B7280', marginLeft: 8}}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 64}}>
          <Brain size={64} color="#4A90E2" />
          <Text style={styles.logoText}>LexiLearn</Text>
      </View>
      
      <View style={{width: '100%', gap: 32}}>
        <TouchableOpacity 
          onPress={() => setCurrentScreen(Screen.CHILD_DASHBOARD)}
          style={styles.roleCard}
        >
          <View style={[styles.roleIconBox, {backgroundColor: '#DBEAFE'}]}><User size={48} color="#4A90E2" /></View>
          <Text style={styles.roleTitle}>Student Area</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setCurrentScreen(Screen.DASHBOARD)}
          style={[styles.roleCard, {borderColor: 'rgba(22, 163, 74, 0.2)'}]}
        >
          <View style={[styles.roleIconBox, {backgroundColor: '#DCFCE7'}]}><GraduationCap size={48} color="#16A34A" /></View>
          <Text style={styles.roleTitle}>Parent Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#4A90E2" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
       {currentScreen === Screen.LOGIN && (
          <LoginScreen 
            onDemoLogin={handleDemoLogin} 
            onSignUpClick={() => setCurrentScreen(Screen.SIGN_UP)} 
          />
       )}
       {currentScreen === Screen.SIGN_UP && (
          <SignUpScreen onBack={() => setCurrentScreen(Screen.LOGIN)} />
       )}
       {currentScreen === Screen.ASSESSMENT && currentUser && (
          <AssessmentFlow 
            user={currentUser} 
            onComplete={(p) => {
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
            onComplete={(s) => handleActivityComplete('Tracing', s)} 
            onExit={() => setCurrentScreen(Screen.CHILD_DASHBOARD)} 
          />
       )}
       {currentScreen === Screen.READING && (
          <ReadingActivity 
            items={READING_ITEMS} 
            difficulty={difficulty} 
            onComplete={(s) => handleActivityComplete('Reading', s)} 
            onExit={() => setCurrentScreen(Screen.CHILD_DASHBOARD)} 
          />
       )}
       {currentScreen === Screen.SPELLING && (
          <SpellingActivity 
             items={SPELLING_ITEMS} 
             difficulty={difficulty}
             onComplete={(s) => handleActivityComplete('Spelling', s)}
             onExit={() => setCurrentScreen(Screen.CHILD_DASHBOARD)}
          />
       )}
       {currentScreen === Screen.MEMORY && (
          <MemoryActivity 
             items={MEMORY_ITEMS} 
             difficulty={difficulty}
             onComplete={(s) => handleActivityComplete('Memory', s)}
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
             isDemo={currentUser.uid === 'demo-user-123'}
          />
       )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFBF7',
  },
  background: {
    backgroundColor: '#FDFBF7',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#2D2D2D',
    marginBottom: 8,
  },
  subtitleText: {
    color: '#4B5563',
    marginBottom: 32,
    textAlign: 'center',
  },
  cardContainer: {
    width: '100%',
    gap: 16,
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
});

export default App;
