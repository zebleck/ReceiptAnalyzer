import { supabase } from '@/lib/supabase';
import { Receipt, ReceiptItem } from '@/types/supabase';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

function convertDateFormat(dateStr: string): string {
  try {
    // Handle European format (DD.MM.YY or DD.MM.YYYY)
    const [day, month, year] = dateStr.split('.');
    
    // Convert 2-digit year to 4-digit year
    let fullYear = year.length === 2 ? '20' + year : year;
    
    // Pad month and day with leading zeros if needed
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    
    return `${fullYear}-${paddedMonth}-${paddedDay}`;
  } catch (error) {
    console.error('Error converting date:', error);
    return dateStr; // Return original if conversion fails
  }
}

export const receiptService = {
  async saveReceipt(receipt: Omit<Receipt, 'id' | 'created_at' | 'updated_at'>, items: Omit<ReceiptItem, 'id' | 'receipt_id' | 'created_at'>[], imageUri: string | null | undefined) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      console.log('Starting saveReceipt with:', { receipt, items, imageUri });
      
      // Upload image if exists
      let image_url;
      if (imageUri) {
        const fileName = `${Date.now()}.jpg`;
        console.log('Uploading image:', fileName);
        
        if (Platform.OS === 'web') {
          // Web: Use Blob
          const response = await fetch(imageUri);
          const blob = await response.blob();
          
          const { data: imageData, error: imageError } = await supabase.storage
            .from('receipts')
            .upload(fileName, blob, {
              contentType: 'image/jpeg',
            });

          if (imageError) throw imageError;
        } else {
          // Mobile: Use FormData and fetch
          const formData = new FormData();
          formData.append('file', {
            uri: imageUri,
            name: fileName,
            type: 'image/jpeg',
          } as any);

          const { data: imageData, error: imageError } = await supabase.storage
            .from('receipts')
            .upload(fileName, formData, {
              contentType: 'multipart/form-data',
            });

          if (imageError) throw imageError;
        }

        // Get public URL for the uploaded image
        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);
          
        image_url = publicUrl;
        console.log('Image URL:', image_url);
      }

      // Convert date format before saving
      const formattedDate = convertDateFormat(receipt.date);

      // Save receipt with formatted date
      console.log('Saving receipt with data:', { ...receipt, image_url });
      const { data: receiptData, error: receiptError } = await supabase
        .from('receipts')
        .insert({
          ...receipt,
          date: formattedDate, // Use the formatted date
          user_id: user.id,
          image_url,
        })
        .select()
        .single();

      console.log('Receipt save result:', { receiptData, receiptError });

      if (receiptError) throw receiptError;

      // Save items
      if (items.length > 0) {
        console.log('Saving items:', items);
        const { data: itemsData, error: itemsError } = await supabase
          .from('receipt_items')
          .insert(
            items.map(item => ({
              ...item,
              receipt_id: receiptData.id,
            }))
          );

        console.log('Items save result:', { itemsData, itemsError });

        if (itemsError) throw itemsError;
      }

      return receiptData;
    } catch (error) {
      console.error('Error in saveReceipt:', error);
      throw error;
    }
  },

  async getReceipts() {
    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        items:receipt_items(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async deleteReceipt(id: string) {
    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
}; 