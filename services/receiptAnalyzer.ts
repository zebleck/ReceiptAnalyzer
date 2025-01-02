import { GenerationConfig, GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Load environment variables
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not defined in environment variables');
}

const genAI = new GoogleGenerativeAI(apiKey);

// Define the response schema for receipt analysis
interface ReceiptAnalysis {
  store: {
    name: string;
  };
  receipt_uid?: string;
  address?: {
    street?: string;
    postal_code?: string;
    city?: string;
  };
  date: string;
  time: string;
  items: Array<{
    name: string;
    price?: number;
    quantity?: number;
  }>;
  total: number;
  taxAmount?: number;
  quality_rating: number;
}

const schema = {
  type: SchemaType.OBJECT,
  properties: {
    store: {
      type: SchemaType.OBJECT,
      properties: {
        name: {
          type: SchemaType.STRING,
          description: "Name of the store",
          nullable: false,
        }
      },
      required: ["name"],
    },
    date: {
      type: SchemaType.STRING,
      description: "Date of the receipt",
      nullable: false,
    },
    time: {
      type: SchemaType.STRING,
      description: "Time of the receipt (HH:MM)",
      nullable: false,
    },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: {
            type: SchemaType.STRING,
            description: "Name of the item",
            nullable: false,
          },
          price: {
            type: SchemaType.NUMBER,
            description: "Unit price of the item (if readable, can be negative for discounts/returns)",
            nullable: true,
          },
          quantity: {
            type: SchemaType.NUMBER,
            description: "Quantity of the item (if specified)",
            nullable: true,
          },
        },
        required: ["name"],
      },
    },
    total: {
      type: SchemaType.NUMBER,
      description: "Total amount of the receipt",
      nullable: false,
    },
    taxAmount: {
      type: SchemaType.NUMBER,
      description: "Tax amount on the receipt",
      nullable: true,
    },
    receipt_uid: {
      type: SchemaType.STRING,
      description: "Receipt UID from the receipt (usually starting with country code such as 'DE')",
      nullable: true,
    },
    address: {
      type: SchemaType.OBJECT,
      properties: {
        street: {
          type: SchemaType.STRING,
          description: "Street address",
          nullable: true,
        },
        postal_code: {
          type: SchemaType.STRING,
          description: "Postal/ZIP code",
          nullable: true,
        },
        city: {
          type: SchemaType.STRING,
          description: "City name",
          nullable: true,
        },
      },
      nullable: true,
    },
    quality_rating: {
      type: SchemaType.NUMBER,
      description: "Receipt quality rating from 1-10 based on readability and completeness of information",
      nullable: false,
    },
  },
  required: ["store", "date", "time", "items", "total"],
};

export async function analyzeReceipt(imageBase64: string): Promise<ReceiptAnalysis> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    // Convert base64 to inline data URI
    const imageData = {
      inlineData: {
        data: imageBase64,
        mimeType: "image/jpeg"
      }
    };

    const prompt = `Analyze this receipt and provide the following information in strict JSON format:
    - Store name
    - Receipt UID (if present, usually starting with country code such as 'DE')
    - Store address (street, postal code, and city)
    - Date
    - Time (in HH:MM format)
    - List of items with their prices and optional quantities
    - Total amount
    - Optional tax amount
    - Quality rating (1-10) based on how readable and complete the receipt information is
      (10 = perfectly clear and complete, 1 = barely readable or missing crucial information)
    
    Ensure the response is valid JSON matching this exact structure and types:
    {
      "store": {
        "name": string
      },
      "receipt_uid": string (optional),
      "address": {
        "street": string (optional),
        "postal_code": string (optional, usually below street),
        "city": string (optional, usually below street)
      },
      "date": string,
      "time": string,
      "items": [
        {
          "name": string,
          "price": number (sometimes the unit price is below the name (EUR/STK or EUR/KG)),
          "quantity": number (optional) (sometimes the quantity is below the price (STK or kg))
        }
      ],
      "total": number,
      "taxAmount": number (optional),
      "quality_rating": number (1-10) (don't always choose 9, make it dependent on how readable and complete the receipt information is)
    }`;

    const result = await model.generateContent([prompt, imageData]);
    const response = await result.response;
    const text = response.text();
    
    console.log('Raw API Response:', text);

    try {
      const analysis: ReceiptAnalysis = JSON.parse(text);
      console.log('Parsed Analysis:', analysis);
      return analysis;
    } catch (parseError) {
      console.error('JSON Parse Error. Raw text was:', text);
      throw parseError;
    }

  } catch (error) {
    console.error('Error analyzing receipt:', error);
    throw error;
  }
}