import { StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Receipt, ReceiptItem } from '@/types/supabase';
import { Card, List, Portal, Modal, ActivityIndicator } from 'react-native-paper';
import { format } from 'date-fns';

export default function TabOneScreen() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [itemHistory, setItemHistory] = useState<Array<{receipt: Receipt, item: ReceiptItem}>>([]);

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

  const fetchItemHistory = async (itemName: string) => {
    try {
      const { data, error } = await supabase
        .from('receipt_items')
        .select(`
          *,
          receipt:receipts(*)
        `)
        .eq('name', itemName)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItemHistory(data?.map(item => ({
        receipt: item.receipt,
        item: {
          id: item.id,
          receipt_id: item.receipt_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          created_at: item.created_at
        }
      })) || []);
    } catch (error) {
      console.error('Error fetching item history:', error);
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
            onPress={() => setSelectedReceipt(receipt)}
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

      {/* Receipt Details Modal */}
      <Portal>
        <Modal
          visible={selectedReceipt !== null}
          onDismiss={() => setSelectedReceipt(null)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>{selectedReceipt?.store_name}</Text>
            <Text style={styles.modalSubtitle}>
              {selectedReceipt && format(new Date(selectedReceipt.timestamp), 'dd.MM.yyyy HH:mm')}
            </Text>
            {selectedReceipt?.items?.map((item) => (
              <List.Item
                key={item.id}
                title={item.name}
                description={`€${item.price?.toFixed(2) || '0.00'} ${
                  item.quantity ? `× ${item.quantity}` : ''
                }`}
                onPress={() => {
                  setSelectedItem(item.name);
                  fetchItemHistory(item.name);
                }}
              />
            ))}
            <Text style={styles.total}>
              Total: €{selectedReceipt?.total.toFixed(2)}
            </Text>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Item History Modal */}
      <Portal>
        <Modal
          visible={selectedItem !== null}
          onDismiss={() => setSelectedItem(null)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Price History: {selectedItem}</Text>
            {itemHistory.map(({ receipt, item }) => (
              <List.Item
                key={`${receipt.id}-${item.id}`}
                title={`€${item.price?.toFixed(2) || '0.00'}`}
                description={`${receipt.store_name} - ${format(
                  new Date(receipt.timestamp),
                  'dd.MM.yyyy'
                )}`}
              />
            ))}
          </ScrollView>
        </Modal>
      </Portal>
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
  modal: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 10,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 16,
    marginBottom: 15,
    color: '#666',
  },
  total: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    textAlign: 'right',
  },
});
