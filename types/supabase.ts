export interface Receipt {
  id: string;
  user_id: string;
  store_name: string;
  date: string;
  total: number;
  image_url?: string;
  created_at: string;
  updated_at: string;
  items?: ReceiptItem[];
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  name: string;
  price: number;
  quantity: number;
  created_at: string;
} 