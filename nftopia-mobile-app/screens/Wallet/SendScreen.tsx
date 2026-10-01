import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import {
  useAddressBookStore,
  isValidStellarAddress,
} from '@/stores/addressBookStore';
import { useWalletStore } from '@/stores/walletStore';
import {
  StellarWalletService,
  WalletError,
  checkMinimumReserve,
  isValidCustomFeeStroops,
  type FeeEstimate,
  type FeeTierName,
} from '@/src/services/stellar/wallet.service';
import ConfirmationDialog from '@/components/wallet/ConfirmationDialog';
import TransactionFeeSummary from '@/components/wallet/TransactionFeeSummary';
import { haptics } from '@/lib/haptics';

interface SendScreenProps {
  navigation?: any;
  route?: any;
  onSend?: (params: { address: string; amount: string; memo?: string }) => Promise<void>;
}

export function SendScreen({ navigation, route, onSend }: SendScreenProps) {
  const { wallets, activePublicKey, network } = useWalletStore();
  const { entries, recentRecipients, getRecentRecipients, addRecentRecipient } = useAddressBookStore();

  const [recipient, setRecipient] = useState(route?.params?.prefilledAddress || '');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);

  // Fee confirmation (#471) — shown before any transaction is submitted.
  const [showConfirm, setShowConfirm] = useState(false);
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<FeeTierName>('medium');
  const [useCustomFee, setUseCustomFee] = useState(false);
  const [customFeeStroops, setCustomFeeStroops] = useState('');
  const [reserveInfo, setReserveInfo] = useState<{
    nativeBalanceStroops: string;
    subentryCount: number;
  } | null>(null);
  const [sending, setSending] = useState(false);

  // `route.params.prefilledAddress` changes when the QR scanner navigates
  // back to this same (already-mounted) screen instance with a new scan —
  // the `useState` initializer above only runs once, so it can't pick that
  // up on its own.
  useEffect(() => {
    const prefilled = route?.params?.prefilledAddress;
    if (prefilled && prefilled !== recipient) {
      setRecipient(prefilled);
      setAddressError(null);
    }
  }, [route?.params?.prefilledAddress]);

  const recentFiltered = useMemo(() => {
    // Exclude saved addresses from recent suggestions
    const recents = getRecentRecipients(true);
    if (!pickerQuery.trim() && !recipient.trim()) return recents;
    // When picker is open, filter by pickerQuery; otherwise filter recents by recipient input for inline suggestion
    const q = pickerQuery || recipient;
    if (!q.trim()) return recents;
    const lower = q.trim().toLowerCase();
    return recents.filter((r) => r.address.toLowerCase().includes(lower));
  }, [recentRecipients, entries, pickerQuery, recipient, getRecentRecipients]);

  const filteredEntries = useMemo(() => {
    if (!pickerQuery.trim()) return entries;
    const lower = pickerQuery.trim().toLowerCase();
    return entries.filter(
      (e) => e.label.toLowerCase().includes(lower) || e.address.toLowerCase().includes(lower)
    );
  }, [entries, pickerQuery]);

  const inlineRecentSuggestions = useMemo(() => {
    // Show up to 5 recent suggestions inline below the recipient input when user types
    if (!recipient.trim() || isValidStellarAddress(recipient.trim())) return [];
    // Don't show if picker is open
    if (showPicker) return [];
    return recentFiltered.slice(0, 5);
  }, [recentFiltered, recipient, showPicker]);

  const handleSelectRecipient = (address: string) => {
    setRecipient(address);
    setAddressError(null);
    setShowPicker(false);
    setPickerQuery('');
  };

  const validateAddress = (addr: string): boolean => {
    if (!addr.trim()) {
      setAddressError('Recipient address is required');
      haptics.error();
      return false;
    }
    if (!isValidStellarAddress(addr.trim())) {
      setAddressError('Invalid Stellar address');
      haptics.error();
      return false;
    }
    setAddressError(null);
    return true;
  };

  // Resolved per-operation fee, in stroops: the custom override when
  // advanced mode is on, otherwise the selected tier's recommendation.
  const resolvedFeeStroops = useCustomFee
    ? customFeeStroops
    : feeEstimate?.tiers[selectedTier].feePerOperationStroops;

  const customFeeError =
    useCustomFee && customFeeStroops && feeEstimate && !isValidCustomFeeStroops(customFeeStroops, feeEstimate.tiers.low.feePerOperationStroops)
      ? `Must be at least ${feeEstimate.tiers.low.feePerOperationStroops} stroops`
      : undefined;

  // Recomputed locally (no extra network call) whenever the resolved fee
  // or reserve info changes, so switching tiers/entering a custom fee
  // updates the warning immediately.
  const reserveResult =
    reserveInfo && resolvedFeeStroops
      ? checkMinimumReserve({
          nativeBalanceStroops: reserveInfo.nativeBalanceStroops,
          subentryCount: reserveInfo.subentryCount,
          totalFeeStroops: resolvedFeeStroops,
          nativeAmountSpentStroops: String(Math.round(Number(amount || '0') * 10_000_000)),
        })
      : null;

  const reserveWarning =
    reserveResult && !reserveResult.ok
      ? `This would leave your account below the ${reserveResult.minimumReserveXlm} XLM minimum reserve. Reduce the amount or add funds.`
      : undefined;

  const handleSend = async () => {
    if (!validateAddress(recipient)) return;
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      haptics.error();
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }
    if (!onSend && !wallets.find((item) => item.publicKey === activePublicKey)) {
      haptics.error();
      Alert.alert('Error', 'Connect a wallet before sending');
      return;
    }

    // Reset any fee/reserve state left over from a previous open.
    setSelectedTier('medium');
    setUseCustomFee(false);
    setCustomFeeStroops('');
    setFeeEstimate(null);
    setReserveInfo(null);
    setShowConfirm(true);
    setFeeLoading(true);

    const service = new StellarWalletService(undefined, network);
    // Settled independently, not Promise.all: estimateFee never rejects
    // (it degrades gracefully internally), but getAccountReserveInfo can —
    // and a reserve-info failure must not also discard an otherwise-fine
    // fee estimate the user is waiting to see.
    const [estimateResult, reserveResult] = await Promise.allSettled([
      service.estimateFee(['Send Payment']),
      activePublicKey ? service.getAccountReserveInfo(activePublicKey) : Promise.resolve(null),
    ]);
    if (estimateResult.status === 'fulfilled') {
      setFeeEstimate(estimateResult.value);
    }
    if (reserveResult.status === 'fulfilled' && reserveResult.value) {
      setReserveInfo(reserveResult.value);
    }
    // A reserveResult rejection is left silent: reserveInfo simply stays
    // null, so the confirm dialog still shows the fee, it just can't warn
    // about the reserve for this attempt.
    setFeeLoading(false);
  };

  const handleConfirmSend = async () => {
    setSending(true);
    try {
      if (onSend) {
        await onSend({ address: recipient.trim(), amount: amount.trim(), memo: memo.trim() || undefined });
      } else {
        const wallet = wallets.find((item) => item.publicKey === activePublicKey);
        if (!wallet) throw new Error('Connect a wallet before sending');
        const service = new StellarWalletService(undefined, network);
        await service.sendPayment(
          wallet.secretKey,
          recipient.trim(),
          amount.trim(),
          'XLM',
          undefined,
          memo.trim() || undefined,
          resolvedFeeStroops,
        );
        Alert.alert('Sent', `${amount.trim()} XLM sent successfully`);
      }
      haptics.success();
      addRecentRecipient(recipient.trim());
      setShowConfirm(false);
      if (navigation?.goBack) navigation.goBack();
    } catch (e) {
      const message =
        e instanceof WalletError ? e.message : e instanceof Error ? e.message : 'Unknown error';
      haptics.error();
      Alert.alert('Send failed', message);
    } finally {
      setSending(false);
    }
  };

  const handleScan = () => {
    navigation?.navigate?.('QRScanner');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Send Funds</Text>

        <Text style={styles.label}>Recipient Address *</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flexInput, addressError ? styles.inputError : null]}
            placeholder="G... Stellar address"
            placeholderTextColor={colors.textTertiary}
            value={recipient}
            onChangeText={(t) => {
              setRecipient(t);
              if (addressError) setAddressError(null);
            }}
            onBlur={() => {
              if (recipient.trim()) validateAddress(recipient);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Recipient address"
          />
          <TouchableOpacity style={styles.scanBtn} onPress={handleScan} accessibilityLabel="Scan QR">
            <Text style={styles.scanBtnText}>Scan</Text>
          </TouchableOpacity>
        </View>
        {addressError ? <Text style={styles.errorText}>{addressError}</Text> : null}

        {/* Inline recent suggestions */}
        {inlineRecentSuggestions.length > 0 && (
          <View style={styles.inlineSuggestions}>
            <Text style={styles.suggestionTitle}>Recent — tap to fill</Text>
            {inlineRecentSuggestions.map((r) => (
              <TouchableOpacity
                key={r.address}
                style={styles.suggestionItem}
                onPress={() => handleSelectRecipient(r.address)}
                accessibilityLabel={`Use recent ${r.address}`}
              >
                <Text style={styles.suggestionAddress} numberOfLines={1}>
                  {r.address}
                </Text>
                <Text style={styles.suggestionMeta}>
                  {r.count}x · {new Date(r.lastSentAt).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowPicker(true)} accessibilityLabel="Choose from address book">
          <Text style={styles.pickerButtonText}>📒 Choose from Address Book ({entries.length})</Text>
        </TouchableOpacity>

        {recentFiltered.length > 0 && !recipient.trim() && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recently Sent To (tap to select)</Text>
            {recentFiltered.slice(0, 3).map((r) => (
              <TouchableOpacity
                key={r.address}
                style={styles.recentChip}
                onPress={() => handleSelectRecipient(r.address)}
              >
                <Text style={styles.recentChipText} numberOfLines={1}>
                  {r.address.slice(0, 12)}...{r.address.slice(-6)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Amount (XLM) *</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor={colors.textTertiary}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          accessibilityLabel="Amount"
        />

        <Text style={styles.label}>Memo (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Optional memo"
          placeholderTextColor={colors.textTertiary}
          value={memo}
          onChangeText={setMemo}
          accessibilityLabel="Memo"
        />

        <TouchableOpacity style={styles.sendButton} onPress={handleSend} accessibilityLabel="Send funds">
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation?.goBack?.()} accessibilityLabel="Cancel">
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Recipient Picker Modal */}
      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Recipient</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pickerSearchContainer}>
              <TextInput
                style={styles.pickerSearch}
                placeholder="Search address book"
                placeholderTextColor={colors.textTertiary}
                value={pickerQuery}
                onChangeText={setPickerQuery}
                accessibilityLabel="Search address book"
              />
            </View>

            <Text style={styles.pickerSectionTitle}>Saved Contacts</Text>
            <FlatList
              data={filteredEntries}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => handleSelectRecipient(item.address)}
                  accessibilityLabel={`Select ${item.label}`}
                >
                  <Text style={styles.pickerLabel}>{item.label}</Text>
                  <Text style={styles.pickerAddress} numberOfLines={1}>
                    {item.address}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.pickerEmpty}>
                  <Text style={styles.pickerEmptyText}>
                    {entries.length === 0 ? 'No saved contacts' : 'No matches'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowPicker(false);
                      navigation?.navigate?.('AddressBook');
                    }}
                  >
                    <Text style={styles.linkText}>Go to Address Book</Text>
                  </TouchableOpacity>
                </View>
              }
              style={styles.pickerList}
            />

            {recentFiltered.length > 0 && (
              <>
                <Text style={styles.pickerSectionTitle}>Recently Sent To</Text>
                <FlatList
                  data={recentFiltered}
                  keyExtractor={(item) => item.address}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.pickerItem}
                      onPress={() => handleSelectRecipient(item.address)}
                      accessibilityLabel={`Select recent ${item.address}`}
                    >
                      <Text style={styles.pickerLabel}>Recent · {item.count}x</Text>
                      <Text style={styles.pickerAddress} numberOfLines={1}>
                        {item.address}
                      </Text>
                    </TouchableOpacity>
                  )}
                  style={styles.pickerListShort}
                />
              </>
            )}

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowPicker(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmationDialog
        visible={showConfirm}
        title="Confirm Payment"
        message={`Send ${amount.trim() || '0'} XLM to ${recipient.trim().slice(0, 8)}...${recipient.trim().slice(-6)}?`}
        confirmLabel={sending ? 'Sending…' : 'Confirm & Send'}
        cancelLabel="Cancel"
        onConfirm={handleConfirmSend}
        onCancel={() => setShowConfirm(false)}
        confirmDisabled={
          sending || feeLoading || !!reserveWarning || !!customFeeError || (useCustomFee && !customFeeStroops)
        }
      >
        <TransactionFeeSummary
          testID="send-fee-summary"
          estimate={feeEstimate}
          loading={feeLoading}
          selectedTier={selectedTier}
          onSelectTier={setSelectedTier}
          useCustomFee={useCustomFee}
          onToggleCustomFee={setUseCustomFee}
          customFeeStroops={customFeeStroops}
          onCustomFeeChange={setCustomFeeStroops}
          customFeeError={customFeeError}
          reserveWarning={reserveWarning}
        />
      </ConfirmationDialog>
    </View>
  );
}

export default SendScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  flexInput: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: 12, marginTop: spacing.xs },
  scanBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scanBtnText: { fontWeight: '600', color: colors.text, fontSize: 13 },
  pickerButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  pickerButtonText: { fontWeight: '600', color: colors.primary, fontSize: 14 },
  recentSection: { marginTop: spacing.md },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  recentChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  recentChipText: { fontSize: 12, fontFamily: 'monospace', color: colors.text },
  inlineSuggestions: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  suggestionTitle: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  suggestionItem: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  suggestionAddress: { fontSize: 12, fontFamily: 'monospace', color: colors.text },
  suggestionMeta: { fontSize: 11, color: colors.textTertiary },
  sendButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  sendButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '90%',
    paddingBottom: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  closeButton: { fontSize: 20, color: colors.textSecondary, padding: spacing.sm },
  pickerSearchContainer: { padding: spacing.md },
  pickerSearch: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
  },
  pickerSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  pickerList: { maxHeight: 250 },
  pickerListShort: { maxHeight: 150 },
  pickerItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  pickerLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  pickerAddress: { fontSize: 12, fontFamily: 'monospace', color: colors.textSecondary, marginTop: 2 },
  pickerEmpty: { alignItems: 'center', padding: spacing.lg },
  pickerEmptyText: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  linkText: { color: colors.info, fontWeight: '600', fontSize: 13 },
  modalCloseBtn: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalCloseBtnText: { fontWeight: '600', color: colors.text },
});
