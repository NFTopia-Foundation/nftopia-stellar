import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { FormInput } from "../../components/FormInput";
import { AuthService } from '../../lib/api/AuthService';
import { useAuthStore } from '../../lib/zustand/useAuthStore';

export default function EmailRegisterScreen({ navigation }: any) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [passwordStrength, setPasswordStrength] = useState<
    "Weak" | "Medium" | "Strong" | ""
  >("");

  useEffect(() => {
    // Real-time validation for password strength
    if (!password) {
      setPasswordStrength("");
      return;
    }
    const hasLength = password.length >= 8;
    const hasNum = /[0-9]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    let strengthCount = 0;
    if (hasLength) strengthCount++;
    if (hasNum) strengthCount++;
    if (hasUpper) strengthCount++;
    if (hasSpecial) strengthCount++;

    if (strengthCount < 2) setPasswordStrength("Weak");
    else if (strengthCount < 4) setPasswordStrength("Medium");
    else setPasswordStrength("Strong");

    if (password && confirmPassword && password !== confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: "Passwords do not match",
      }));
    } else {
      setErrors((prev) => ({ ...prev, confirmPassword: "" }));
    }
  }, [password, confirmPassword]);

  const validate = () => {
    const newErrors: any = {};

    if (!/^[a-zA-Z0-9]{3,20}$/.test(username)) {
      newErrors.username = "Username must be 3-20 alphanumeric characters";
    }
    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 255
    ) {
      newErrors.email = "Please enter a valid email address";
    }

    const hasLength = password.length >= 8;
    const hasNum = /[0-9]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasLength || !hasNum || !hasUpper || !hasSpecial) {
      newErrors.password =
        "Password must be at least 8 characters with 1 number, 1 uppercase, and 1 special character";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).every((key) => !newErrors[key]);
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrors({});
    try {
      const response = await AuthService.register({ username, email, password });
      useAuthStore.getState().setAuth(response.accessToken, response.user);
      Alert.alert("Success", "Account created successfully!");
      navigation?.navigate('MainApp');
    } catch (error: any) {
      setErrors({ api: error.message || "Registration failed" });
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    switch (passwordStrength) {
      case "Weak":
        return "text-red-500";
      case "Medium":
        return "text-yellow-500";
      case "Strong":
        return "text-green-500";
      default:
        return "text-gray-400";
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{
        flexGrow: 1,
        padding: 24,
        paddingBottom: 40,
        justifyContent: "center",
      }}
    >
      <Text className="text-3xl font-bold text-gray-900 mb-2 mt-8">
        Create Account
      </Text>
      <Text className="text-gray-500 text-2xl mb-8">
        Join NFTopia and start collecting
      </Text>

      {errors.api ? (
        <View className="bg-red-50 p-3 rounded-lg mb-4">
          <Text className="text-red-600 text-sm text-center">{errors.api}</Text>
        </View>
      ) : null}

      <FormInput
        label="Username"
        placeholder="Choose a username"
        autoCapitalize="none"
        value={username}
        onChangeText={(text) => {
          setUsername(text);
          setErrors((prev) => ({ ...prev, username: "" }));
        }}
        error={errors.username}
      />

      <FormInput
        label="Email Address"
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setErrors((prev) => ({ ...prev, email: "" }));
        }}
        error={errors.email}
      />

      <View className="mb-2">
        <FormInput
          label="Password"
          placeholder="Create a password"
          secureTextEntry
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setErrors((prev) => ({ ...prev, password: "" }));
          }}
          error={errors.password}
        />
        {password ? (
          <Text
            className={`text-xs ml-1 -mt-3 mb-2 font-medium ${getStrengthColor()}`}
          >
            Password Strength: {passwordStrength}
          </Text>
        ) : null}
      </View>

      <FormInput
        label="Confirm Password"
        placeholder="Confirm your password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={(text) => {
          setConfirmPassword(text);
        }}
        error={errors.confirmPassword}
      />

      <TouchableOpacity
        className={`bg-blue-600 rounded-lg py-4 items-center justify-center mt-4 mb-6 flex-row ${loading ? "opacity-70" : ""}`}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" className="mr-2" />
        ) : null}
        <Text className="text-white font-bold text-lg">Create Account</Text>
      </TouchableOpacity>

      <View className="flex-row justify-center mt-2">
        <Text className="text-gray-500">Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation?.navigate("EmailLogin")}>
          <Text className="text-blue-600 font-bold">Sign In</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
