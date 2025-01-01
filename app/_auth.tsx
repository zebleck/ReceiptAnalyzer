import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function AuthLayout() {
  const { user, loading } = useAuth();

  // Show loading indicator while checking auth state
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // If no user, redirect to login
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // If user is authenticated, show protected routes
  return <Stack />;
} 