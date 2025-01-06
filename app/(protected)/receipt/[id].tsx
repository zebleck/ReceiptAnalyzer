import { StyleSheet, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Receipt, ReceiptItem } from '@/types/supabase';
import { List, ActivityIndicator, IconButton } from 'react-native-paper';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReceipt();
  }, [id]);

  const fetchReceipt = async () => {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select(`
          *,
          items:receipt_items(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setReceipt(data);
    } catch (error) {
      console.error('Error fetching receipt:', error);
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
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => router.back()}
        />
        <Text style={styles.title}>{receipt?.store_name}</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <Text style={styles.subtitle}>
          {receipt && format(new Date(receipt.timestamp), 'dd.MM.yyyy HH:mm')}
        </Text>
        {receipt?.items?.map((item) => (
          <List.Item
            key={item.id}
            title={item.name}
            description={`€${item.price?.toFixed(2) || '0.00'} ${
              item.quantity ? `× ${item.quantity}` : ''
            }`}
            onPress={() => router.push(`/item/${encodeURIComponent(item.name)}`)}
          />
        ))}
        <Text style={styles.total}>
          Total: €{receipt?.total.toFixed(2)}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 15,
    opacity: 0.6,
  },
  total: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    textAlign: 'right',
  },
}); 