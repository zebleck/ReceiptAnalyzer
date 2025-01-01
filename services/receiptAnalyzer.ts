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
    location?: string;
  };
  date: string;
  items: Array<{
    name: string;
    price: number;
    quantity?: number;
  }>;
  total: number;
  taxAmount?: number;
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
        },
        location: {
          type: SchemaType.STRING,
          description: "Location of the store",
          nullable: true,  // This makes it optional
        },
      },
      required: ["name"],
    },
    date: {
      type: SchemaType.STRING,
      description: "Date of the receipt",
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
            description: "Price of the item",
            nullable: false,
          },
          quantity: {
            type: SchemaType.NUMBER,
            description: "Quantity of the item",
            nullable: true,  // This makes it optional
          },
        },
        required: ["name", "price"],
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
      nullable: true,  // This makes it optional
    },
  },
  required: ["store", "date", "items", "total"],
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
    - Store name and optional location
    - Date
    - List of items with their prices and optional quantities
    - Total amount
    - Optional tax amount
    
    Ensure the response is valid JSON matching this exact structure and types:
    {
      "store": {
        "name": string,
        "location": string (optional)
      },
      "date": string,
      "items": [
        {
          "name": string,
          "price": number,
          "quantity": number (optional)
        }
      ],
      "total": number,
      "taxAmount": number (optional)
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