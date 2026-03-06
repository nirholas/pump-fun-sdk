import { PluginErrorType, createErrorResponse } from '@sperax/plugin-sdk';

export const config = {
  runtime: 'edge',
};

// Types
interface ClothesRequest {
  mood: 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised' | 'disgusted';
  gender: 'man' | 'woman';
}

interface ClothingItem {
  name: string;
  type: string;
  color: string;
  style: string;
}

interface ClothesResponse {
  clothes: ClothingItem[];
  mood: string;
  gender: string;
  today: number;
}

// Mock data - replace with real data source in production
const manClothes: Record<string, ClothingItem[]> = {
  happy: [
    { name: 'Bright Yellow T-Shirt', type: 'top', color: 'yellow', style: 'casual' },
    { name: 'Light Blue Jeans', type: 'bottom', color: 'blue', style: 'casual' },
    { name: 'White Sneakers', type: 'shoes', color: 'white', style: 'sporty' },
  ],
  sad: [
    { name: 'Cozy Gray Hoodie', type: 'top', color: 'gray', style: 'comfort' },
    { name: 'Soft Sweatpants', type: 'bottom', color: 'black', style: 'comfort' },
    { name: 'Slippers', type: 'shoes', color: 'brown', style: 'comfort' },
  ],
  angry: [
    { name: 'Black Leather Jacket', type: 'top', color: 'black', style: 'edgy' },
    { name: 'Dark Jeans', type: 'bottom', color: 'black', style: 'casual' },
    { name: 'Combat Boots', type: 'shoes', color: 'black', style: 'edgy' },
  ],
  fearful: [
    { name: 'Warm Sweater', type: 'top', color: 'navy', style: 'comfort' },
    { name: 'Comfortable Chinos', type: 'bottom', color: 'khaki', style: 'casual' },
    { name: 'Loafers', type: 'shoes', color: 'brown', style: 'classic' },
  ],
  surprised: [
    { name: 'Fun Printed Shirt', type: 'top', color: 'multi', style: 'trendy' },
    { name: 'Cargo Pants', type: 'bottom', color: 'olive', style: 'casual' },
    { name: 'High-top Sneakers', type: 'shoes', color: 'white', style: 'trendy' },
  ],
  disgusted: [
    { name: 'Clean White Shirt', type: 'top', color: 'white', style: 'minimal' },
    { name: 'Tailored Trousers', type: 'bottom', color: 'charcoal', style: 'formal' },
    { name: 'Oxford Shoes', type: 'shoes', color: 'black', style: 'formal' },
  ],
};

const womanClothes: Record<string, ClothingItem[]> = {
  happy: [
    { name: 'Floral Summer Dress', type: 'dress', color: 'multi', style: 'cheerful' },
    { name: 'White Sandals', type: 'shoes', color: 'white', style: 'casual' },
    { name: 'Sun Hat', type: 'accessory', color: 'straw', style: 'summer' },
  ],
  sad: [
    { name: 'Oversized Cardigan', type: 'top', color: 'cream', style: 'comfort' },
    { name: 'Soft Leggings', type: 'bottom', color: 'gray', style: 'comfort' },
    { name: 'Fuzzy Slippers', type: 'shoes', color: 'pink', style: 'comfort' },
  ],
  angry: [
    { name: 'Power Blazer', type: 'top', color: 'red', style: 'bold' },
    { name: 'Black Skinny Pants', type: 'bottom', color: 'black', style: 'chic' },
    { name: 'Stiletto Heels', type: 'shoes', color: 'black', style: 'fierce' },
  ],
  fearful: [
    { name: 'Cozy Turtleneck', type: 'top', color: 'burgundy', style: 'warm' },
    { name: 'A-Line Skirt', type: 'bottom', color: 'navy', style: 'classic' },
    { name: 'Ankle Boots', type: 'shoes', color: 'brown', style: 'classic' },
  ],
  surprised: [
    { name: 'Sequin Top', type: 'top', color: 'silver', style: 'glamour' },
    { name: 'Wide-Leg Pants', type: 'bottom', color: 'black', style: 'trendy' },
    { name: 'Platform Sneakers', type: 'shoes', color: 'white', style: 'trendy' },
  ],
  disgusted: [
    { name: 'Crisp Button-Down', type: 'top', color: 'white', style: 'polished' },
    { name: 'Pencil Skirt', type: 'bottom', color: 'navy', style: 'professional' },
    { name: 'Classic Pumps', type: 'shoes', color: 'nude', style: 'elegant' },
  ],
};

export default async function handler(req: Request) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return createErrorResponse(PluginErrorType.MethodNotAllowed);
  }

  try {
    const { gender, mood } = (await req.json()) as ClothesRequest;

    // Validate required parameters
    if (!gender || !mood) {
      return createErrorResponse(PluginErrorType.PluginApiParamsError, {
        message: 'Missing required parameters: gender and mood',
      });
    }

    // Get clothes based on gender
    const clothes = gender === 'man' ? manClothes : womanClothes;

    // Build response
    const result: ClothesResponse = {
      clothes: clothes[mood] || [],
      mood,
      gender,
      today: Date.now(),
    };

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createErrorResponse(PluginErrorType.PluginServerError, {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
