import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Brain, Mail, User, Baby, ArrowLeft, CheckCircle, Send, Activity, ChevronDown } from 'lucide-react-native';
import { db } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore/lite';
import { GuardianApplication } from '../types';

interface SignUpProps {
  onBack: () => void;
}

export const SignUpScreen: React.FC<SignUpProps> = ({ onBack }) => {
  const [formData, setFormData] = useState({
    guardianName: '',
    email: '',
    childName: '',
    childAge: '',
    relationship: 'Parent'
  });
  
  const [ratings, setRatings] = useState({
    reading: 0,
    writing: 0,
    spelling: 0
  });

  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [relationshipModalVisible, setRelationshipModalVisible] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (ratings.reading === 0 || ratings.writing === 0 || ratings.spelling === 0) {
        Alert.alert("Incomplete Assessment", "Please assign a unique priority rank (1, 2, or 3) to each skill.");
        return;
    }
    if (!formData.guardianName || !formData.email || !formData.childName || !formData.childAge) {
        Alert.alert("Missing Fields", "Please fill in all required fields.");
        return;
    }

    setLoading(true);

    try {
      const applicationData: GuardianApplication = {
        ...formData,
        difficultyRatings: ratings,
        status: 'PENDING',
        dateApplied: new Date().toISOString()
      };

      await addDoc(collection(db, 'applications'), applicationData);
      setIsSubmitted(true);
    } catch (error) {
      console.error("Error submitting application: ", error);
      Alert.alert("Error", "There was an error submitting your application. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = (category: 'reading' | 'writing' | 'spelling', value: number) => {
    setRatings(prev => {
        if (prev[category] === value) {
            return { ...prev, [category]: 0 };
        }
        return { ...prev, [category]: value };
    });
  };

  const isValueTaken = (currentCategory: string, value: number) => {
     return Object.entries(ratings).some(([key, rating]) => key !== currentCategory && rating === value);
  };

  const renderRatingGroup = (label: string, category: 'reading' | 'writing' | 'spelling') => (
    <View style={styles.ratingGroup}>
        <Text style={styles.label}>{label} Priority</Text>
        <View style={styles.ratingButtons}>
            {[1, 2, 3].map((val) => {
                const taken = isValueTaken(category, val);
                const selected = ratings[category] === val;
                return (
                    <TouchableOpacity
                        key={val}
                        onPress={() => !taken && handleRatingChange(category, val)}
                        disabled={taken}
                        style={[
                            styles.ratingButton,
                            selected ? styles.ratingButtonSelected : taken ? styles.ratingButtonTaken : styles.ratingButtonDefault
                        ]}
                    >
                        <Text style={[
                            styles.ratingButtonText,
                            selected ? {color: '#4A90E2'} : taken ? {color: '#D1D5DB'} : {color: '#9CA3AF'}
                        ]}>
                            {val}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    </View>
  );

  if (isSubmitted) {
    return (
      <View style={styles.submittedContainer}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <CheckCircle size={48} color="#16A34A" />
          </View>
          <Text style={styles.successTitle}>Application Sent!</Text>
          <Text style={styles.successText}>
            Thank you for applying to LexiLearn. An Administrator will review your details. 
            {"\n\n"}
            If approved, you will receive your login credentials via email at:
            {"\n"}
            <Text style={{fontWeight: 'bold', color: '#4A90E2'}}>{formData.email}</Text>
          </Text>
          <TouchableOpacity 
            onPress={onBack}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} style={styles.container}>
      <View style={styles.card}>
        <TouchableOpacity 
          onPress={onBack}
          style={styles.headerBack}
        >
          <ArrowLeft size={20} color="#6B7280" /> 
          <Text style={styles.headerBackText}>Back to Login</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Brain size={32} color="#4A90E2" />
          </View>
          <Text style={styles.title}>Guardian Application</Text>
          <Text style={styles.subtitle}>
            Apply for an account. Our admins will create your secure access profile.
          </Text>
        </View>

        <View style={styles.form}>
            <View>
              <Text style={styles.label}>Guardian Name</Text>
              <View style={styles.inputWrapper}>
                <User style={styles.inputIcon} size={18} color="#9CA3AF" />
                <TextInput 
                  value={formData.guardianName}
                  onChangeText={(t) => setFormData({...formData, guardianName: t})}
                  style={styles.textInput}
                  placeholder="Your Name"
                />
              </View>
            </View>

            <View>
              <Text style={styles.label}>Relationship</Text>
              <TouchableOpacity 
                onPress={() => setRelationshipModalVisible(true)}
                style={styles.selectInput}
              >
                 <Text style={styles.selectText}>{formData.relationship}</Text>
                 <ChevronDown size={18} color="#9CA3AF" />
              </TouchableOpacity>
              
              <Modal visible={relationshipModalVisible} transparent animationType="fade">
                <Pressable onPress={() => setRelationshipModalVisible(false)} style={styles.modalOverlay}>
                   <View style={styles.modalContent}>
                      {['Mother', 'Father', 'Grandparent', 'Teacher', 'Other'].map(r => (
                          <TouchableOpacity key={r} onPress={() => { setFormData({...formData, relationship: r}); setRelationshipModalVisible(false); }} style={styles.modalItem}>
                             <Text style={styles.modalText}>{r}</Text>
                          </TouchableOpacity>
                      ))}
                   </View>
                </Pressable>
              </Modal>
            </View>

          <View>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Mail style={styles.inputIcon} size={18} color="#9CA3AF" />
              <TextInput 
                value={formData.email}
                onChangeText={(t) => setFormData({...formData, email: t})}
                style={styles.textInput}
                placeholder="Where to send login info"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{flex: 1, marginRight: 16}}>
              <Text style={styles.label}>Child's Name</Text>
              <View style={styles.inputWrapper}>
                <Baby style={styles.inputIcon} size={18} color="#9CA3AF" />
                <TextInput 
                  value={formData.childName}
                  onChangeText={(t) => setFormData({...formData, childName: t})}
                  style={styles.textInput}
                  placeholder="Name"
                />
              </View>
            </View>
            <View style={{width: 80}}>
              <Text style={styles.label}>Age</Text>
              <TextInput 
                value={formData.childAge}
                onChangeText={(t) => setFormData({...formData, childAge: t})}
                style={[styles.textInput, {textAlign: 'center', paddingLeft: 12}]}
                placeholder="Age"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.assessmentBox}>
            <View style={styles.assessmentHeader}>
                <Activity size={20} color="#4A90E2" />
                <Text style={styles.assessmentTitle}>Focus Area Assessment</Text>
            </View>
            <Text style={styles.assessmentDesc}>
                Rank each skill (1-3) based on learning needs. 
                {"\n"}(1 = Primary Focus, 2 = Secondary, 3 = Last Focus).
                {"\n"}<Text style={{color: '#4A90E2'}}>Tip: Tap a number again to deselect.</Text>
            </Text>
            
            <View>
                {renderRatingGroup('Reading', 'reading')}
                {renderRatingGroup('Writing', 'writing')}
                {renderRatingGroup('Spelling', 'spelling')}
            </View>
          </View>

          <TouchableOpacity 
            onPress={handleSubmit}
            disabled={loading}
            style={styles.submitButton}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : (
                <>
                    <Send size={20} color="#FFF" />
                    <Text style={styles.submitButtonText}>Submit Application</Text>
                </>
            )}
          </TouchableOpacity>
        </View>
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
    marginVertical: 32,
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  headerBackText: {
    color: '#6B7280',
    fontWeight: 'bold',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    padding: 12,
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D2D2D',
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 10,
  },
  textInput: {
    width: '100%',
    paddingLeft: 40,
    paddingRight: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  selectInput: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  selectText: {
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
    maxWidth: 320,
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
    color: '#374151',
  },
  row: {
    flexDirection: 'row',
  },
  assessmentBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    marginTop: 8,
  },
  assessmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  assessmentTitle: {
    fontWeight: 'bold',
    color: '#1F2937',
  },
  assessmentDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 16,
    lineHeight: 18,
  },
  ratingGroup: {
    marginBottom: 16,
  },
  ratingButtons: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ratingButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  ratingButtonSelected: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  ratingButtonTaken: {
    backgroundColor: '#F3F4F6',
  },
  ratingButtonDefault: {
    backgroundColor: 'transparent',
  },
  ratingButtonText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  submitButton: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: '#4A90E2',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
  },
  submittedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDFBF7',
    padding: 16,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: 'rgba(102, 187, 106, 0.2)',
    alignItems: 'center',
  },
  successIcon: {
    width: 80,
    height: 80,
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  successText: {
    color: '#4B5563',
    marginBottom: 32,
    textAlign: 'center',
    fontSize: 16,
  },
  backButton: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#374151',
    fontWeight: 'bold',
    fontSize: 16,
  },
});