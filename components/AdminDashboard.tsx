import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Linking, Platform } from 'react-native';
import { GuardianApplication } from '../types';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Shield, CheckCircle, XCircle, Clock, Search, LogOut, Mail, User, Baby, BookOpen, PenTool, Type, RefreshCw, Send, AlertCircle } from 'lucide-react-native';

interface AdminDashboardProps {
  userEmail: string;
  onExit: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ userEmail, onExit }) => {
  const [applications, setApplications] = useState<GuardianApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('PENDING');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'applications'), orderBy('dateApplied', 'desc'));
      const snapshot = await getDocs(q);
      const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GuardianApplication));
      setApplications(apps);
    } catch (error: any) {
      console.error("Error fetching applications:", error);
      if (error.code === 'permission-denied') {
          // Fallback to Demo Data so the app is usable for testing
          setError("Access Denied: Using Demo Data");
          setApplications([
              {
                  id: 'demo1',
                  uid: 'demoUid1',
                  guardianName: 'Sarah Smith',
                  email: 'sarah@example.com',
                  childName: 'Leo',
                  childAge: '8',
                  relationship: 'Parent',
                  difficultyRatings: { reading: 1, writing: 2, spelling: 3 },
                  status: 'PENDING',
                  dateApplied: new Date().toISOString()
              },
              {
                  id: 'demo2',
                  uid: 'demoUid2',
                  guardianName: 'Mike Jones',
                  email: 'mike@example.com',
                  childName: 'Sam',
                  childAge: '10',
                  relationship: 'Teacher',
                  difficultyRatings: { reading: 2, writing: 1, spelling: 3 },
                  status: 'APPROVED',
                  dateApplied: new Date(Date.now() - 86400000).toISOString()
              }
          ]);
      } else {
          setError("Could not load applications. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (app: GuardianApplication, newStatus: 'APPROVED' | 'REJECTED') => {
    // If working with demo data, just update local state
    if (app.id && app.id.startsWith('demo')) {
        setApplications(prev => prev.map(a => 
            a.id === app.id ? { ...a, status: newStatus } : a
        ));
        Alert.alert("Demo Mode", `Action simulated: ${newStatus}`);
        return;
    }

    if (!app.uid || !app.id) {
        Alert.alert("Error", "User ID missing for this application. Cannot update user record.");
        return;
    }

    const processUpdate = async () => {
        try {
            // 1. Update Application Status (So Admin sees it's handled)
            const appRef = doc(db, 'applications', app.id!);
            await updateDoc(appRef, { status: newStatus });
      
            // 2. Update User Profile Status in 'users' collection
            const userRef = doc(db, 'users', app.uid!);
            await updateDoc(userRef, { status: newStatus });
      
            setApplications(prev => prev.map(a => 
              a.id === app.id ? { ...a, status: newStatus } : a
            ));
            
            if (newStatus === 'APPROVED') {
                // 3. Draft Email to User (Simulating sending credentials)
                Alert.alert(
                    "Approved",
                    "The account is now active. Would you like to send the approval email with credentials now?",
                    [
                        { text: "No", style: "cancel" },
                        { 
                            text: "Send Email", 
                            onPress: () => {
                                const subject = "LexiLearn Account Approved - Login Details";
                                const body = `Dear ${app.guardianName},\n\nCongratulations! Your Guardian Application for LexiLearn has been approved.\n\nYou may now log in to the application.\n\n-------------------------\nYour Login Credentials:\n\nUsername: ${app.email}\nPassword: [The password you set during application]\n-------------------------\n\nPlease keep this information safe.\n\nBest,\nLexiLearn Admin Team`;
                                const mailUrl = `mailto:${app.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                Linking.openURL(mailUrl).catch(err => console.error("Could not open mail client", err));
                            } 
                        }
                    ]
                );
            } else {
                Alert.alert("Rejected", "Application has been rejected.");
            }
      
          } catch (error: any) {
            console.error("Error updating status:", error);
            if (error.code === 'permission-denied') {
                Alert.alert("Permission Error", "You do not have permission to perform this action.");
            } else {
                Alert.alert("Error", "Failed to update status. Please try again.");
            }
          }
    };

    if (newStatus === 'APPROVED') {
        Alert.alert(
            "Confirm Approval",
            `Are you sure you want to approve access for ${app.guardianName}?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Approve Access", onPress: processUpdate }
            ]
        );
    } else {
        Alert.alert(
            "Confirm Rejection",
            `Are you sure you want to REJECT ${app.guardianName}? They will not be able to log in.`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Reject", style: "destructive", onPress: processUpdate }
            ]
        );
    }
  };

  const filteredApps = applications.filter(app => {
    if (filter === 'ALL') return true;
    return app.status === filter;
  });

  const getRatingStyle = (rating: number) => {
      if (rating === 1) return { bg: '#FEE2E2', text: '#B91C1C' };
      if (rating === 2) return { bg: '#FEF3C7', text: '#B45309' };
      return { bg: '#DCFCE7', text: '#15803D' };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.shieldIcon}>
            <Shield stroke="#FFF" size={24} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSubtitle}>Logged in as {userEmail}</Text>
          </View>
        </View>
        <TouchableOpacity 
          onPress={onExit}
          style={styles.logoutButton}
        >
          <LogOut size={20} stroke="#374151" />
        </TouchableOpacity>
      </View>

      {error ? (
          <View style={styles.errorBar}>
              <AlertCircle size={20} stroke="#FFF" />
              <Text style={styles.errorBarText}>{error} - Check Firestore Rules</Text>
          </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {/* Stats Row */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll} contentContainerStyle={styles.statsContainer}>
            <View style={styles.statCard}>
                <View style={styles.statRow}>
                <View>
                    <Text style={styles.statLabel}>Pending</Text>
                    <Text style={[styles.statValue, {color: '#2563EB'}]}>{applications.filter(a => a.status === 'PENDING').length}</Text>
                </View>
                <View style={[styles.statIcon, {backgroundColor: '#EFF6FF'}]}>
                    <Clock size={24} stroke="#3B82F6" />
                </View>
                </View>
            </View>
            
            <View style={styles.statCard}>
                <View style={styles.statRow}>
                <View>
                    <Text style={styles.statLabel}>Total Users</Text>
                    <Text style={[styles.statValue, {color: '#16A34A'}]}>{applications.filter(a => a.status === 'APPROVED').length}</Text>
                </View>
                <View style={[styles.statIcon, {backgroundColor: '#ECFDF5'}]}>
                    <User size={24} stroke="#10B981" />
                </View>
                </View>
            </View>
            
            <View style={styles.statCard}>
                <View style={styles.statRow}>
                <View>
                    <Text style={styles.statLabel}>System Status</Text>
                    <Text style={styles.statusText}>Active</Text>
                </View>
                <View style={[styles.statIcon, {backgroundColor: '#F5F3FF'}]}>
                    <Shield size={24} stroke="#8B5CF6" />
                </View>
                </View>
            </View>
            </ScrollView>

            {/* Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {['PENDING', 'APPROVED', 'ALL'].map((f) => (
                <TouchableOpacity
                key={f}
                onPress={() => setFilter(f as any)}
                style={[
                    styles.filterButton,
                    filter === f ? styles.filterActive : styles.filterInactive
                ]}
                >
                <Text style={[styles.filterText, filter === f ? styles.filterTextActive : styles.filterTextInactive]}>
                    {f === 'ALL' ? 'All Applications' : f.charAt(0) + f.slice(1).toLowerCase()}
                </Text>
                </TouchableOpacity>
            ))}
            </ScrollView>

            {/* List */}
            <View style={styles.listContainer}>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4A90E2" />
                    <Text style={styles.loadingText}>Loading applications from database...</Text>
                </View>
            ) : filteredApps.length === 0 ? (
                <View style={styles.loadingContainer}>
                <Search size={48} stroke="#E5E7EB" />
                <Text style={styles.emptyText}>No applications found matching this filter.</Text>
                </View>
            ) : (
                <View>
                    {filteredApps.map((app, index) => (
                    <View key={app.id || index} style={styles.applicationItem}>
                        
                        {/* Header Line */}
                        <View style={styles.appHeader}>
                            <View>
                                <Text style={styles.guardianName}>{app.guardianName}</Text>
                                <View style={styles.emailRow}>
                                    <Mail size={14} stroke="#6B7280" />
                                    <Text style={styles.emailText}>{app.email}</Text>
                                </View>
                            </View>
                            <View style={[
                                styles.statusBadge,
                                app.status === 'PENDING' ? {backgroundColor: '#DBEAFE'} :
                                app.status === 'APPROVED' ? {backgroundColor: '#DCFCE7'} : {backgroundColor: '#FEE2E2'}
                            ]}>
                                <Text style={[
                                    styles.statusTextBadge,
                                    app.status === 'PENDING' ? {color: '#1D4ED8'} :
                                    app.status === 'APPROVED' ? {color: '#15803D'} : {color: '#B91C1C'}
                                ]}>{app.status}</Text>
                            </View>
                        </View>

                        {/* Child Info */}
                        <View style={styles.childInfoBox}>
                            <View style={styles.childRow}>
                                <View style={{flex: 1}}>
                                    <Text style={styles.childLabel}>Child</Text>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                                        <Baby size={16} stroke="#4B5563" />
                                        <Text style={styles.childValue}>{app.childName} ({app.childAge})</Text>
                                    </View>
                                </View>
                                <View style={{flex: 1}}>
                                    <Text style={styles.childLabel}>Relationship</Text>
                                    <Text style={styles.childValue}>{app.relationship}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Ratings */}
                        <View style={styles.ratingsBox}>
                            <Text style={styles.ratingsTitle}>Assessment Priorities</Text>
                            <View style={styles.ratingsGrid}>
                                {[
                                    { label: 'Reading', val: app.difficultyRatings.reading, icon: BookOpen },
                                    { label: 'Writing', val: app.difficultyRatings.writing, icon: PenTool },
                                    { label: 'Spelling', val: app.difficultyRatings.spelling, icon: Type },
                                ].map((r) => {
                                    const style = getRatingStyle(r.val);
                                    return (
                                        <View key={r.label} style={[styles.ratingItem, {backgroundColor: style.bg}]}>
                                            <r.icon size={16} stroke={style.text} style={{marginBottom: 4}} />
                                            <Text style={[styles.ratingLabel, {color: style.text}]}>{r.label}</Text>
                                            <Text style={[styles.ratingScore, {color: style.text}]}>{r.val}</Text>
                                            <Text style={[styles.ratingValue, {color: style.text}]}>
                                                {r.val === 1 ? 'Primary' : r.val === 2 ? 'Secondary' : 'Low'}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Actions */}
                        {app.status === 'PENDING' && (
                            <View style={styles.actionRow}>
                                <TouchableOpacity 
                                    onPress={() => handleStatusChange(app, 'REJECTED')}
                                    style={styles.rejectButton}
                                >
                                    <XCircle size={18} stroke="#DC2626" />
                                    <Text style={[styles.buttonText, {color: '#DC2626'}]}>Reject</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => handleStatusChange(app, 'APPROVED')}
                                    style={styles.approveButton}
                                >
                                    <CheckCircle size={18} stroke="#16A34A" />
                                    <Text style={[styles.buttonText, {color: '#16A34A'}]}>Approve</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Approved State Action: Send Email again */}
                        {app.status === 'APPROVED' && (
                             <TouchableOpacity 
                                onPress={() => handleStatusChange(app, 'APPROVED')} 
                                style={styles.resendEmailButton}
                             >
                                <Send size={16} stroke="#4B5563" />
                                <Text style={styles.resendEmailText}>Resend Credentials Email</Text>
                             </TouchableOpacity>
                        )}
                    </View>
                    ))}
                </View>
            )}
            </View>
        </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFBF7' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shieldIcon: { width: 48, height: 48, backgroundColor: '#4A90E2', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  headerSubtitle: { fontSize: 12, color: '#6B7280' },
  logoutButton: { padding: 12, backgroundColor: '#F3F4F6', borderRadius: 12 },
  errorBar: {
    backgroundColor: '#DC2626',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorBarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statsScroll: { maxHeight: 100, marginBottom: 24 },
  statsContainer: { paddingHorizontal: 24, paddingVertical: 12, gap: 16 },
  statCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, width: 140, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statLabel: { fontSize: 12, color: '#6B7280', fontWeight: 'bold', marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  statIcon: { padding: 8, borderRadius: 8 },
  statusText: { fontSize: 16, fontWeight: 'bold', color: '#8B5CF6' },
  filterScroll: { paddingHorizontal: 24, marginBottom: 24, maxHeight: 50 },
  filterButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, marginRight: 12, borderWidth: 1 },
  filterActive: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  filterInactive: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  filterText: { fontWeight: 'bold' },
  filterTextActive: { color: '#FFFFFF' },
  filterTextInactive: { color: '#6B7280' },
  listContainer: { paddingHorizontal: 24, paddingBottom: 40 },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 16, color: '#6B7280' },
  emptyText: { marginTop: 16, color: '#9CA3AF', textAlign: 'center' },
  applicationItem: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6' },
  appHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  guardianName: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  emailText: { color: '#6B7280', fontSize: 14 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  statusTextBadge: { fontSize: 12, fontWeight: 'bold' },
  childInfoBox: { backgroundColor: '#F9FAFB', padding: 16, borderRadius: 16, marginBottom: 16 },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  childLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: 'bold', textTransform: 'uppercase' },
  childValue: { fontSize: 16, color: '#374151', fontWeight: 'bold' },
  ratingsBox: { marginBottom: 24 },
  ratingsTitle: { fontSize: 14, fontWeight: 'bold', color: '#374151', marginBottom: 12 },
  ratingsGrid: { flexDirection: 'row', gap: 8 },
  ratingItem: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  ratingLabel: { fontSize: 12, fontWeight: 'bold', color: '#6B7280', marginBottom: 4 },
  ratingValue: { fontSize: 12, fontWeight: 'bold', opacity: 0.8 },
  ratingScore: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 12 },
  approveButton: { flex: 1, backgroundColor: '#DCFCE7', paddingVertical: 12, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  rejectButton: { flex: 1, backgroundColor: '#FEE2E2', paddingVertical: 12, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  buttonText: { fontWeight: 'bold', fontSize: 14 },
  resendEmailButton: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 8 },
  resendEmailText: { color: '#4B5563', fontWeight: '600' }
});