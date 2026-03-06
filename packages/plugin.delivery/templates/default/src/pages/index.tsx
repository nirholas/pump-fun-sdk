'use client';

import { fetchPluginMessage } from '@sperax/plugin-sdk';
import { Card, List, Tag, Typography } from 'antd';
import { memo, useEffect, useState } from 'react';

const { Title, Text } = Typography;

interface ClothingItem {
  name: string;
  type: string;
  color: string;
  style: string;
}

interface ResponseData {
  clothes: ClothingItem[];
  mood: string;
  gender: string;
  today: number;
}

const moodEmojis: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  angry: '😠',
  fearful: '😨',
  surprised: '😲',
  disgusted: '🤢',
};

const typeIcons: Record<string, string> = {
  top: '👕',
  bottom: '👖',
  dress: '👗',
  shoes: '👟',
  accessory: '🎀',
};

const Render = memo(() => {
  const [data, setData] = useState<ResponseData>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the plugin message data from SperaxOS
    fetchPluginMessage<ResponseData>()
      .then((response) => {
        setData(response);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to fetch plugin message:', error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Card style={{ textAlign: 'center', padding: 20 }}>
        <Text>Loading recommendations...</Text>
      </Card>
    );
  }

  if (!data || !data.clothes.length) {
    return (
      <Card style={{ textAlign: 'center', padding: 20 }}>
        <Text type="secondary">No recommendations available</Text>
      </Card>
    );
  }

  const emoji = moodEmojis[data.mood] || '🤔';

  return (
    <Card 
      title={
        <span>
          {emoji} Outfit for your {data.mood} mood
        </span>
      }
      style={{ maxWidth: 400 }}
    >
      <List
        dataSource={data.clothes}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              avatar={<span style={{ fontSize: 24 }}>{typeIcons[item.type] || '👚'}</span>}
              title={item.name}
              description={
                <div>
                  <Tag color="blue">{item.type}</Tag>
                  <Tag color="green">{item.style}</Tag>
                  <Tag>{item.color}</Tag>
                </div>
              }
            />
          </List.Item>
        )}
      />
      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Generated: {new Date(data.today).toLocaleString()}
        </Text>
      </div>
    </Card>
  );
});

Render.displayName = 'ClothesRecommendation';

export default Render;
