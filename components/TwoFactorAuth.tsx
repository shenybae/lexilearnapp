
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Shield, Lock, ArrowRight, RefreshCw, LogOut } from 'lucide-react-native';

interface TwoFactorProps {
  email: string;
  onVerify: () => void;
  onCancel: () => void;
}

export const TwoFactorAuth: React.FC<TwoFactorProps> = ({ email, onVerify, onCancel }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    // Simulate sending email on mount
    const timeout = setTimeout(() => {
        Alert.alert("Demo Code", `A verification code has been sent to ${email}.\n\nUse code: 123456`);
    }, 500);

    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
        clearTimeout(timeout);
        clearInterval(interval);
    };
  }, [email]);

  const handleSubmit = () => {
    setError('');
    setIsLoading(true);

    // Simulate network delay
    setTimeout(() => {
      if (code === '123456') {
        onVerify();
      } else {
        setError('Invalid verification code. Please try again.');
        setIsLoading(false);
      }
    }, 1000);
  };

  const handleResend = () => {
    setTimer(30);
    Alert.alert("Code Resent", `A new verification code has been sent to ${email}.\n\nUse code: 123456`);
  };

  return (
    <View className="flex-1 items-center justify-center bg-pastel-cream p-4">
      <View className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border-2 border-brand-primary/20">
        <View className="items-center mb-6">
          <View className="w-20 h-20 bg-blue-100 rounded-full items-center justify-center mb-4">
            <Shield size={40} color="#4A90E2" />
          </View>
          <Text className="text-2xl font-bold text-dyslexia-text text-center">Two-Factor Authentication</Text>
          <Text className="text-gray-500 text-center mt-2">
            To secure your account, please enter the 6-digit code sent to <Text className="font-bold text-gray-700">{email}</Text>
          </Text>
        </View>

        <View className="space-y-6">
          <View>
            <Text className="text-sm font-bold text-gray-700 mb-2">Verification Code</Text>
            <View className="relative justify-center">
              <Lock className="absolute left-4 z-10" size={20} color="#9CA3AF" />
              <TextInput 
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 text-center text-2xl font-bold tracking-widest bg-white"
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
            {error ? <Text className="text-red-500 text-sm mt-2 font-bold text-center">{error}</Text> : null}
          </View>

          <TouchableOpacity 
            onPress={handleSubmit}
            disabled={isLoading || code.length < 6}
            className={`w-full py-4 bg-brand-primary rounded-xl shadow-lg flex-row items-center justify-center gap-2 ${isLoading || code.length < 6 ? 'opacity-50' : ''}`}
          >
            <Text className="text-white font-bold text-lg">{isLoading ? 'Verifying...' : 'Verify'}</Text>
            {!isLoading && <ArrowRight size={20} color="#FFF" />}
          </TouchableOpacity>
        </View>

        <View className="mt-6 items-center gap-4">
          <TouchableOpacity 
            onPress={handleResend}
            disabled={timer > 0}
            className="flex-row items-center gap-2"
          >
            <RefreshCw size={16} color={timer > 0 ? '#9CA3AF' : '#4A90E2'} />
            <Text className={`font-bold text-sm ${timer > 0 ? 'text-gray-400' : 'text-brand-primary'}`}>
                 {timer > 0 ? `Resend Code in ${timer}s` : 'Resend Code'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={onCancel}
            className="flex-row items-center gap-2"
          >
            <LogOut size={16} color="#6B7280" />
            <Text className="text-gray-500 font-semibold text-sm">Cancel & Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
