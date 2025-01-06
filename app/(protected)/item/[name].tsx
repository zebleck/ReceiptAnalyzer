import { StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Receipt, ReceiptItem } from '@/types/supabase';
import { List, ActivityIndicator, IconButton } from 'react-native-paper';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';

export default function ItemHistoryScreen() {
  const { name } = useLocalSearchParams();
  const router = useRouter();
  const [itemHistory, setItemHistory] = useState<Array<{receipt: Receipt, item: ReceiptItem}>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItemHistory();
  }, [name]);

  const fetchItemHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('receipt_items')
        .select(`
          *,
          receipt:receipts(*)
        `)
        .eq('name', name)
        .order('created_at', { ascending: true });

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

  const chartData = {
    labels: itemHistory.map(({ receipt }) => 
      format(new Date(receipt.timestamp), 'MMM dd')
    ),
    datasets: [{
      data: itemHistory.map(({ item }) => item.price || 0),
      color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
      strokeWidth: 2
    }]
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => router.back()}
        />
        <Text style={styles.title}>Price History: {decodeURIComponent(String(name))}</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {itemHistory.length > 1 && (
          <View style={styles.chartContainer}>
            <LineChart
              data={chartData}
              width={Dimensions.get('window').width - 40}
              height={220}
              chartConfig={{
                backgroundColor: '#1e1e1e',
                backgroundGradientFrom: '#2d2d2d',
                backgroundGradientTo: '#3d3d3d',
                decimalPlaces: 2,
                color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                style: {
                  borderRadius: 16
                },
                propsForDots: {
                  r: '6',
                  strokeWidth: '2',
                  stroke: '#8441f4'
                },
                formatYLabel: (value) => `€${parseFloat(value).toFixed(2)}`
              }}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16
              }}
            />
          </View>
        )}

        <Text style={styles.subtitle}>Price History</Text>
        {itemHistory.slice().reverse().map(({ receipt, item }) => (
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
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  chartContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
}); 