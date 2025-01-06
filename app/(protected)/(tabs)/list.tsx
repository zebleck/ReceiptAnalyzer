import { StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Receipt } from '@/types/supabase';
import { Card, ActivityIndicator } from 'react-native-paper';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';

export default function TabOneScreen() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select(`
          *,
          items:receipt_items(*)
        `)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {receipts.map((receipt) => (
          <TouchableOpacity
            key={receipt.id}
            onPress={() => router.push(`/receipt/${receipt.id}`)}
          >
            <Card style={styles.card}>
              <Card.Title
                title={receipt.store_name}
                subtitle={format(new Date(receipt.timestamp), 'dd.MM.yyyy HH:mm')}
              />
              <Card.Content>
                <Text>Total: €{receipt.total.toFixed(2)}</Text>
                <Text>Items: {receipt.items?.length || 0}</Text>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 10,
  },
  card: {
    marginBottom: 10,
  },
});
