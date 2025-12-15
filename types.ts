
import { ViewProps, TextProps, TouchableOpacityProps, PressableProps, ScrollViewProps, TextInputProps, ImageProps, FlatListProps } from 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface TouchableOpacityProps {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface FlatListProps<ItemT> {
    className?: string;
  }
}

export enum Screen {
  LOGIN = 'LOGIN',
  SIGN_UP = 'SIGN_UP',
  TWO_FACTOR = 'TWO_FACTOR',
  ASSESSMENT = 'ASSESSMENT',
  HOME = 'HOME',
  CHILD_DASHBOARD = 'CHILD_DASHBOARD',
  LEARNING_JOURNEY = 'LEARNING_JOURNEY',
  TRACING = 'TRACING',
  READING = 'READING',
  SPELLING = 'SPELLING',
  MEMORY = 'MEMORY',
  DASHBOARD = 'DASHBOARD',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  SETTINGS = 'SETTINGS',
  DIFFICULTY_SELECT = 'DIFFICULTY_SELECT'
}

export enum Difficulty {
  MILD = 'Mild',
  MODERATE = 'Moderate',
  SEVERE = 'Severe',
  PROFOUND = 'Profound'
}

export interface AssessmentScores {
  readingSpeed: number;
  readingAccuracy: number;
  readingComprehension: number;
  writingSpeed: number;
  writingQuality: number;
  grammar: number;
  phoneticSpelling: number;
  irregularSpelling: number;
  spellingAccuracy: number;
  overallAverage: number;
}

export interface ProgressRecord {
  date: string;
  activityType: 'Tracing' | 'Reading' | 'Spelling' | 'Memory';
  score: number;
  details: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  childName: string;
  role: 'Guardian' | 'Admin';
  assessmentComplete: boolean;
  assignedDifficulty: Difficulty;
  assessmentScores?: AssessmentScores;
  progressHistory?: ProgressRecord[];
}

export interface GuardianApplication {
  id?: string;
  guardianName: string;
  email: string;
  childName: string;
  childAge: string;
  relationship: string;
  difficultyRatings: {
    reading: number;
    writing: number;
    spelling: number;
  };
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  dateApplied: string;
}

export enum TracingCategory {
  LINES = 'Lines',
  LETTERS = 'Letters',
  NUMBERS = 'Numbers',
  SHAPES = 'Shapes'
}

export interface TracingVariant {
  pathData: string;
  label: string;
  viewBox?: string;
}

export interface TracingItem {
  id: string;
  category: TracingCategory;
  label: string;
  pathData: string; // Default/Fallback
  viewBox: string;
  difficultyConfig?: {
    [key in Difficulty]?: TracingVariant;
  };
}

export interface ReadingVariant {
  word: string;
  sentence: string;
}

export interface ReadingItem {
  id: string;
  difficultyLevel: number;
  word: string; // Default/Fallback
  sentence: string; // Default/Fallback
  difficultyConfig?: {
    [key in Difficulty]?: ReadingVariant;
  };
}

export interface SpellingItem {
  id: string;
  word: string;
  scrambled: string[];
  hint: string;
  contextSentence?: string; // New field for TTS context
}

export interface MemoryItem {
  id: string;
  sequence: string;
  type: 'Numbers' | 'Letters' | 'Mixed';
}

export interface PronunciationResult {
  score: number;
  isCorrect: boolean;
  feedback: string;
  phoneticBreakdown?: string;
  transcript?: string;
}