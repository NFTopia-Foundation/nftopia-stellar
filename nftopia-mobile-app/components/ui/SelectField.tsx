import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, borderRadius, fieldColors } from '@/constants/theme';
import ValidationError from './ValidationError';
import BottomSheet from './BottomSheet';

export interface SelectFieldOption<T extends string = string> {
  label: string;
  value: T;
}

export interface SelectFieldProps<T extends string = string> {
  label?: string;
  placeholder?: string;
  value: T | null;
  options: SelectFieldOption<T>[];
  onValueChange: (value: T) => void;
  error?: string | null;
  helperText?: string;
  editable?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * Dropdown/select variant (#468) — a TextField-styled trigger that opens a
 * BottomSheet (#469) listing the options. Screen-reader focus moves into
 * the option list on open and restores to the trigger on close via
 * BottomSheet's own restoreFocusRef handling, rather than this component
 * re-implementing focus trapping; each option is its own accessible
 * button, so both screen-reader swipe navigation and (where available, e.g.
 * a connected keyboard or react-native-web) sequential/tab navigation land
 * on every option in order.
 */
export default function SelectField<T extends string = string>({
  label,
  placeholder = 'Select…',
  value,
  options,
  onValueChange,
  error,
  helperText,
  editable = true,
  testID,
  accessibilityLabel,
}: SelectFieldProps<T>) {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<View>(null);

  const selected = options.find((option) => option.value === value);

  const handleSelect = (optionValue: T) => {
    onValueChange(optionValue);
    setVisible(false);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View ref={triggerRef} collapsable={false}>
        <TouchableOpacity
          style={[
            styles.trigger,
            error ? styles.triggerError : undefined,
            !editable && styles.triggerDisabled,
          ]}
          onPress={() => editable && setVisible(true)}
          disabled={!editable}
          testID={testID}
          accessible
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
          accessibilityHint="Double tap to choose from a list of options"
          accessibilityState={{ disabled: !editable }}
        >
          <Text style={[styles.triggerText, !selected && styles.placeholderText]}>
            {selected ? selected.label : placeholder}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>
      </View>
      {error ? (
        <ValidationError message={error} testID={testID ? `${testID}-error` : undefined} />
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}

      <BottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        snapPoints={['half']}
        accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
        restoreFocusRef={triggerRef}
        testID={testID ? `${testID}-sheet` : undefined}
      >
        {label ? <Text style={styles.sheetTitle}>{label}</Text> : null}
        <ScrollView accessibilityRole="menu">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <TouchableOpacity
                key={option.value}
                style={styles.option}
                onPress={() => handleSelect(option.value)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={option.label}
                testID={testID ? `${testID}-option-${option.value}` : undefined}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {option.label}
                </Text>
                {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: fieldColors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: fieldColors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  triggerError: {
    borderColor: fieldColors.borderError,
    backgroundColor: fieldColors.backgroundError,
  },
  triggerDisabled: {
    opacity: 0.6,
    backgroundColor: fieldColors.backgroundDisabled,
  },
  triggerText: {
    fontSize: 16,
    color: colors.text,
  },
  placeholderText: {
    color: colors.textTertiary,
  },
  chevron: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  optionText: {
    fontSize: 16,
    color: colors.text,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
  checkmark: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
});
