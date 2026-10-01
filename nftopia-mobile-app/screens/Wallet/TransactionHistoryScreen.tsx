import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { stellarWalletService, Transaction, TransactionType, TransactionFilters } from '@/src/services/stellar/wallet.service';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { useNetworkGuard } from '@/src/hooks/useNetworkGuard';
import { useToastStore } from '@/stores/toastStore';

interface TransactionHistoryScreenProps {
  navigation?: any;
}

export function TransactionHistoryScreen({ navigation }: TransactionHistoryScreenProps) {
  const { wallet } = useAuthStore();
  const { guardAsyncWriteAction } = useNetworkGuard();
  const { showToast } = useToastStore();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextPage, setNextPage] = useState<string | undefined>();
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({});

  const loadTransactions = useCallback(async (isRefresh = false) => {
    if (!wallet?.publicKey) return;

    const success = await guardAsyncWriteAction(async () => {
      try {
        if (isRefresh) {
          setRefreshing(true);
          setNextPage(undefined);
        } else {
          setLoading(true);
        }

        const result = await stellarWalletService.getFilteredTransactions(
          wallet.publicKey,
          filters,
          isRefresh ? undefined : nextPage
        );

        if (isRefresh) {
          setTransactions(result.transactions);
        } else {
          setTransactions(prev => [...prev, ...result.transactions]);
        }

        setNextPage(result.nextPage);
        setHasMore(result.hasMore);
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Failed to load transactions',
          'error',
          3000
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, 'Loading transactions requires internet connection');

    return success;
  }, [wallet?.publicKey, filters, nextPage, guardAsyncWriteAction, showToast]);

  useEffect(() => {
    loadTransactions(true);
  }, [wallet?.publicKey]);

  const handleRefresh = () => {
    loadTransactions(true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore && nextPage) {
      loadTransactions(false);
    }
  };

  const handleTransactionPress = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
  };

  const handleCloseDetail = () => {
    setSelectedTransaction(null);
  };

  const handleViewOnExplorer = () => {
    if (selectedTransaction?.hash) {
      const explorerUrl = `https://stellar.expert/explorer/public/tx/${selectedTransaction.hash}`;
      Linking.openURL(explorerUrl).catch(() => {
        showToast('Unable to open block explorer', 'error', 3000);
      });
    }
  };

  const applyFilters = (newFilters: TransactionFilters) => {
    setFilters(newFilters);
    setShowFilters(false);
    loadTransactions(true);
  };

  const clearFilters = () => {
    setFilters({});
    setShowFilters(false);
    loadTransactions(true);
  };

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const icon = stellarWalletService.getTransactionTypeIcon(item.type);
    const label = stellarWalletService.getTransactionTypeLabel(item.type);
    const statusColor = item.successful ? colors.success : colors.error;

    return (
      <TouchableOpacity
        style={styles.transactionItem}
        onPress={() => handleTransactionPress(item)}
        accessible={true}
        accessibilityLabel={`${label} transaction`}
        accessibilityHint={`Tap to view details. ${item.successful ? 'Successful' : 'Failed'}`}
      >
        <View style={styles.transactionIcon}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>

        <View style={styles.transactionDetails}>
          <Text style={styles.transactionType}>{label}</Text>
          <Text style={styles.transactionDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.transactionRight}>
          {item.amount && (
            <Text style={styles.transactionAmount}>
              {item.amount} {item.asset || 'XLM'}
            </Text>
          )}
          <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📜</Text>
      <Text style={styles.emptyTitle}>No Transactions</Text>
      <Text style={styles.emptyMessage}>
        {wallet?.publicKey
          ? 'Your wallet has no transaction history yet'
          : 'Connect a wallet to view transactions'}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  if (!wallet?.publicKey) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔐</Text>
          <Text style={styles.emptyTitle}>No Wallet Connected</Text>
          <Text style={styles.emptyMessage}>
            Connect a wallet to view transaction history
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transaction History</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
          accessible={true}
          accessibilityLabel="Filter transactions"
        >
          <Text style={styles.filterButtonText}>🔍 Filter</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={transactions}
        renderItem={renderTransactionItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />

      {/* Transaction Detail Modal */}
      <Modal
        visible={!!selectedTransaction}
        transparent
        animationType="slide"
        onRequestClose={handleCloseDetail}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction Details</Text>
              <TouchableOpacity onPress={handleCloseDetail}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedTransaction && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>
                    {stellarWalletService.getTransactionTypeLabel(selectedTransaction.type)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { color: selectedTransaction.successful ? colors.success : colors.error },
                    ]}
                  >
                    {selectedTransaction.successful ? 'Successful' : 'Failed'}
                  </Text>
                </View>

                {selectedTransaction.amount && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Amount</Text>
                    <Text style={styles.detailValue}>
                      {selectedTransaction.amount} {selectedTransaction.asset || 'XLM'}
                    </Text>
                  </View>
                )}

                {selectedTransaction.from && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>From</Text>
                    <Text style={styles.detailValue} numberOfLines={1}>
                      {selectedTransaction.from}
                    </Text>
                  </View>
                )}

                {selectedTransaction.to && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>To</Text>
                    <Text style={styles.detailValue} numberOfLines={1}>
                      {selectedTransaction.to}
                    </Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedTransaction.createdAt).toLocaleString()}
                  </Text>
                </View>

                {selectedTransaction.ledger !== undefined && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Ledger</Text>
                    <Text style={styles.detailValue}>{selectedTransaction.ledger}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Transaction Hash</Text>
                  <Text style={styles.detailValueHash} numberOfLines={2}>
                    {selectedTransaction.hash}
                  </Text>
                </View>

                {selectedTransaction.memo && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Memo</Text>
                    <Text style={styles.detailValue}>{selectedTransaction.memo}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.explorerButton}
                  onPress={handleViewOnExplorer}
                >
                  <Text style={styles.explorerButtonText}>View on Stellar Expert</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Transactions</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Transaction Type</Text>
                <View style={styles.typeOptions}>
                  {Object.values(TransactionType).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeOption,
                        filters.type === type && styles.typeOptionSelected,
                      ]}
                      onPress={() => applyFilters({ ...filters, type })}
                    >
                      <Text
                        style={[
                          styles.typeOptionText,
                          filters.type === type && styles.typeOptionTextSelected,
                        ]}
                      >
                        {stellarWalletService.getTransactionTypeLabel(type)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={clearFilters}
              >
                <Text style={styles.clearFiltersText}>Clear All Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  iconText: {
    fontSize: 20,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionType: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
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
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    fontSize: 24,
    color: colors.textSecondary,
    padding: spacing.sm,
  },
  modalBody: {
    padding: spacing.lg,
  },
  detailRow: {
    marginBottom: spacing.md,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text,
  },
  detailValueHash: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  explorerButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  explorerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filterSection: {
    marginBottom: spacing.lg,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  typeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeOptionText: {
    fontSize: 12,
    color: colors.text,
  },
  typeOptionTextSelected: {
    color: '#FFFFFF',
  },
  clearFiltersButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  clearFiltersText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
