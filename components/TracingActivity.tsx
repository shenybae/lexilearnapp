
import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, PanResponder, Dimensions, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TracingItem, Difficulty } from '../types';
import { DIFFICULTY_SETTINGS } from '../constants';
import { Eraser, ChevronLeft, ChevronRight, AlertCircle, ScanLine, ArrowRight, XCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface TracingActivityProps {
  items: TracingItem[];
  difficulty: Difficulty;
  onComplete: (score: number) => void;
  onExit: () => void;
}

interface Point {
  x: number;
  y: number;
  visited: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_PADDING = 32;
const CANVAS_SIZE = Math.min(SCREEN_WIDTH - CANVAS_PADDING, 400); 
const SCALE = CANVAS_SIZE / 300; 

// --- Geometry Helpers ---

const cubicBezier = (t: number, p0: number, p1: number, p2: number, p3: number) => 
  (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;

const sampleBezier = (p0: {x:number, y:number}, p1: {x:number, y:number}, p2: {x:number, y:number}, p3: {x:number, y:number}) => {
  const pts = [];
  // High segment count for smooth hit detection on curves
  const segments = 60; 
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push({ x: cubicBezier(t, p0.x, p1.x, p2.x, p3.x), y: cubicBezier(t, p0.y, p1.y, p2.y, p3.y) });
  }
  return pts;
};

const distance = (p1: {x:number, y:number}, p2: {x:number, y:number}) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
const lerp = (p1: {x:number, y:number}, p2: {x:number, y:number}, t: number) => ({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t });

const generateCheckpoints = (d: string): Point[] => {
    const commands = d.match(/([a-df-z])|([+-]?\d*\.?\d+(?:e[+-]?\d+)?)/gi);
    if (!commands) return [];

    let idx = 0;
    let cursor = { x: 0, y: 0 };
    const points: Point[] = [];

    const nextNum = () => parseFloat(commands[idx++]);
    const addPt = (x: number, y: number) => points.push({ x, y, visited: false });

    // Ensure we start at 0,0 if not specified (though M usually leads)
    if (commands[0] && commands[0].toUpperCase() !== 'M') {
        addPt(0,0);
    }

    while (idx < commands.length) {
        const cmd = commands[idx++];
        
        // Skip pure numbers if not consumed by a command (prevents infinite loop/bad parse)
        if (!isNaN(parseFloat(cmd))) { 
            continue; 
        } 
        
        const upper = cmd.toUpperCase();

        switch (upper) {
            case 'M': 
                cursor = { x: nextNum(), y: nextNum() };
                addPt(cursor.x, cursor.y);
                break;
            case 'L': 
                {
                    const next = { x: nextNum(), y: nextNum() };
                    const dist = distance(cursor, next);
                    const steps = Math.max(5, Math.floor(dist / 4)); 
                    for (let i = 1; i <= steps; i++) {
                        const pt = lerp(cursor, next, i / steps);
                        addPt(pt.x, pt.y);
                    }
                    cursor = next;
                }
                break;
            case 'C':
                {
                    const c1 = { x: nextNum(), y: nextNum() };
                    const c2 = { x: nextNum(), y: nextNum() };
                    const end = { x: nextNum(), y: nextNum() };
                    const bez = sampleBezier(cursor, c1, c2, end);
                    bez.forEach(p => addPt(p.x, p.y));
                    cursor = end;
                }
                break;
            case 'Q': 
                {
                    const c1 = { x: nextNum(), y: nextNum() };
                    const end = { x: nextNum(), y: nextNum() };
                    const cp1 = { x: cursor.x + 2/3 * (c1.x - cursor.x), y: cursor.y + 2/3 * (c1.y - cursor.y) };
                    const cp2 = { x: end.x + 2/3 * (c1.x - end.x), y: end.y + 2/3 * (c1.y - end.y) };
                    const bez = sampleBezier(cursor, cp1, cp2, end);
                    bez.forEach(p => addPt(p.x, p.y));
                    cursor = end;
                }
                break;
            case 'Z':
                break;
            default:
                // Consume arguments of unknown commands to avoid getting stuck
                while(idx < commands.length && !isNaN(parseFloat(commands[idx]))) idx++;
                break;
        }
    }
    return points;
};

export const TracingActivity: React.FC<TracingActivityProps> = ({ items, difficulty, onComplete, onExit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userPath, setUserPath] = useState<string>('');
  const [result, setResult] = useState<{score: number, errorRate: number, progress: number, errors: number} | null>(null);
  const [isOutOfBounds, setIsOutOfBounds] = useState(false);
  const [liveStats, setLiveStats] = useState({ errorRate: 0, errors: 0, progress: 0 });

  const currentItem = items[currentIndex];
  const difficultyConfig = currentItem.difficultyConfig?.[difficulty];
  const activePathData = difficultyConfig?.pathData || currentItem.pathData;
  const activeLabel = difficultyConfig?.label || currentItem.label;
  const settings = DIFFICULTY_SETTINGS[difficulty];

  // Refs
  const checkpointsRef = useRef<Point[]>([]);
  const statsRef = useRef({ total: 0, valid: 0, errors: 0 });
  const lastHapticRef = useRef(0);
  const lastPointRef = useRef<{x: number, y: number} | null>(null);
  
  // Animation Ref
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkpointsRef.current = generateCheckpoints(activePathData);
    resetState();
  }, [currentIndex, difficulty, activePathData]);

  const resetState = () => {
    setUserPath('');
    setResult(null);
    setIsOutOfBounds(false);
    setLiveStats({ errorRate: 0, errors: 0, progress: 0 });
    statsRef.current = { total: 0, valid: 0, errors: 0 };
    lastPointRef.current = null;
    checkpointsRef.current.forEach(p => p.visited = false);
    shakeAnim.setValue(0);
  };

  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true, easing: Easing.linear })
    ]).start();
  };

  const triggerErrorFeedback = () => {
      const now = Date.now();
      // Throttle heavy feedback
      if (now - lastHapticRef.current > 300) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          triggerShake();
          lastHapticRef.current = now;
      }
  };

  const checkIsInside = (x: number, y: number) => {
    const svgX = x / SCALE;
    const svgY = y / SCALE;
    const toleranceRadius = (settings.strokeWidth / 2) + settings.tolerance;
    // CRITICAL FIX: Visit radius same as tolerance. If you are safe, you are scoring.
    const visitRadius = toleranceRadius; 
    
    let isInside = false;
    let distanceToAny = Number.MAX_VALUE;

    for (const cp of checkpointsRef.current) {
        const d = Math.hypot(cp.x - svgX, cp.y - svgY);
        distanceToAny = Math.min(distanceToAny, d);
        if (d < toleranceRadius) {
            isInside = true;
            if (!cp.visited && d < visitRadius) {
                cp.visited = true;
            }
        }
    }
    return { isInside, distanceToAny, toleranceRadius };
  };

  const handleTouch = (x: number, y: number): boolean => {
    const { isInside, distanceToAny, toleranceRadius } = checkIsInside(x, y);

    statsRef.current.total++;

    if (isInside) {
      statsRef.current.valid++;
      if (isOutOfBounds) setIsOutOfBounds(false);
    } else {
       statsRef.current.errors++;
       
       if (!isOutOfBounds) {
           setIsOutOfBounds(true);
           triggerErrorFeedback();
       } else {
           triggerErrorFeedback();
       }
    }

    // Live Stats Update
    if (statsRef.current.total % 3 === 0) {
        const visited = checkpointsRef.current.filter(c => c.visited).length;
        const totalPoints = checkpointsRef.current.length || 1;
        const rawProgress = visited / totalPoints;
        
        // Progress display slightly boosted for encouragement
        const progress = Math.min(100, Math.round(rawProgress * 100));
        const errorRate = statsRef.current.total > 0 
            ? Math.round((statsRef.current.errors / statsRef.current.total) * 100) 
            : 0;
        
        setLiveStats({ errorRate, errors: statsRef.current.errors, progress });
    }

    return isInside;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const { isInside, toleranceRadius } = checkIsInside(locationX, locationY);
        
        if (isInside) {
            setIsOutOfBounds(false);
            
            // Allow lifting: resume if near last point. Scale distance by tolerance to match difficulty.
            const resumeDist = toleranceRadius * 2 * SCALE;
            const dist = lastPointRef.current ? Math.hypot(locationX - lastPointRef.current.x, locationY - lastPointRef.current.y) : Infinity;
            
            if (lastPointRef.current && dist < resumeDist) {
                 // Close enough to consider a continuation
                 setUserPath(prev => {
                     // Safety check: Path must not start with L
                     if (!prev) return `M ${locationX} ${locationY}`;
                     return `${prev} L ${locationX} ${locationY}`;
                 });
            } else {
                 // Start a new segment
                 setUserPath(prev => prev ? `${prev} M ${locationX} ${locationY}` : `M ${locationX} ${locationY}`);
            }
            
            lastPointRef.current = { x: locationX, y: locationY };
            handleTouch(locationX, locationY);
        } else {
            setIsOutOfBounds(true);
            triggerErrorFeedback();
        }
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const isInside = handleTouch(locationX, locationY);
        // Only allow drawing updates if inside. 
        if (isInside) {
            setUserPath(prev => `${prev} L ${locationX} ${locationY}`);
            lastPointRef.current = { x: locationX, y: locationY };
        }
      },
      onPanResponderRelease: () => {
        calculateScore();
      }
    })
  ).current;

  const calculateScore = () => {
    // Recalculate precisely based on visited checkpoints
    const visited = checkpointsRef.current.filter(c => c.visited).length;
    const totalPoints = checkpointsRef.current.length || 1;
    const rawProgress = visited / totalPoints;
    
    // SCORING UPDATE: 
    // Increased threshold to 96% to require virtually complete filling of the element.
    let finalScore = 0;
    if (rawProgress >= 0.96) {
        finalScore = 100;
    } else {
        // Map remaining range linearly
        finalScore = Math.round((rawProgress / 0.96) * 100);
    }

    // Only deduct for excessive errors if the score isn't perfect
    if (finalScore < 100 && liveStats.errorRate > 20) {
        finalScore -= Math.round((liveStats.errorRate - 20) / 2);
    }
    finalScore = Math.max(0, finalScore);

    // Show result if they made significant progress
    if (finalScore > 50 || (statsRef.current.total > 10 && finalScore > 20)) {
        setResult({
            score: finalScore,
            errorRate: liveStats.errorRate,
            progress: Math.round(rawProgress * 100),
            errors: statsRef.current.errors
        });
    }
  };

  const nextItem = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevItem = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onExit} style={styles.backButton}>
          <ChevronLeft color="#4B5563" size={24} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.difficultyLabel}>{difficulty} Difficulty</Text>
          <Text style={styles.taskTitle}>{currentIndex + 1}. {activeLabel}</Text>
        </View>
        <View style={styles.counterBadge}>
            <Text style={styles.counterText}>{currentIndex + 1}/40</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
         <View style={styles.statItem}>
            <AlertCircle size={14} color={liveStats.errorRate > 20 ? 'red' : 'green'} />
            <Text style={styles.statText}>Error Rate: {liveStats.errorRate}%</Text>
         </View>
         <View style={styles.statItem}>
            <ScanLine size={14} color="blue" />
            <Text style={styles.statText}>Progress: {Math.round((checkpointsRef.current.filter(c => c.visited).length / (checkpointsRef.current.length || 1)) * 100)}%</Text>
         </View>
      </View>

      <View style={styles.mainArea}>
          
          {/* Navigation Buttons */}
          <TouchableOpacity 
            onPress={prevItem} 
            disabled={currentIndex === 0}
            style={[styles.navButton, styles.navLeft, currentIndex === 0 && {opacity: 0.3}]}
          >
            <ChevronLeft size={32} color="#000" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={nextItem} 
            disabled={currentIndex === items.length - 1}
            style={[styles.navButton, styles.navRight, currentIndex === items.length - 1 && {opacity: 0.3}]}
          >
            <ChevronRight size={32} color="#000" />
          </TouchableOpacity>

          {/* Canvas */}
          <Animated.View 
            style={[
                styles.canvasContainer, 
                isOutOfBounds ? styles.canvasError : styles.canvasNormal,
                { 
                  width: CANVAS_SIZE + 16, 
                  height: CANVAS_SIZE + 16,
                  transform: [{ translateX: shakeAnim }] 
                }
            ]}
          >
            {isOutOfBounds && (
                <View style={styles.offTrackWarning}>
                    <XCircle size={24} color="#FFF" style={{marginRight: 8}} />
                    <Text style={styles.offTrackText}>OFF TRACK</Text>
                </View>
            )}

            <View 
                style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
                {...panResponder.panHandlers}
            >
                <Svg height={CANVAS_SIZE} width={CANVAS_SIZE} viewBox={`0 0 300 300`}>
                    {/* Background Tolerance Zone (Light) */}
                    <Path
                        d={activePathData}
                        stroke="#F1F5F9"
                        strokeWidth={settings.strokeWidth + (settings.tolerance * 2)} 
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.3}
                    />
                    {/* Visible Path Guide */}
                    <Path
                        d={activePathData}
                        stroke="#CBD5E1"
                        strokeWidth={settings.strokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {/* Dashed Center Line */}
                    <Path
                        d={activePathData}
                        stroke="#94A3B8"
                        strokeWidth={2}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="12, 12"
                    />
                </Svg>

                <Svg style={StyleSheet.absoluteFill} height={CANVAS_SIZE} width={CANVAS_SIZE}>
                    <Path
                        d={userPath}
                        stroke="rgba(74, 144, 226, 0.7)"
                        // Increased stroke width slightly to enhance "filling" feel
                        strokeWidth={settings.strokeWidth * SCALE * 0.9}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </Svg>
            </View>

            {result && (
                <View style={styles.resultOverlay}>
                    <Text style={[styles.resultTitle, {color: result.score > 60 ? '#16A34A' : '#F97316'}]}>
                        {result.score > 60 ? 'Great Job!' : 'Keep Trying'}
                    </Text>
                    <Text style={styles.resultScore}>{result.score}</Text>
                    
                    <View style={styles.resultDetails}>
                        <Text style={styles.resultDetailText}>Error Rate: {result.errorRate}%</Text>
                    </View>

                    <View style={styles.resultActions}>
                        {result.score > 60 ? (
                            <TouchableOpacity 
                                onPress={() => {
                                    onComplete(result.score);
                                    if (currentIndex < items.length - 1) {
                                        setCurrentIndex(prev => prev + 1);
                                    } else {
                                        onExit();
                                    }
                                }}
                                style={styles.nextButton}
                            >
                                <Text style={styles.buttonTextWhite}>Next Level</Text>
                                <ArrowRight size={20} color="#FFF" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity 
                                onPress={resetState}
                                style={styles.retryButton}
                            >
                                <Text style={styles.buttonTextGray}>Retry</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}
          </Animated.View>
      </View>

      <View style={styles.footerControls}>
        <TouchableOpacity onPress={resetState} style={styles.clearButton}>
            <Eraser color="#dc2626" size={20} />
            <Text style={styles.clearButtonText}>Clear Board</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFBF7',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    color: '#4B5563',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  titleContainer: {
    alignItems: 'center',
  },
  difficultyLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D2D2D',
  },
  counterBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  counterText: {
    color: '#2563EB',
    fontWeight: 'bold',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4B5563',
  },
  mainArea: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    position: 'relative',
  },
  navButton: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'absolute',
    zIndex: 20,
  },
  navLeft: {
    left: 0,
  },
  navRight: {
    right: 0,
  },
  canvasContainer: {
    backgroundColor: 'white',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  canvasNormal: {
    borderColor: '#E6F3F7',
  },
  canvasError: {
    borderColor: '#EF4444', // Red border when error
  },
  offTrackWarning: {
    position: 'absolute',
    top: 24,
    zIndex: 10,
    backgroundColor: '#EF4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  offTrackText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  resultOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 32,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    width: '85%',
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultScore: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  resultDetails: {
    marginBottom: 24,
  },
  resultDetailText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#4A90E2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  retryButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonTextWhite: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonTextGray: {
    color: '#374151',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 30,
  },
  clearButtonText: {
    color: '#DC2626',
    fontWeight: 'bold',
  },
});
