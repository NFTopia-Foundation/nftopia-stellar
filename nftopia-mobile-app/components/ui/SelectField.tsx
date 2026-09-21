import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
  AccessibilityInfo,
} from 'react-native';
import ValidationError from '@/components/ui/ValidationError';
import { getNextHighlightIndex, SelectNavigateKey } from '@/components/ui/inputUtils';
import {
  borderRadius,
  colors,
  inputTokens,
  resolveInputBackgroundColor,
  resolveInputBorderColor,
  spacing,
  typography,
} from '@/constants/theme';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectFieldProps {
  options: SelectOption[];
  value?: string | null;
  onChange: (value: string, option: SelectOption) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  error?: string | null;
  disabled?: boolean;
  testID?: string;
  containerStyle?: StyleProp<ViewStyle>;
  modalTitle?: string;
}

const keyFromEvent = (event: unknown): string | undefined => {
  const candidate = event as { key?: string; nativeEvent?: { key?: string } } | undefined;
  return candidate?.nativeEvent?.key ?? candidate?.key;
};

/**
 * Dropdown / select input composed from the shared input tokens.
 *
 * The trigger is a single accessible control; the option list is rendered in a
 * modal where every option is an accessibility `radio` with its selected state
 * exposed. Arrow keys / Home / End move a highlight, Enter or Space commits it
 * and Escape or Tab dismisses the list, so hardware keyboards and screen
 * readers can both drive the control.
 */
export default function SelectField({
  options,
  value,
  onChange,
  label,
  placeholder = 'Select an option',
  helperText,
  error,
  disabled = false,
  testID,
  containerStyle,
  modalTitle,
}: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const hasError = Boolean(error);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const firstEnabledIndex = useMemo(
    () => options.findIndex((option) => !option.disabled),
    [options]
  );

  const borderColor = resolveInputBorderColor({
    focused: isOpen,
    error: hasError,
  });
  const backgroundColor = resolveInputBackgroundColor({
    focused: isOpen,
    error: hasError,
    disabled,
  });

  const findByStep = (from: number, key: SelectNavigateKey): number => {
    if (options.length === 0) return -1;
    let next = getNextHighlightIndex(from, options.length, key);
    let guard = 0;
    while (options[next]?.disabled && guard < options.length) {
      next = getNextHighlightIndex(next, options.length, key);
      guard += 1;
    }
    return options[next]?.disabled ? -1 : next;
  };

  const open = () => {
    if (disabled) return;
    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex);
    setIsOpen(true);
  };

  const close = () => setIsOpen(false);

  const commit = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value, option);
    setIsOpen(false);
  };

  const handleKeyDown = (event: { preventDefault?: () => void } | undefined) => {
    const key = keyFromEvent(event);
    if (!key) return;

    if (!isOpen) {
      if (key === 'Enter' || key === ' ' || key === 'ArrowDown' || key === 'ArrowUp') {
        event?.preventDefault?.();
        open();
      }
      return;
    }

    if (key === 'Enter' || key === ' ') {
      commit(highlightedIndex);
    } else if (key === 'Escape' || key === 'Tab') {
      close();
    } else {
      setHighlightedIndex((current) => findByStep(current, key));
    }
  };

  const keyboardNavigationProps = { onKeyDown: handleKeyDown } as Record<string, unknown>;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text
          style={styles.label}
          nativeID={testID ? `${testID}-label` : undefined}
        >
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={isOpen ? close : open}
        disabled={disabled}
        testID={testID}
        style={[styles.trigger, { borderColor, backgroundColor }]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={
          label ? `${label}: ${selectedOption?.label ?? placeholder}` : undefined
        }
        accessibilityHint={`Opens a list of ${options.length} options`}
        accessibilityState={{ expanded: isOpen, disabled }}
      >
        <Text
          style={[
            styles.valueText,
            !selectedOption && styles.placeholderText,
          ]}
          numberOfLines={1}
        >
          {selectedOption?.label ?? placeholder}
        </Text>
        <Text style={styles.caret} accessibilityElementsHidden importantForAccessibility="no">
          ▾
        </Text>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={close}
        testID={testID ? `${testID}-modal` : undefined}
      >
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close menu">
          <View
            style={styles.sheet}
            accessibilityViewIsModal
            accessibilityRole="menu"
            {...keyboardNavigationProps}
          >
            {modalTitle ? <Text style={styles.sheetTitle}>{modalTitle}</Text> : null}
            <ScrollView>
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => commit(index)}
                    disabled={option.disabled}
                    testID={testID ? `${testID}-option-${option.value}` : undefined}
                    style={[
                      styles.option,
                      isHighlighted && styles.optionHighlighted,
                      isSelected && styles.optionSelected,
                    ]}
                    accessible
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{
                      checked: isSelected,
                      selected: isSelected,
                      disabled: option.disabled,
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                        option.disabled && styles.optionTextDisabled,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <Text style={styles.checkmark} accessibilityElementsHidden importantForAccessibility="no">
                        ✓
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {hasError ? (
        <ValidationError
          message={error ?? null}
          testID={testID ? `${testID}-error` : undefined}
        />
      ) : helperText ? (
        <Text style={styles.helperText} testID={testID ? `${testID}-helper` : undefined}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: inputTokens.label,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: 16,
  },
  valueText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  placeholderText: {
    color: inputTokens.placeholder,
  },
  caret: {
    marginLeft: spacing.sm,
    fontSize: 14,
    color: colors.textSecondary,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.backdrop,
  },
  sheet: {
    maxHeight: '60%',
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  optionHighlighted: {
    backgroundColor: colors.surfaceHover,
  },
  optionSelected: {
    backgroundColor: colors.infoBackground,
  },
  optionText: {
    fontSize: 16,
    color: colors.text,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: colors.infoText,
  },
  optionTextDisabled: {
    color: colors.textTertiary,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.infoText,
  },
  helperText: {
    ...typography.caption,
    color: inputTokens.helper,
  },
});
