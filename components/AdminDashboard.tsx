
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { GuardianApplication } from '../types';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore/lite';
import { Shield, CheckCircle, XCircle, Clock, Search, LogOut, Mail, User, Baby, BookOpen, PenTool, Type } from 'lucide-react-native';

interface AdminDashboardProps {
  userEmail: string;
  onExit: () => void;
  isDemo: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ userEmail, onExit, isDemo }) => {
  const [applications, setApplications] = useState<GuardianApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('PENDING');

  const MOCK_APPS: GuardianApplication[] = [
    {
      id: 'mock1',
      guardianName: 'Sarah Jenkins',
      email: 'sarah.j@example.com',
      childName: 'Timmy',
      childAge: '8',
      relationship: 'Mother',
      difficultyRatings: { reading: 1, writing: 2, spelling: 3 }, 
      status: 'PENDING',
      dateApplied: new Date().toISOString()
    },
    {
      id: 'mock2',
      guardianName: 'Michael Chen',
      email: 'm.chen@example.com',
      childName: 'Lily',
      childAge: '10',
      relationship: 'Father',
      difficultyRatings: { reading: 2, writing: 3, spelling: 1 },
      status: 'PENDING',
      dateApplied: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'mock3',
      guardianName: 'Emily Davis',
      email: 'emily.d@school.edu',
      childName: 'Class 3B',
      childAge: '7-8',
      relationship: 'Teacher',
      difficultyRatings: { reading: 3, writing: 1, spelling: 2 },
      status: 'APPROVED',
      dateApplied: new Date(Date.now() - 172800000).toISOString()
    }
  ];

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    if (isDemo) {
      setTimeout(() => {
        setApplications(MOCK_APPS);
        setLoading(false);
      }, 800);
      return;
    }

    try {
      const q = query(collection(db, 'applications'), orderBy('dateApplied', 'desc'));
      const snapshot = await getDocs(q);
      const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GuardianApplication));
      setApplications(apps);
    } catch (error) {
      console.error("Error fetching applications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appId: string, newStatus: 'APPROVED' | 'REJECTED') => {
    if (isDemo) {
      setApplications(prev => prev.map(app => 
        app.id === appId ? { ...app, status: newStatus } : app
      ));
      if (newStatus === 'APPROVED') {
        Alert.alert("Demo Approved", "Application approved. Automated email sent to guardian with login credentials.");
      }
      return;
    }

    try {
      const appRef = doc(db, 'applications', appId);
      await updateDoc(appRef, { status: newStatus });
      setApplications(prev => prev.map(app => 
        app.id === appId ? { ...app, status: newStatus } : app
      ));
    } catch (error) {
      console.error("Error updating status:", error);
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
            <Shield color="#FFF" size={24} />
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
          <LogOut size={20} color="#374151" />
        </TouchableOpacity>
      </View>

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
                <Clock size={24} color="#3B82F6" />
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
                <User size={24} color="#10B981" />
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
                <Shield size={24} color="#8B5CF6" />
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
                <Text style={styles.loadingText}>Loading applications...</Text>
             </View>
           ) : filteredApps.length === 0 ? (
             <View style={styles.loadingContainer}>
               <Search size={48} color="#E5E7EB" />
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
                                <Mail size={14} color="#6B7280" />
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

                    {/* Child Profile Card */}
                    <View style={styles.childCard}>
                         <View style={styles.childHeader}>
                           <Baby size={16} color="#374151" />
                           <Text style={styles.childName}>Child: {app.childName} ({app.childAge})</Text>
                         </View>
                         
                         <View style={styles.ratingsContainer}>
                            <View style={styles.ratingRow}>
                                <View style={styles.ratingLabel}>
                                    <BookOpen size={14} color="#6B7280" />
                                    <Text style={styles.ratingText}>Reading</Text>
                                </View>
                                <View style={[styles.ratingBadge, {backgroundColor: getRatingStyle(app.difficultyRatings?.reading || 0).bg}]}>
                                    <Text style={[styles.ratingBadgeText, {color: getRatingStyle(app.difficultyRatings?.reading || 0).text}]}>Priority {app.difficultyRatings?.reading || 'N/A'}</Text>
                                </View>
                            </View>
                            <View style={styles.ratingRow}>
                                <View style={styles.ratingLabel}>
                                    <PenTool size={14} color="#6B7280" />
                                    <Text style={styles.ratingText}>Writing</Text>
                                </View>
                                <View style={[styles.ratingBadge, {backgroundColor: getRatingStyle(app.difficultyRatings?.writing || 0).bg}]}>
                                    <Text style={[styles.ratingBadgeText, {color: getRatingStyle(app.difficultyRatings?.writing || 0).text}]}>Priority {app.difficultyRatings?.writing || 'N/A'}</Text>
                                </View>
                            </View>
                            <View style={styles.ratingRow}>
                                <View style={styles.ratingLabel}>
                                    <Type size={14} color="#6B7280" />
                                    <Text style={styles.ratingText}>Spelling</Text>
                                </View>
                                <View style={[styles.ratingBadge, {backgroundColor: getRatingStyle(app.difficultyRatings?.spelling || 0).bg}]}>
                                    <Text style={[styles.ratingBadgeText, {color: getRatingStyle(app.difficultyRatings?.spelling || 0).text}]}>Priority {app.difficultyRatings?.spelling || 'N/A'}</Text>
                                </View>
                            </View>
                         </View>
                    </View>

                    {/* Actions */}
                    {app.status === 'PENDING' ? (
                      <View style={styles.actionButtons}>
                         <TouchableOpacity 
                           onPress={() => handleStatusChange(app.id!, 'APPROVED')}
                           style={styles.approveButton}
                         >
                           <CheckCircle size={18} color="#FFF" />
                           <Text style={styles.approveText}>Approve</Text>
                         </TouchableOpacity>
                         <TouchableOpacity 
                           onPress={() => handleStatusChange(app.id!, 'REJECTED')}
                           style={styles.rejectButton}
                         >
                           <XCircle size={18} color="#EF4444" />
                           <Text style={styles.rejectText}>Reject</Text>
                         </TouchableOpacity>
                      </View>
                    ) : (
                        <View style={styles.statusFooter}>
                            {app.status === 'APPROVED' ? <CheckCircle size={16} color="#10B981" /> : <XCircle size={16} color="#EF4444" />}
                            <Text style={[styles.statusFooterText, app.status === 'APPROVED' ? {color: '#16A34A'} : {color: '#EF4444'}]}>
                                {app.status === 'APPROVED' ? 'Access Granted' : 'Application Denied'}
                            </Text>
                        </View>
                    )}
                  </View>
                ))}
             </View>
           )}
        </View>
        <View style={{height: 80}} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  shieldIcon: {
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    color: '#6B7280',
    fontSize: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  statsScroll: {
    marginBottom: 24,
  },
  statsContainer: {
    gap: 16,
    paddingRight: 16,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    width: 250,
    marginRight: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statLabel: {
    color: '#6B7280',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 36,
    fontWeight: '800',
    marginTop: 8,
  },
  statIcon: {
    padding: 12,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  filterScroll: {
    marginBottom: 24,
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
    borderWidth: 1,
  },
  filterActive: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  filterInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  filterText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterTextInactive: {
    color: '#4B5563',
  },
  listContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 300,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  loadingText: {
    color: '#6B7280',
    marginTop: 16,
  },
  emptyText: {
    color: '#9CA3AF',
    marginTop: 16,
    textAlign: 'center',
  },
  applicationItem: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  guardianName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  emailText: {
    color: '#6B7280',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusTextBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  childCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 16,
  },
  childHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  childName: {
    fontWeight: 'bold',
    color: '#374151',
    fontSize: 14,
  },
  ratingsContainer: {
    gap: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingText: {
    color: '#6B7280',
    fontSize: 14,
  },
  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#22C55E',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  approveText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rejectText: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  statusFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  statusFooterText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
});
