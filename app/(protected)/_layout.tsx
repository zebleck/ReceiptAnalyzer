import { Stack } from 'expo-router';
import { useAuth } from '@/lib/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';

export default function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
} 