import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import {
  useAddressBookStore,
  isValidStellarAddress,
  AddressBookEntry,
  RecentRecipient,
} from '@/stores/addressBookStore';
import * as Clipboard from 'expo-clipboard';

interface AddressBookScreenProps {
  navigation?: any;
  route?: any;
}

export function AddressBookScreen({ navigation, route }: AddressBookScreenProps) {
  const {
    entries,
    recentRecipients,
    addEntry,
    updateEntry,
    removeEntry,
    getRecentRecipients,
    exportData,
    importData,
    clearRecentRecipients,
  } = useAddressBookStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AddressBookEntry | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [memoInput, setMemoInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const lower = searchQuery.trim().toLowerCase();
    return entries.filter(
      (e) =>
        e.label.toLowerCase().includes(lower) ||
        e.address.toLowerCase().includes(lower) ||
        (e.memo && e.memo.toLowerCase().includes(lower))
    );
  }, [entries, searchQuery]);

  const recentFiltered = useMemo(() => {
    // Show recents that are not already saved, optionally filtered by search
    const recents = getRecentRecipients(true);
    if (!searchQuery.trim()) return recents;
    const lower = searchQuery.trim().toLowerCase();
    return recents.filter((r) => r.address.toLowerCase().includes(lower));
  }, [recentRecipients, entries, searchQuery, getRecentRecipients]);

  const openAdd = () => {
    setEditingEntry(null);
    setLabelInput('');
    setAddressInput('');
    setMemoInput('');
    setFormError(null);
    setShowAddModal(true);
  };

  const openEdit = (entry: AddressBookEntry) => {
    setEditingEntry(entry);
    setLabelInput(entry.label);
    setAddressInput(entry.address);
    setMemoInput(entry.memo || '');
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSave = () => {
    setFormError(null);
    if (!labelInput.trim()) {
      setFormError('Label is required');
      return;
    }
    if (!isValidStellarAddress(addressInput.trim())) {
      setFormError('Invalid Stellar address');
      return;
    }

    let result;
    if (editingEntry) {
      result = updateEntry(editingEntry.id, {
        label: labelInput,
        address: addressInput,
        memo: memoInput,
      });
    } else {
      result = addEntry(labelInput, addressInput, memoInput);
    }

    if (!result.success) {
      setFormError(result.error || 'Failed to save');
      return;
    }

    setShowAddModal(false);
    setEditingEntry(null);
    setLabelInput('');
    setAddressInput('');
    setMemoInput('');
  };

  const handleDelete = (entry: AddressBookEntry) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete "${entry.label}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const result = removeEntry(entry.id);
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const handleCopy = async (address: string) => {
    await Clipboard.setStringAsync(address);
    Alert.alert('Copied', 'Address copied to clipboard');
  };

  const handleExport = async () => {
    const data = exportData();
    await Clipboard.setStringAsync(data);
    Alert.alert('Exported', 'Address book JSON copied to clipboard');
  };

  const handleImport = () => {
    const result = importData(importText);
    if (!result.success) {
      Alert.alert('Import failed', result.error || 'Invalid data');
      return;
    }
    Alert.alert('Imported', `Successfully imported ${result.count} contact(s)`);
    setShowImportModal(false);
    setImportText('');
  };

  const handlePasteImport = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setImportText(text);
  };

  const handleSelectAddress = (address: string) => {
    if (route?.params?.onSelect) {
      route.params.onSelect(address);
    }
    // Also navigate back to Send with prefilledAddress if opened from Send or in stack
    if (navigation?.navigate) {
      try {
        navigation.navigate('Send', { prefilledAddress: address });
        return;
      } catch {
        // Fallback to goBack
      }
    }
    if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  const renderEntry = ({ item }: { item: AddressBookEntry }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => handleSelectAddress(item.address)}
      accessibilityLabel={`Select contact ${item.label}`}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.label} numberOfLines={1}>
          {item.label}
        </Text>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => openEdit(item)} style={styles.smallBtn} accessibilityLabel={`Edit ${item.label}`}>
            <Text style={styles.smallBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.smallBtn, styles.deleteBtn]} accessibilityLabel={`Delete ${item.label}`}>
            <Text style={[styles.smallBtnText, styles.deleteBtnText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity onPress={() => handleCopy(item.address)}>
        <Text style={styles.address} numberOfLines={1}>
          {item.address}
        </Text>
      </TouchableOpacity>
      {item.memo ? <Text style={styles.memo}>Memo: {item.memo}</Text> : null}
      <Text style={styles.meta}>Added {new Date(item.createdAt).toLocaleDateString()}</Text>
    </TouchableOpacity>
  );

  const renderRecent = ({ item }: { item: RecentRecipient }) => (
    <TouchableOpacity
      style={styles.recentItem}
      activeOpacity={0.7}
      onPress={() => handleSelectAddress(item.address)}
      accessibilityLabel={`Select recent ${item.address}`}
    >
      <Text style={styles.recentAddress} numberOfLines={1}>
        {item.address}
      </Text>
      <Text style={styles.recentMeta}>
        Sent {item.count}x · {new Date(item.lastSentAt).toLocaleDateString()}
      </Text>
      <TouchableOpacity onPress={() => handleCopy(item.address)} style={styles.smallBtn}>
        <Text style={styles.smallBtnText}>Copy</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {navigation?.canGoBack?.() && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
            >
              <Text style={styles.backBtnText}>‹</Text>
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.title}>Address Book</Text>
            <Text style={styles.subtitle}>{entries.length} saved · {recentFiltered.length} recent</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openAdd} accessibilityLabel="Add contact">
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by label or address"
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel="Search address book"
        />
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={handleExport} accessibilityLabel="Export address book">
          <Text style={styles.toolbarBtnText}>Export</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowImportModal(true)} accessibilityLabel="Import address book">
          <Text style={styles.toolbarBtnText}>Import</Text>
        </TouchableOpacity>
        {recentRecipients.length > 0 && (
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={() =>
              Alert.alert('Clear recents?', 'Remove all recently sent-to suggestions?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: () => clearRecentRecipients() },
              ])
            }
          >
            <Text style={styles.toolbarBtnText}>Clear Recents</Text>
          </TouchableOpacity>
        )}
      </View>

      {recentFiltered.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recently Sent To</Text>
          <FlatList
            data={recentFiltered}
            keyExtractor={(item) => item.address}
            renderItem={renderRecent}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentList}
          />
        </View>
      )}

      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        renderItem={renderEntry}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📒</Text>
            <Text style={styles.emptyTitle}>No contacts yet</Text>
            <Text style={styles.emptyMessage}>
              {searchQuery ? 'No matches for your search' : 'Tap + Add to save a frequent recipient'}
            </Text>
          </View>
        }
      />

      {/* Add / Edit Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingEntry ? 'Edit Contact' : 'Add Contact'}</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Label *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Alice, Exchange, Savings"
                placeholderTextColor={colors.textTertiary}
                value={labelInput}
                onChangeText={setLabelInput}
                accessibilityLabel="Contact label"
              />
              <Text style={styles.inputLabel}>Stellar Address *</Text>
              <TextInput
                style={styles.input}
                placeholder="G..."
                placeholderTextColor={colors.textTertiary}
                value={addressInput}
                onChangeText={setAddressInput}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Stellar address"
              />
              <Text style={styles.inputLabel}>Memo (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional memo"
                placeholderTextColor={colors.textTertiary}
                value={memoInput}
                onChangeText={setMemoInput}
                accessibilityLabel="Memo"
              />
              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
              <TouchableOpacity style={styles.primaryButton} onPress={handleSave} accessibilityLabel="Save contact">
                <Text style={styles.primaryButtonText}>{editingEntry ? 'Update' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowAddModal(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Import Modal */}
      <Modal visible={showImportModal} transparent animationType="slide" onRequestClose={() => setShowImportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import Address Book</Text>
              <TouchableOpacity onPress={() => setShowImportModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Paste JSON</Text>
              <TextInput
                style={[styles.input, styles.importInput]}
                placeholder='{"entries": [...]}'
                placeholderTextColor={colors.textTertiary}
                value={importText}
                onChangeText={setImportText}
                multiline
                numberOfLines={6}
                accessibilityLabel="Import JSON"
              />
              <TouchableOpacity style={styles.secondaryButton} onPress={handlePasteImport}>
                <Text style={styles.secondaryButtonText}>Paste from Clipboard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleImport}>
                <Text style={styles.primaryButtonText}>Import</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowImportModal(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default AddressBookScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: {
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
  },
  backBtnText: {
    fontSize: 28,
    lineHeight: 28,
    color: colors.text,
    fontWeight: '300',
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  searchContainer: { padding: spacing.md, paddingBottom: spacing.sm },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
  },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  toolbarBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toolbarBtnText: { fontSize: 12, fontWeight: '600', color: colors.text },
  recentSection: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.text, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  recentList: { paddingHorizontal: spacing.md, gap: spacing.sm },
  recentItem: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginRight: spacing.sm,
    minWidth: 180,
  },
  recentAddress: { fontSize: 12, fontFamily: 'monospace', color: colors.text, marginBottom: 4 },
  recentMeta: { fontSize: 11, color: colors.textSecondary, marginBottom: spacing.xs },
  listContent: { padding: spacing.md, paddingTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  label: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  cardActions: { flexDirection: 'row', gap: spacing.xs },
  smallBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteBtn: { borderColor: colors.error, backgroundColor: colors.errorBackground },
  smallBtnText: { fontSize: 12, fontWeight: '600', color: colors.text },
  deleteBtnText: { color: colors.error },
  address: { fontSize: 12, fontFamily: 'monospace', color: colors.textSecondary, marginBottom: 2 },
  memo: { fontSize: 12, color: colors.textTertiary, marginBottom: 2 },
  meta: { fontSize: 11, color: colors.textTertiary, marginTop: spacing.xs },
  empty: { alignItems: 'center', padding: spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  emptyMessage: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '90%',
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
  modalBody: { padding: spacing.lg },
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm },
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
  importInput: { minHeight: 120, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 12 },
  errorText: { color: colors.error, fontSize: 13, marginTop: spacing.sm },
  primaryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },
});
