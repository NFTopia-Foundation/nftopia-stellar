import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PasswordStrengthIndicatorProps {
  password: string;
}

type PasswordStrength = 'weak' | 'medium' | 'strong';

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const getStrength = (pwd: string): PasswordStrength => {
    if (pwd.length === 0) return 'weak';
    
    let score = 0;
    
    // Length checks
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    
    // Character type checks
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
  };

  const strength = getStrength(password);
  
  const getStrengthConfig = () => {
    switch (strength) {
      case 'weak':
        return {
          label: 'Weak',
          color: '#FF3B30',
          percentage: 33,
        };
      case 'medium':
        return {
          label: 'Medium',
          color: '#FF9500',
          percentage: 66,
        };
      case 'strong':
        return {
          label: 'Strong',
          color: '#34C759',
          percentage: 100,
        };
    }
  };

  const config = getStrengthConfig();

  if (password.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.strengthBar}>
        <View 
          style={[
            styles.strengthFill, 
            { 
              width: `${config.percentage}%`, 
              backgroundColor: config.color 
            }
          ]} 
        />
      </View>
      <Text style={[styles.label, { color: config.color }]}>
        Password strength: {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    marginTop: 8,
  },
  strengthBar: {
    height: 4,
    backgroundColor: '#e9ecef',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
});
