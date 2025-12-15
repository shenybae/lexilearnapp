
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, PanResponder, ScrollView, Alert, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { Brain, Volume2, Trophy, Star, Mic, Square, Eraser, CheckCircle, AlertCircle, TrendingUp, Sparkles, Zap } from 'lucide-react-native';
import { Difficulty, UserProfile, AssessmentScores } from '../types';
import { doc, setDoc } from 'firebase/firestore/lite';
import { db } from '../firebaseConfig';
import { analyzeReadingAssessment } from '../services/gemini';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Svg, Path, Circle as SvgCircle } from 'react-native-svg';

interface AssessmentFlowProps {
  user: UserProfile;
  onComplete: (updatedProfile: UserProfile) => void;
}

const TASKS = [
  'Reading Speed',
  'Reading Accuracy',
  'Reading Comprehension',
  'Writing Speed',
  'Writing Quality',
  'Grammar & Sentence',
  'Phonetic Spelling',
  'Irregular Spelling',
  'Spelling Accuracy'
];

export const AssessmentFlow: React.FC<AssessmentFlowProps> = ({ user, onComplete }) => {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [scores, setScores] = useState<number[]>(new Array(9).fill(0));
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCalculatingPath, setIsCalculatingPath] = useState(false);
  const [calculatedProfile, setCalculatedProfile] = useState<UserProfile | null>(null);
  
  const [subStep, setSubStep] = useState(0);
  const [gameState, setGameState] = useState<'INTRO' | 'ACTIVE' | 'FEEDBACK'>('INTRO');
  const [accumulatedData, setAccumulatedData] = useState<any[]>([]); 
  const startTimeRef = useRef<number>(0);

  // Drawing
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [tracingPoints, setTracingPoints] = useState<{x:number, y:number}[]>([]);

  // Audio
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // --- DATA ---
  const readingSpeedText = "The quick brown fox jumps over the lazy dog. The sun is shining bright today.";
  
  const readingAccData = [
    { target: 'Through', options: ['Thought', 'Though', 'Through', 'Tough'] },
    { target: 'Quiet', options: ['Quite', 'Quiet', 'Quit', 'Quick'] },
    { target: 'Angel', options: ['Angle', 'Angel', 'Angry', 'Ankle'] },
    { target: 'Desert', options: ['Dessert', 'Desert', 'Deserve', 'Depart'] },
    { target: 'Loose', options: ['Lose', 'Loose', 'Loss', 'Lost'] }
  ];
  
  const readingCompPassage = "Sam has a red bike. He rides it to the park every day after school. His dog, Spot, runs beside him.";
  const readingCompData = [
    { q: "What color is Sam's bike?", a: "Red", options: ["Blue", "Red", "Green"] },
    { q: "Where does Sam go?", a: "The Park", options: ["School", "The Park", "Home"] },
    { q: "Who runs with Sam?", a: "Spot", options: ["Sam's Dad", "Spot", "A Cat"] }
  ];
  
  const writingSpeedTarget = "apple";
  const tracePath = "M 200,100 L 200,200 M 200,150 A 50,50 0 1,0 100,150 A 50,50 0 1,0 200,150"; 
  const traceViewBox = "0 0 300 300";
  
  const grammarData = [
    { q: "She ___ to the store.", a: "goes", options: ["go", "goes", "going"] },
    { q: "They ___ playing soccer.", a: "are", options: ["is", "am", "are"] },
    { q: "I ___ a book yesterday.", a: "read", options: ["read", "reads", "reading"] },
    { q: "The dog is ___ than the cat.", a: "bigger", options: ["big", "bigger", "biggest"] },
    { q: "___ is your name?", a: "What", options: ["When", "What", "Why"] }
  ];

  const phoneticData = [
    { target: 'Phone', options: ['Fone', 'Phone', 'Foan'] },
    { target: 'Laugh', options: ['Laff', 'Laugh', 'Lagh'] },
    { target: 'City', options: ['Sity', 'City', 'Citty'] }
  ];
  
  const irregularData = [
    { target: 'Wednesday', options: ['Wensday', 'Wednesday', 'Wednesdey'] },
    { target: 'People', options: ['Peeple', 'People', 'Poeple'] },
    { target: 'Knight', options: ['Nite', 'Knight', 'Night'] }
  ];

  const spellingAccData = [
    { target: 'Necessary', options: ['Neccessary', 'Necessary', 'Necesary'] },
    { target: 'Separate', options: ['Seperate', 'Separate', 'Sepperate'] },
    { target: 'Accommodate', options: ['Acommodate', 'Accomodate', 'Accommodate'] }
  ];

  // Helper for silent cleanup
  const safeCleanupRecording = async (rec: Audio.Recording | null) => {
      if (!rec) return;
      try {
          // stopAndUnloadAsync handles the entire cleanup process.
          // We wrap in try/catch to suppress errors if it's already unloaded or in an invalid state.
          await rec.stopAndUnloadAsync();
      } catch (err) {
          // Swallow "no valid audio data" or "not loaded" errors during cleanup
      }
  };

  useEffect(() => {
    setCurrentPath('');
    setTracingPoints([]);
  }, [currentTaskIndex]);

  // Global Cleanup
  useEffect(() => {
    return () => {
        if (recordingRef.current) {
            safeCleanupRecording(recordingRef.current);
            recordingRef.current = null;
        }
    };
  }, []);

  // Drawing Pan Responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: any) => {
        setIsDrawing(true);
        const { locationX, locationY } = evt.nativeEvent;
        // Append new Move command to existing path to allow lifting hand
        setCurrentPath(prev => {
            const newPoint = `M ${locationX} ${locationY}`;
            return prev ? `${prev} ${newPoint}` : newPoint;
        });
        setTracingPoints(prev => [...prev, {x: locationX, y: locationY}]);
      },
      onPanResponderMove: (evt: any) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(prev => `${prev} L ${locationX} ${locationY}`);
        setTracingPoints(prev => [...prev, {x: locationX, y: locationY}]);
      },
      onPanResponderRelease: () => {
        setIsDrawing(false);
      }
    })
  ).current;

  const startTask = () => {
    setGameState('ACTIVE');
    startTimeRef.current = Date.now();
  };

  const nextSubStep = () => {
    setSubStep(prev => prev + 1);
    startTimeRef.current = Date.now();
  };

  const playTTS = (text: string) => {
    Speech.speak(text, { rate: 0.9 });
  };

  const handleScoreAndNext = async (taskIdx: number, rawScore: number) => {
    // Explicitly cleanup recording when moving to next task
    if (recordingRef.current) { 
        await safeCleanupRecording(recordingRef.current);
        recordingRef.current = null;
        setRecording(null); 
    }

    const newScores = [...scores];
    newScores[taskIdx] = Math.max(0, Math.min(100, Math.round(rawScore)));
    setScores(newScores);
    setAccumulatedData([]);
    setTracingPoints([]);
    setSubStep(0);
    setIsProcessing(false);

    if (taskIdx < TASKS.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
      setGameState('INTRO');
    } else {
      finishAssessment(newScores);
    }
  };

  const handleReadingSpeedStart = async () => {
    try {
      // 1. Silent Cleanup
      if (recordingRef.current) {
          await safeCleanupRecording(recordingRef.current);
          recordingRef.current = null;
          setRecording(null);
      }

      // 2. Permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert("Permission", "Microphone access is required.");
        return;
      }

      // 3. Audio Mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // 4. Create and Start (Explicitly)
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRecording.startAsync();
      
      // 5. Update State
      recordingRef.current = newRecording;
      setRecording(newRecording);
      setGameState('ACTIVE');
      startTimeRef.current = Date.now(); 
      console.log("Recording started successfully");

    } catch (err) {
      Alert.alert("Error", "Could not start microphone.");
      console.error(err);
    }
  };

  const handleReadingSpeedStop = async () => {
    if (isProcessing) return; 
    if (!recordingRef.current) return;

    setIsProcessing(true);
    const durationSec = (Date.now() - startTimeRef.current) / 1000;
    let uri: string | null = null;
    
    try {
        const status = await recordingRef.current.getStatusAsync();
        
        // Prevent extremely short recordings which cause "no valid audio data" errors
        if (status.durationMillis < 1000) {
            Alert.alert("Too Short", "Please read for at least a second.");
            setIsProcessing(false);
            // Do NOT stop here, let user continue speaking
            return;
        }

        await recordingRef.current.stopAndUnloadAsync();
        uri = recordingRef.current.getURI();
    } catch (e: any) {
        if (e.message && !e.message.includes("no valid audio data")) {
            console.log("Stop recording error", e);
        } else {
            Alert.alert("No Audio", "We didn't hear anything. Please try again.");
        }
        setIsProcessing(false);
        recordingRef.current = null;
        setRecording(null);
        return;
    }
    
    // Cleanup refs
    recordingRef.current = null;
    setRecording(null); 

    if (uri) {
       console.log("Audio URI captured:", uri);
       const result = await analyzeReadingAssessment(uri, readingSpeedText, durationSec);
       
       if (!result.transcript) {
          Alert.alert("Analysis Failed", "Could not analyze audio. Please try again.");
          setIsProcessing(false);
          setGameState('INTRO'); 
          return;
       }
       
       // Score roughly matches WPM. 100 WPM = ~90 Score, 50 WPM = ~50 Score.
       const speedScore = Math.min(100, Math.round(result.wpm * 0.9));
       const weightedScore = (result.accuracy * 0.5) + (speedScore * 0.5);
       handleScoreAndNext(0, weightedScore);
    } else {
       Alert.alert("Error", "Recording not found.");
       setIsProcessing(false);
    }
  };

  const handleWritingSpeedSubmit = () => {
    if (tracingPoints.length < 20) {
        Alert.alert("Incomplete", "Please write the word.");
        return;
    }
    const durationSec = (Date.now() - startTimeRef.current) / 1000;
    let score = 0;
    if (durationSec <= 5) score = 100;
    else if (durationSec >= 15) score = 40;
    else score = 100 - ((durationSec - 5) * 6);
    handleScoreAndNext(3, score);
  };

  const handleTraceQualitySubmit = () => {
     if (tracingPoints.length > 50) handleScoreAndNext(4, 90); 
     else if (tracingPoints.length > 20) handleScoreAndNext(4, 60);
     else handleScoreAndNext(4, 30); 
  };

  const handleSelection = (correct: boolean, totalItems: number, idx: number) => {
    const newData = [...accumulatedData, correct];
    setAccumulatedData(newData);
    if (subStep < totalItems - 1) {
       nextSubStep();
    } else {
       const correctCount = newData.filter(Boolean).length;
       handleScoreAndNext(idx, (correctCount / totalItems) * 100);
    }
  };

  const finishAssessment = async (finalScores: number[]) => {
    setIsCalculatingPath(true);
    
    // Simulate complex analysis delay
    await new Promise(resolve => setTimeout(resolve, 2500));

    const readingAvg = Math.round((finalScores[0] + finalScores[1] + finalScores[2]) / 3);
    const writingAvg = Math.round((finalScores[3] + finalScores[4] + finalScores[5]) / 3);
    const spellingAvg = Math.round((finalScores[6] + finalScores[7] + finalScores[8]) / 3);
    const overallAverage = Math.round((readingAvg + writingAvg + spellingAvg) / 3);

    let assignedDiff = Difficulty.PROFOUND;
    if (overallAverage >= 60) assignedDiff = Difficulty.MILD;
    else if (overallAverage >= 40) assignedDiff = Difficulty.MODERATE;
    else if (overallAverage >= 20) assignedDiff = Difficulty.SEVERE;
    else assignedDiff = Difficulty.PROFOUND;

    const assessmentScores: AssessmentScores = {
        readingSpeed: finalScores[0], readingAccuracy: finalScores[1], readingComprehension: finalScores[2],
        writingSpeed: finalScores[3], writingQuality: finalScores[4], grammar: finalScores[5],
        phoneticSpelling: finalScores[6], irregularSpelling: finalScores[7], spellingAccuracy: finalScores[8],
        overallAverage
    };

    const updatedProfile: UserProfile = { ...user, assessmentComplete: true, assignedDifficulty: assignedDiff, assessmentScores };

    if (user.uid !== 'demo-user-123') {
        try {
            await setDoc(doc(db, "users", user.uid), { assessmentComplete: true, assignedDifficulty: assignedDiff, assessmentScores }, { merge: true });
        } catch (e) {}
    }
    setCalculatedProfile(updatedProfile);
    setIsCalculatingPath(false);
  };

  const renderTask = () => {
      switch(currentTaskIndex) {
          case 0: return (
             <View style={styles.centerCol}>
                <Text style={styles.instructionText}>Read Aloud</Text>
                <View style={styles.passageContainer}>
                    <TouchableOpacity onPress={() => playTTS(readingSpeedText)} style={styles.audioButton}>
                        <Volume2 size={24} color="#2563EB" />
                    </TouchableOpacity>
                    <Text style={styles.passageText}>{readingSpeedText}</Text>
                </View>
                {recording ? (
                    <TouchableOpacity onPress={handleReadingSpeedStop} style={styles.stopButton} disabled={isProcessing}>
                        {isProcessing ? <ActivityIndicator color="#FFF" /> : <Square fill="#FFF" color="#FFF" size={20} />}
                        <Text style={styles.buttonText}>{isProcessing ? "Analyzing..." : "Stop & Submit"}</Text>
                    </TouchableOpacity>
                ) : isProcessing ? (
                    <ActivityIndicator size="large" color="#4A90E2" />
                ) : <Text style={styles.hintText}>Prepare...</Text>}
             </View>
          );
          case 3: return (
             <View style={styles.centerCol}>
                <Text style={styles.instructionText}>Write the word:</Text>
                <Text style={styles.targetWord}>{writingSpeedTarget}</Text>
                <View 
                  style={styles.drawArea}
                  {...panResponder.panHandlers}
                >
                   <Svg height="100%" width="100%">
                      <Path d={currentPath} stroke="#4A90E2" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                   </Svg>
                   <TouchableOpacity onPress={() => {setCurrentPath(''); setTracingPoints([])}} style={styles.clearButton}>
                      <Eraser size={20} color="#000" />
                   </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handleWritingSpeedSubmit} style={styles.primaryButton}>
                   <Text style={styles.buttonText}>Done Writing</Text>
                </TouchableOpacity>
             </View>
          );
          case 4: return (
            <View style={styles.centerCol}>
               <Text style={styles.instructionText}>Trace the letter 'a'</Text>
               <View 
                 style={styles.drawArea}
                 {...panResponder.panHandlers}
               >
                  <Svg height="100%" width="100%" viewBox={traceViewBox}>
                     <Path d={tracePath} stroke="#b0c4de" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="15,15" opacity={0.8} />
                     <SvgCircle cx="200" cy="100" r="8" fill="#4A90E2" />
                     <SvgCircle cx="200" cy="150" r="8" fill="#4A90E2" />
                     <Path d={currentPath} stroke="#4A90E2" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <TouchableOpacity onPress={() => {setCurrentPath(''); setTracingPoints([])}} style={styles.clearButton}>
                     <Eraser size={20} color="#000" />
                  </TouchableOpacity>
               </View>
               <TouchableOpacity onPress={handleTraceQualitySubmit} style={styles.primaryButton}>
                  <Text style={styles.buttonText}>Done Tracing</Text>
               </TouchableOpacity>
            </View>
          );
          default: 
            let data: any[] = [];
            let question = "";
            let options: string[] = [];
            let showAudio = false;
            let audioTarget = "";
            
            if (currentTaskIndex === 1) {
                data = readingAccData;
                question = `Find: "${data[subStep].target}"`;
                options = data[subStep].options;
                showAudio = true; // Added TTS for Task 1
                audioTarget = data[subStep].target;
            } else if (currentTaskIndex === 2) {
                data = readingCompData;
                question = data[subStep].q;
                options = data[subStep].options;
            } else if (currentTaskIndex === 5) {
                data = grammarData;
                question = data[subStep].q.replace('___', '_____');
                options = data[subStep].options;
            } else if (currentTaskIndex === 6) {
                data = phoneticData;
                question = "Which is correct?";
                options = data[subStep].options;
                showAudio = true;
                audioTarget = data[subStep].target;
            } else if (currentTaskIndex === 7) {
                data = irregularData;
                question = "Which is correct?";
                options = data[subStep].options;
                showAudio = true;
                audioTarget = data[subStep].target;
            } else if (currentTaskIndex === 8) {
                data = spellingAccData;
                question = "Which is correct?";
                options = data[subStep].options;
                showAudio = true;
                audioTarget = data[subStep].target;
            }

            if (data.length > 0) {
                return (
                    <View style={styles.centerCol}>
                        {currentTaskIndex === 2 && (
                            <View style={[styles.passageContainer, {backgroundColor: '#EFF6FF', borderColor: '#DBEAFE'}]}>
                                <TouchableOpacity onPress={() => playTTS(readingCompPassage)} style={styles.audioButtonSmall}><Volume2 size={20} color="#4A90E2" /></TouchableOpacity>
                                <Text style={styles.passageTextSmall}>{readingCompPassage}</Text>
                            </View>
                        )}
                        
                        <Text style={styles.questionText}>{question}</Text>
                        
                        {showAudio && (
                            <TouchableOpacity onPress={() => playTTS(audioTarget)} style={[styles.audioButton, {position: 'relative', marginBottom: 24, top: 0, right: 0}]}>
                                <Volume2 size={24} color="#2563EB" />
                                <Text style={{marginLeft: 8, color: '#2563EB', fontWeight: 'bold'}}>Hear Word</Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.optionsContainer}>
                            {options.map((opt, i) => (
                                <TouchableOpacity 
                                    key={i} 
                                    onPress={() => {
                                        let correct = false;
                                        if (currentTaskIndex === 1) correct = opt === readingAccData[subStep].target;
                                        if (currentTaskIndex === 2) correct = opt === readingCompData[subStep].a;
                                        if (currentTaskIndex === 5) correct = opt === grammarData[subStep].a;
                                        if (currentTaskIndex === 6) correct = opt === phoneticData[subStep].target;
                                        if (currentTaskIndex === 7) correct = opt === irregularData[subStep].target;
                                        if (currentTaskIndex === 8) correct = opt === spellingAccData[subStep].target;
                                        
                                        handleSelection(correct, data.length, currentTaskIndex);
                                    }} 
                                    style={styles.optionButton}
                                >
                                    <Text style={styles.optionText}>{opt}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            }
            return <View><Text>Task {currentTaskIndex}</Text><TouchableOpacity onPress={() => handleScoreAndNext(currentTaskIndex, 100)}><Text>Skip (Demo)</Text></TouchableOpacity></View>;
      }
  }

  // --- RENDER ---
  
  if (isCalculatingPath) {
      return (
          <View style={styles.loadingContainer}>
              <View style={styles.loadingCard}>
                  <Sparkles size={64} color="#4A90E2" style={styles.loadingIcon} />
                  <Text style={styles.loadingTitle}>Calculating learning path...</Text>
                  <Text style={styles.loadingDesc}>Analyzing your performance data to create a personalized plan.</Text>
                  <ActivityIndicator size="large" color="#4A90E2" style={{marginTop: 32}} />
              </View>
          </View>
      );
  }

  if (calculatedProfile) {
     const scores = calculatedProfile.assessmentScores!;
     const readingAvg = Math.round((scores.readingSpeed + scores.readingAccuracy + scores.readingComprehension) / 3);
     const writingAvg = Math.round((scores.writingSpeed + scores.writingQuality + scores.grammar) / 3);
     const spellingAvg = Math.round((scores.phoneticSpelling + scores.irregularSpelling + scores.spellingAccuracy) / 3);

     // Sort to find Primary (lowest), Secondary (middle), Last (highest)
     const focusAreas = [
        { name: 'Reading', score: readingAvg },
        { name: 'Writing', score: writingAvg },
        { name: 'Spelling', score: spellingAvg }
     ].sort((a, b) => a.score - b.score);

     return (
        <ScrollView contentContainerStyle={styles.resultScroll} style={styles.container}>
             <View style={styles.resultCard}>
                 <View style={styles.trophyIcon}>
                    <Trophy size={48} color="#CA8A04" />
                 </View>
                 <Text style={styles.resultTitle}>Assessment Complete!</Text>
                 <Text style={styles.resultSubtitle}>Learning path customized.</Text>
                 
                 <View style={styles.resultLevelBox}>
                    <Text style={styles.levelLabel}>Recommended Level</Text>
                    <View style={styles.levelRow}>
                        <Text style={styles.levelText}>{calculatedProfile.assignedDifficulty}</Text>
                        <Star fill="#4A90E2" color="#4A90E2" size={32} />
                    </View>
                 </View>

                 <View style={styles.focusContainer}>
                    <Text style={styles.focusHeader}>Your Learning Focus</Text>
                    
                    {/* Primary Focus (Lowest Score) */}
                    <View style={[styles.focusItem, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                        <View style={styles.focusRow}>
                            <AlertCircle color="#DC2626" size={24} />
                            <View style={{flex: 1}}>
                                <Text style={[styles.focusLabel, {color: '#B91C1C'}]}>Primary Focus</Text>
                                <Text style={styles.focusValue}>{focusAreas[0].name}</Text>
                            </View>
                            <Text style={styles.focusScore}>{focusAreas[0].score}%</Text>
                        </View>
                    </View>

                    {/* Secondary Focus */}
                    <View style={[styles.focusItem, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                        <View style={styles.focusRow}>
                            <TrendingUp color="#D97706" size={24} />
                            <View style={{flex: 1}}>
                                <Text style={[styles.focusLabel, {color: '#B45309'}]}>Secondary Focus</Text>
                                <Text style={styles.focusValue}>{focusAreas[1].name}</Text>
                            </View>
                            <Text style={styles.focusScore}>{focusAreas[1].score}%</Text>
                        </View>
                    </View>

                    {/* Last Focus (Highest Score) */}
                    <View style={[styles.focusItem, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
                        <View style={styles.focusRow}>
                            <CheckCircle color="#16A34A" size={24} />
                            <View style={{flex: 1}}>
                                <Text style={[styles.focusLabel, {color: '#15803D'}]}>Strongest Skill</Text>
                                <Text style={styles.focusValue}>{focusAreas[2].name}</Text>
                            </View>
                            <Text style={styles.focusScore}>{focusAreas[2].score}%</Text>
                        </View>
                    </View>
                 </View>

                 <TouchableOpacity 
                    onPress={() => onComplete(calculatedProfile)}
                    style={styles.primaryButton}
                 >
                    <Text style={styles.buttonText}>Continue to Learning Path</Text>
                 </TouchableOpacity>
             </View>
        </ScrollView>
     )
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.container}>
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>PROGRESS</Text>
        <Text style={styles.progressLabel}>{Math.round((currentTaskIndex / TASKS.length) * 100)}%</Text>
      </View>
      <View style={styles.progressBarBg}>
         <View style={[styles.progressBarFill, {width: `${(currentTaskIndex / TASKS.length) * 100}%`}]} />
      </View>

      <View style={styles.taskCard}>
         {gameState === 'INTRO' ? (
             <View style={styles.centerCol}>
                <View style={styles.iconCircle}>
                   <Brain size={48} color="#4A90E2" />
                </View>
                <Text style={styles.taskTitle}>{TASKS[currentTaskIndex]}</Text>
                <Text style={styles.taskDesc}>
                    {currentTaskIndex === 0 ? "Read the text aloud." : "Complete the task."}
                </Text>
                {currentTaskIndex === 0 ? (
                    <TouchableOpacity onPress={handleReadingSpeedStart} style={[styles.primaryButton, {flexDirection: 'row', gap: 12}]}>
                        <Mic color="#FFF" />
                        <Text style={styles.buttonText}>Start Recording</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={startTask} style={styles.primaryButton}>
                        <Text style={styles.buttonText}>Start</Text>
                    </TouchableOpacity>
                )}
             </View>
         ) : renderTask()}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFBF7',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9CA3AF',
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    marginBottom: 32,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4A90E2',
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    padding: 24,
    borderWidth: 2,
    borderColor: '#EFF6FF',
    minHeight: 500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCol: {
    alignItems: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 96,
    height: 96,
    backgroundColor: '#DBEAFE',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  taskTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1F2937',
  },
  taskDesc: {
    color: '#6B7280',
    marginBottom: 32,
    textAlign: 'center',
    fontSize: 18,
  },
  primaryButton: {
    paddingHorizontal: 48,
    paddingVertical: 16,
    backgroundColor: '#4A90E2',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  instructionText: {
    color: '#6B7280',
    fontWeight: 'bold',
    marginBottom: 16,
    fontSize: 16,
  },
  passageContainer: {
    backgroundColor: '#FFFBEB',
    padding: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FDE68A',
    marginBottom: 24,
    width: '100%',
    position: 'relative',
  },
  audioButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passageText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 16,
    lineHeight: 30,
  },
  stopButton: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hintText: {
    color: '#6B7280',
    fontSize: 16,
  },
  targetWord: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#4A90E2',
  },
  drawArea: {
    width: 300,
    height: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginBottom: 24,
    overflow: 'hidden',
  },
  clearButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
  },
  audioButtonSmall: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
  },
  passageTextSmall: {
    fontSize: 18,
    color: '#1F2937',
    paddingRight: 40,
  },
  questionText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: '#1F2937',
  },
  optionsContainer: {
    width: '100%',
    gap: 12,
  },
  optionButton: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  optionText: {
    fontWeight: 'bold',
    fontSize: 18,
    textAlign: 'center',
    color: '#1F2937',
  },
  resultScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    width: '100%',
    borderWidth: 2,
    borderColor: 'rgba(74, 144, 226, 0.1)',
    alignItems: 'center',
  },
  trophyIcon: {
    width: 96,
    height: 96,
    backgroundColor: '#FEF9C3',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#2D2D2D',
    marginBottom: 8,
    textAlign: 'center',
  },
  resultSubtitle: {
    color: '#6B7280',
    marginBottom: 32,
    textAlign: 'center',
  },
  resultLevelBox: {
    backgroundColor: '#F9FAFB',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 24,
  },
  levelLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#4A90E2',
  },
  focusContainer: {
    width: '100%',
    marginBottom: 32,
    gap: 12,
  },
  focusHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  focusItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  focusLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  focusValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  focusScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FDFBF7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    width: '100%',
  },
  loadingIcon: {
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  loadingDesc: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});
