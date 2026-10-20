import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert, TextInput } from 'react-native';
import EmailRegisterScreen from '@/screens/Auth/EmailRegisterScreen';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/auth/auth.service';

jest.mock('@/services/auth/auth.service', () => ({
  authService: {
    emailRegister: jest.fn(),
  },
}));

jest.mock('@/stores/authStore', () => {
  const setUser = jest.fn();
  const setError = jest.fn();
  return {
    useAuthStore: () => ({ setUser, setError }),
  };
});

jest.mock('@/src/components/KeyboardAwareScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    KeyboardAwareScreen: ({ children, footer }: any) => (
      <View>
        {children}
        {footer}
      </View>
    ),
  };
});

// FormInput, PasswordStrengthIndicator, and the validation utils are NOT
// mocked: this suite renders the real components so the client-side
// validation path is exercised for real under jest.config.components.json.

const mockedAuthService = authService as jest.Mocked<typeof authService>;
const { setUser, setError } = useAuthStore();

function render(ui: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui as never);
  });
  return renderer;
}

function fillForm(
  renderer: TestRenderer.ReactTestRenderer,
  values: { username: string; email: string; password: string; confirmPassword: string },
) {
  // Host TextInput nodes only - component wrappers (FormInput/TextField)
  // carry the same testID prop, so type + testID pins down the input itself.
  const input = (testID: string) =>
    renderer.root.find(
      (node) => node.type === TextInput && node.props.testID === testID,
    );
  act(() => {
    input('username-input').props.onChangeText(values.username);
    input('email-input').props.onChangeText(values.email);
    input('password-input').props.onChangeText(values.password);
    input('confirm-password-input').props.onChangeText(values.confirmPassword);
  });
}

function pressRegister(renderer: TestRenderer.ReactTestRenderer) {
  const button = renderer.root.findByProps({ testID: 'register-button' });
  return act(async () => {
    await button.props.onPress();
  });
}

const validForm = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Password123!',
  confirmPassword: 'Password123!',
};

const backendUser = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  user: {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
  },
};

describe('EmailRegisterScreen (#672 - registration backend call)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an account through the backend and signs the user in on success', async () => {
    mockedAuthService.emailRegister.mockResolvedValue(backendUser as any);

    const navigation: any = { navigate: jest.fn(), goBack: jest.fn() };
    const renderer = render(<EmailRegisterScreen navigation={navigation} route={{} as any} />);
    fillForm(renderer, validForm);
    await pressRegister(renderer);

    expect(mockedAuthService.emailRegister).toHaveBeenCalledWith(
      'test@example.com',
      'Password123!',
      'testuser',
    );
    // setUser flips isAuthenticated, which is what swaps AppNavigator from
    // AuthNavigator to MainNavigator (the authenticated app).
    expect(setUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
      }),
    );
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Account created successfully!');
    expect(setError).toHaveBeenCalledWith(null);
  });

  it('blocks submission and shows field errors when client-side validation fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const navigation: any = { navigate: jest.fn(), goBack: jest.fn() };
    const renderer = render(<EmailRegisterScreen navigation={navigation} route={{} as any} />);
    await pressRegister(renderer);

    expect(mockedAuthService.emailRegister).not.toHaveBeenCalled();
    expect(setUser).not.toHaveBeenCalled();
    expect(renderer.root.findAllByProps({ testID: 'email-input-error' }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ testID: 'password-input-error' }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ testID: 'username-input-error' }).length).toBeGreaterThan(0);
    expect(
      renderer.root.findAllByProps({ testID: 'confirm-password-input-error' }).length,
    ).toBeGreaterThan(0);
    expect(Alert.alert).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('shows the backend validation error distinctly when the email is already in use', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Shape authService.emailRegister actually rejects with for a 409
    // (see handleError in src/services/auth/auth.service.ts).
    mockedAuthService.emailRegister.mockRejectedValue({
      message: 'Email is already registered',
      statusCode: 409,
    });

    const navigation: any = { navigate: jest.fn(), goBack: jest.fn() };
    const renderer = render(<EmailRegisterScreen navigation={navigation} route={{} as any} />);
    fillForm(renderer, { ...validForm, email: 'existing@example.com' });
    await pressRegister(renderer);

    expect(Alert.alert).toHaveBeenCalledWith('Validation Error', 'Email is already registered');
    expect(setError).toHaveBeenCalledWith('Email is already registered');
    expect(setUser).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Registration error:',
      expect.objectContaining({ statusCode: 409 }),
    );

    consoleErrorSpy.mockRestore();
  });

  it('shows a distinct network failure alert when the server is unreachable', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // No statusCode: axios connection failures carry no response object.
    mockedAuthService.emailRegister.mockRejectedValue({ message: 'Network Error' });

    const navigation: any = { navigate: jest.fn(), goBack: jest.fn() };
    const renderer = render(<EmailRegisterScreen navigation={navigation} route={{} as any} />);
    fillForm(renderer, validForm);
    await pressRegister(renderer);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Network Error',
      'Unable to reach the server. Check your connection and try again.',
    );
    expect(setError).toHaveBeenCalledWith('Network Error');
    expect(setUser).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
