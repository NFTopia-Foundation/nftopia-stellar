import { View, Text, TextInput, TextInputProps } from 'react-native';
import { ValidationError } from './ValidationError';

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
}

export function FormInput({ label, error, ...props }: FormInputProps) {
  return (
    <View className="mb-4">
      <Text className="text-gray-700 font-medium mb-1">{label}</Text>
      <TextInput
        className={`bg-gray-50 border ${
          error ? 'border-red-500' : 'border-gray-300'
        } rounded-lg px-4 py-6 text-gray-900`}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      <ValidationError error={error} />
    </View>
  );
}
