import { Text } from 'react-native';

interface ValidationErrorProps {
  error?: string;
}

export function ValidationError({ error }: ValidationErrorProps) {
  if (!error) return null;
  return <Text className="text-red-500 text-sm mt-1">{error}</Text>;
}
