'use client';

import { speraxOS, useOnStandalonePluginInit, usePluginState } from '@sperax/plugin-sdk/client';
import { Button, Card, InputNumber, Space, Typography } from 'antd';
import { useCallback, useState } from 'react';

const { Title, Text } = Typography;

interface PluginPayload {
  initialValue?: number;
}

export default function StandalonePlugin() {
  const [initialized, setInitialized] = useState(false);
  const [count, setCount] = usePluginState('count', 0);
  const [step, setStep] = useState(1);

  // Listen for plugin initialization
  useOnStandalonePluginInit<PluginPayload>((payload) => {
    console.log('Plugin initialized with payload:', payload);
    if (payload.arguments?.initialValue) {
      setCount(payload.arguments.initialValue);
    }
    setInitialized(true);
  });

  const increment = useCallback(() => {
    setCount(count + step);
  }, [count, step, setCount]);

  const decrement = useCallback(() => {
    setCount(count - step);
  }, [count, step, setCount]);

  const reset = useCallback(() => {
    setCount(0);
  }, [setCount]);

  const sendToAI = useCallback(async () => {
    // Update the plugin message with current state
    await speraxOS.setPluginMessage({
      action: 'counter_update',
      value: count,
      message: `The counter is now at ${count}`,
    });

    // Trigger AI to respond to the update
    await speraxOS.triggerAIMessage();
  }, [count]);

  const askAIToAnalyze = useCallback(async () => {
    // Create an assistant message directly
    await speraxOS.createAssistantMessage(
      `Based on the counter plugin, the current value is **${count}**. ` +
      `${count > 0 ? 'The value is positive.' : count < 0 ? 'The value is negative.' : 'The value is zero.'}`
    );
  }, [count]);

  if (!initialized) {
    return (
      <Card style={{ textAlign: 'center', padding: 40 }}>
        <Text>Initializing plugin...</Text>
      </Card>
    );
  }

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={3} style={{ textAlign: 'center', margin: 0 }}>
          🎮 Interactive Counter
        </Title>

        <div style={{ textAlign: 'center' }}>
          <Text style={{ fontSize: 48, fontWeight: 'bold' }}>{count}</Text>
        </div>

        <Space style={{ justifyContent: 'center', width: '100%' }}>
          <Button onClick={decrement} size="large">
            - {step}
          </Button>
          <Button onClick={reset}>Reset</Button>
          <Button onClick={increment} size="large" type="primary">
            + {step}
          </Button>
        </Space>

        <div style={{ textAlign: 'center' }}>
          <Text>Step size: </Text>
          <InputNumber
            min={1}
            max={100}
            value={step}
            onChange={(value) => setStep(value || 1)}
          />
        </div>

        <Space style={{ justifyContent: 'center', width: '100%' }}>
          <Button onClick={sendToAI}>
            Send to AI
          </Button>
          <Button onClick={askAIToAnalyze} type="dashed">
            Ask AI to Analyze
          </Button>
        </Space>

        <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
          This is a standalone plugin - it controls when and how the AI responds.
        </Text>
      </Space>
    </Card>
  );
}
