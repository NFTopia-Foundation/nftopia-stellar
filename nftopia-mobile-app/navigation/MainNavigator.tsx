import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '@/stores/notificationStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { errorLogger } from '@/src/errors/logger';
import { getTransitionConfig } from '@/src/navigation/transition.config';

// Core Screens
import HomeScreen from '@/screens/Home/HomeScreen';
import ProfileScreen from '@/screens/Profile/ProfileScreen';
import WalletManagementScreen from '@/screens/Profile/WalletManagementScreen';
import MarketplaceScreen from '@/screens/Marketplace/MarketplaceScreen';
import NFTDetailScreen from '@/screens/Marketplace/NFTDetailScreen';
import FavoritesScreen from '@/screens/Favorites/FavoritesScreen';

// Auction Screens
import AuctionsScreen from '@/screens/Auctions/AuctionsScreen';
import AuctionDetailScreen from '@/screens/Auctions/AuctionDetailScreen';
import CreateAuctionScreen from '@/screens/Auctions/CreateAuctionScreen';

// Collection & Search Screens
import CollectionsScreen from '@/screens/Collections/CollectionsScreen';
import SearchResultsScreen from '@/screens/Search/SearchResultsScreen';

// AI Assistant
import AssistantScreen from '@/screens/Assistant/AssistantScreen';

// Creator Screens
import CreatorDashboardScreen from '@/screens/Creator/CreatorDashboardScreen';
import MyNFTsScreen from '@/screens/Creator/MyNFTsScreen';
import MintNFTScreen from '@/screens/Creator/MintNFTScreen';
import CreateCollectionScreen from '@/screens/Creator/CreateCollectionScreen';
import EarningsScreen from '@/screens/Creator/EarningsScreen';

// Notification Screens
import NotificationsScreen from '@/screens/Notifications/NotificationsScreen';
import NotificationSettingsScreen from '@/screens/Notifications/NotificationSettingsScreen';
import SettingsScreen from '@/screens/Settings/SettingsScreen';
import { SendScreen } from '@/screens/Wallet/SendScreen';

// Backup Reminder Screen
import BackupReminderScreen from '@/screens/BackupReminder/BackupReminderScreen';

export type MainStackParamList = {
  Home: undefined;
  WalletManagement: { autoExport?: boolean } | undefined;
  Profile: undefined;
  CreatorDashboard: undefined;
  MyNFTs: undefined;
  MintNFT: undefined;
  CreateCollection: undefined;
  NFTDetail: { nftId: string };
  CollectionDetail: { collectionId: string };
  Collections: undefined;
  SearchResults: { query: string };
  Auctions: undefined;
  AuctionDetail: { auctionId: string };
  CreateAuction: undefined;
  Assistant: undefined;
  Earnings: undefined;
  Transactions: undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
  Settings: undefined;
  Send: { prefilledAddress?: string } | undefined;
  Marketplace: { category?: string } | undefined;
  BackupReminder: undefined;
  Favorites: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

function OfflineBanner() {
  const { t } = useTranslation();
  const { isOnline } = useOfflineStore();
  if (isOnline) return null;
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineBannerText}>{t('common.offline')}</Text>
    </View>
  );
}

