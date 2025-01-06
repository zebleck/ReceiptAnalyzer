import { StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Text, View } from '@/components/Themed';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Receipt } from '@/types/supabase';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { ActivityIndicator } from 'react-native-paper';

export default function TabTwoScreen() {
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<{
    labels: string[];
    amounts: number[];
  }>({ labels: [], amounts: [] });

  useEffect(() => {
    fetchMonthlySpending();
  }, []);

  const fetchMonthlySpending = async () => {
    try {
      // Get receipts for the last 6 months
      const endDate = new Date();
      const startDate = subMonths(endDate, 12); // 6 months including current month

      const { data: receipts, error } = await supabase
        .from('receipts')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      // Generate array of all months in the range
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      
      // Calculate total for each month
      const monthlyTotals = months.map(month => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        
        const monthReceipts = receipts?.filter(receipt => {
          const receiptDate = parseISO(receipt.timestamp);
          return receiptDate >= monthStart && receiptDate <= monthEnd;
        }) || [];

        const total = monthReceipts.reduce((sum, receipt) => sum + receipt.total, 0);
        
        return {
          label: format(month, 'MMM'),
          amount: total
        };
      });

      setMonthlyData({
        labels: monthlyTotals.map(m => m.label),
        amounts: monthlyTotals.map(m => m.amount)
      });
    } catch (error) {
      console.error('Error fetching monthly spending:', error);
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
    labels: monthlyData.labels,
    datasets: [{
      data: monthlyData.amounts,
      color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
      strokeWidth: 2
    }]
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Monthly Spending</Text>
      
      <View style={styles.chartContainer}>
        <LineChart
          data={chartData}
          width={Dimensions.get('window').width - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#1e1e1e',
            backgroundGradientFrom: '#2d2d2d',
            backgroundGradientTo: '#3d3d3d',
            decimalPlaces: 0,
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
            formatYLabel: (value) => `€${parseInt(value)}`
          }}
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 16
          }}
        />
      </View>
      
      <Text style={styles.subtitle}>Last 6 Months</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  chartContainer: {
    marginVertical: 20,
  },
});
