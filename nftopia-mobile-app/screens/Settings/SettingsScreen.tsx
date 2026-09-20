import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { usePreferencesStore, ThemeMode } from '@/stores/preferencesStore';
import { SUPPORTED_CURRENCIES } from '@/src/services/stellar/priceService';
import { colors, spacing, borderRadius } from '@/constants/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/MainNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'Settings'>;
const languages = ['en', 'fr', 'es'];

export default function SettingsScreen({ navigation }: Props) {
  const preferences = usePreferencesStore();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const choice = (label: string, value: string, selected: boolean, onPress: () => void) => (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">Settings</Text>

      <Section title="Appearance">
        <Text style={styles.label}>Theme</Text>
        <View style={styles.choices} accessibilityRole="radiogroup">
          {(['system', 'light', 'dark'] as ThemeMode[]).map((theme) => choice(theme[0].toUpperCase() + theme.slice(1), theme, preferences.theme === theme, () => preferences.setTheme(theme)))}
        </View>
      </Section>

      <Section title="Language">
        <View style={styles.choices} accessibilityRole="radiogroup">
          {languages.map((language) => choice(language.toUpperCase(), language, preferences.language === language, () => preferences.setLanguage(language)))}
        </View>
      </Section>

      <Section title="Currency">
        <View style={styles.choices} accessibilityRole="radiogroup">
          {SUPPORTED_CURRENCIES.map((currency) => choice(currency, currency, preferences.currency === currency, () => preferences.setCurrency(currency)))}
        </View>
      </Section>

      <Section title="Notifications">
        <Toggle label="Push notifications" value={preferences.notificationsEnabled} onChange={preferences.setNotificationsEnabled} />
        <Toggle label="Sound" value={preferences.soundEnabled} onChange={preferences.setSoundEnabled} />
        <Toggle label="Vibration" value={preferences.vibrationEnabled} onChange={preferences.setVibrationEnabled} />
        <Pressable accessibilityRole="button" style={styles.link} onPress={() => navigation.navigate('NotificationSettings')}><Text style={styles.linkText}>Manage notification categories & quiet hours →</Text></Pressable>
      </Section>

      <Section title="Security">
        <Toggle label="Automatic app lock" value={preferences.autoLock} onChange={preferences.setAutoLock} />
        <Pressable accessibilityRole="button" style={styles.link} onPress={() => navigation.navigate('WalletManagement')}><Text style={styles.linkText}>Manage and export wallets →</Text></Pressable>
      </Section>

      <Section title="About">
        <Text style={styles.value}>Version {version}</Text>
        <Pressable accessibilityRole="link" style={styles.link} onPress={() => Linking.openURL('mailto:support@nftopia.io')}><Text style={styles.linkText}>Contact support →</Text></Pressable>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>{children}</View>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Switch accessibilityLabel={label} value={value} onValueChange={onChange} /></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', marginBottom: spacing.lg },
  section: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.sm },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 48 },
  label: { color: colors.text, fontSize: 16 },
  value: { color: colors.textSecondary, fontSize: 15, marginBottom: spacing.sm },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { borderColor: colors.border, borderRadius: borderRadius.sm, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  choiceSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { color: colors.textSecondary, fontSize: 14 },
  choiceTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
});