function ScreenErrorBoundary({ children, name }: { children: React.ReactNode; name: string }) {
  return (
    <ErrorBoundary
      name={name}
      onError={(error, errorInfo) => {
        errorLogger.log(
          error,
          name,
          undefined,
          { componentStack: errorInfo.componentStack }
        );
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

export default function MainNavigator() {
  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        {/* Core Screens - Home with fade transition */}
        <Stack.Screen 
          name="Home"
          options={getTransitionConfig('auth')}
        >
          {() => (
            <ScreenErrorBoundary name="HomeScreen">
              <HomeScreen />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>
        
        {/* Profile screens with slide transition */}
        <Stack.Screen 
          name="Profile"
          options={getTransitionConfig('detail')}
        >
          {(props) => (
            <ScreenErrorBoundary name="ProfileScreen">
              <ProfileScreen {...props} />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>
        
        <Stack.Screen 
          name="WalletManagement"
          options={getTransitionConfig('detail')}
        >
          {(props) => (
            <ScreenErrorBoundary name="WalletManagementScreen">
              <WalletManagementScreen {...props} />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>

        <Stack.Screen name="Send" component={SendScreen} />
        
        {/* Marketplace with detail transition */}
        <Stack.Screen 
          name="Marketplace"
          options={getTransitionConfig('detail')}
        >
          {() => (
            <ScreenErrorBoundary name="MarketplaceScreen">
              <MarketplaceScreen />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>
        
        {/* NFT Detail with special detail transition */}
        <Stack.Screen 
          name="NFTDetail"
          options={{
            ...getTransitionConfig('detail'),
            animation: 'slide_from_right',
          }}
        >
          {() => (
            <ScreenErrorBoundary name="NFTDetailScreen">
              <NFTDetailScreen />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>

        {/* Favorites / Wishlist with detail transition */}
        <Stack.Screen 
          name="Favorites"
          options={getTransitionConfig('detail')}
        >
          {() => (
            <ScreenErrorBoundary name="FavoritesScreen">
              <FavoritesScreen />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>

        {/* Creator Screens with creator transition */}
        <Stack.Screen 
          name="CreatorDashboard"
          options={getTransitionConfig('creator')}
        >
          {() => (
            <ScreenErrorBoundary name="CreatorDashboardScreen">
              <CreatorDashboardScreen />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>
        
        <Stack.Screen 
          name="MyNFTs"
          options={getTransitionConfig('creator')}
        >
          {() => (
            <ScreenErrorBoundary name="MyNFTsScreen">
              <MyNFTsScreen />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>
        
        <Stack.Screen 
          name="MintNFT"
          options={getTransitionConfig('modal')}
        >
          {() => (
            <ScreenErrorBoundary name="MintNFTScreen">
              <MintNFTScreen />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>
        
        <Stack.Screen 
          name="CreateCollection"
          options={getTransitionConfig('modal')}
        >
          {() => (
            <ScreenErrorBoundary name="CreateCollectionScreen">
              <CreateCollectionScreen />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>
        
        <Stack.Screen 
          name="Earnings"
          options={getTransitionConfig('creator')}
        >
          {() => (
            <ScreenErrorBoundary name="EarningsScreen">
              <EarningsScreen />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>

        {/* Notification Screens with modal transition */}
        <Stack.Screen 
          name="Notifications"
          options={getTransitionConfig('modal')}
        >
          {() => (
            <ScreenErrorBoundary name="NotificationsScreen">
              <NotificationsScreen />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>
        
        <Stack.Screen 
          name="NotificationSettings"
          options={getTransitionConfig('modal')}
        >
          {() => (
            <ScreenErrorBoundary name="NotificationSettingsScreen">
              <NotificationSettingsScreen />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>

        <Stack.Screen name="Settings" options={getTransitionConfig('modal')}>
          {(props) => <ScreenErrorBoundary name="SettingsScreen"><SettingsScreen {...props} /></ScreenErrorBoundary>}
        </Stack.Screen>

        {/* Auctions */}
        <Stack.Screen name="Auctions">
          {(props) => (
            <ScreenErrorBoundary name="AuctionsScreen">
              <AuctionsScreen {...props} />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>
        <Stack.Screen name="AuctionDetail">
          {(props) => (
            <ScreenErrorBoundary name="AuctionDetailScreen">
              <AuctionDetailScreen {...props} />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>
        <Stack.Screen name="CreateAuction">
          {(props) => (
            <ScreenErrorBoundary name="CreateAuctionScreen">
              <CreateAuctionScreen {...props} />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>

        {/* Collections & Search */}
        <Stack.Screen name="Collections">
          {(props) => (
            <ScreenErrorBoundary name="CollectionsScreen">
              <CollectionsScreen {...props} />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>
        <Stack.Screen name="SearchResults">
          {(props) => (
            <ScreenErrorBoundary name="SearchResultsScreen">
              <SearchResultsScreen {...props} />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>

        {/* AI Assistant */}
        <Stack.Screen name="Assistant" options={getTransitionConfig('modal')}>
          {(props) => (
            <ScreenErrorBoundary name="AssistantScreen">
              <AssistantScreen {...props} />
            </ScreenErrorBoundary>
          )}
        </Stack.Screen>

      </Stack.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: '#FFEAA7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  offlineBannerText: {
    color: '#D68910',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});
