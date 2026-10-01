import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { colors, spacing, borderRadius } from '@/constants/theme';
import { useWalletConnect } from '@/hooks/useWalletConnect';
import { classifyQrContent } from '@/src/utils/qrScan';
import { analyticsService } from '@/src/analytics/analytics.service';
import { ANALYTICS_EVENTS } from '@/src/analytics/config';

interface QRScannerScreenProps {
  navigation?: any;
}

export function QRScannerScreen({ navigation }: QRScannerScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const { pairWithUri } = useWalletConnect();

  const [torchOn, setTorchOn] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Barcode scanning fires repeatedly while the same code stays in frame —
  // this guards against acting on it more than once per scan.
  const hasScannedRef = useRef(false);

  const handleClose = useCallback(() => {
    navigation?.goBack?.();
  }, [navigation]);

  const handleScanAgain = useCallback(() => {
    setScanError(null);
    hasScannedRef.current = false;
  }, []);

  const processContent = useCallback(
    (raw: string) => {
      const classification = classifyQrContent(raw);

      if (classification.type === 'stellar-address' && classification.address) {
        analyticsService.track(ANALYTICS_EVENTS.QR_SCAN_SUCCESS, {
          content_type: 'stellar-address',
        });
        navigation?.navigate?.('Send', { prefilledAddress: classification.address });
        return;
      }

      if (classification.type === 'wallet-connect-uri' && classification.uri) {
        const result = pairWithUri(classification.uri);
        analyticsService.track(ANALYTICS_EVENTS.QR_SCAN_SUCCESS, {
          content_type: 'wallet-connect-uri',
          paired: result.success,
        });
        if (result.success) {
          Alert.alert('Pairing requested', 'WalletConnect pairing has been initiated.', [
            { text: 'OK', onPress: handleClose },
          ]);
        } else {
          setScanError(result.error ?? 'Could not process this WalletConnect code');
        }
        return;
      }

      analyticsService.track(ANALYTICS_EVENTS.QR_SCAN_UNRECOGNIZED, {});
      setScanError("This QR code isn't a Stellar address or a WalletConnect pairing code.");
    },
    [navigation, pairWithUri, handleClose],
  );

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (hasScannedRef.current) return;
      hasScannedRef.current = true;
      processContent(result.data);
    },
    [processContent],
  );

  const handleManualSubmit = useCallback(() => {
    if (!manualValue.trim()) return;
    analyticsService.track(ANALYTICS_EVENTS.QR_MANUAL_ENTRY);
    processContent(manualValue.trim());
  }, [manualValue, processContent]);

  const handleRequestPermission = useCallback(async () => {
    analyticsService.track(ANALYTICS_EVENTS.QR_CAMERA_PERMISSION_REQUESTED);
    const result = await requestPermission();
    analyticsService.track(
      result.granted
        ? ANALYTICS_EVENTS.QR_CAMERA_PERMISSION_GRANTED
        : ANALYTICS_EVENTS.QR_CAMERA_PERMISSION_DENIED,
    );
  }, [requestPermission]);

  const manualEntryBlock = (
    <View style={styles.manualEntryBlock}>
      {showManualEntry ? (
        <>
          <TextInput
            style={styles.manualInput}
            placeholder="Paste a Stellar address or WalletConnect code"
            placeholderTextColor={colors.textTertiary}
            value={manualValue}
            onChangeText={setManualValue}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Manual code entry"
          />
          <TouchableOpacity
            style={styles.manualSubmitButton}
            onPress={handleManualSubmit}
            accessibilityRole="button"
            accessibilityLabel="Use this code"
          >
            <Text style={styles.manualSubmitButtonText}>Use this code</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          onPress={() => setShowManualEntry(true)}
          accessibilityRole="button"
          accessibilityLabel="Enter code manually"
        >
          <Text style={styles.manualEntryLink}>Enter code manually instead</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Permission status still loading.
  if (!permission) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <Text style={styles.rationaleText}>Checking camera access…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    const blocked = !permission.canAskAgain;
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <TouchableOpacity
          style={styles.closeButtonStandalone}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        <Text style={styles.rationaleTitle}>Camera access needed</Text>
        <Text style={styles.rationaleText}>
          {blocked
            ? 'Camera access is currently blocked. Enable it in Settings to scan WalletConnect codes and wallet addresses.'
            : 'NFTopia uses your camera to scan WalletConnect pairing codes and wallet addresses, so you can pair or send funds without typing a long code by hand.'}
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={blocked ? () => Linking.openSettings() : handleRequestPermission}
          accessibilityRole="button"
          accessibilityLabel={blocked ? 'Open Settings' : 'Allow camera access'}
        >
          <Text style={styles.primaryButtonText}>
            {blocked ? 'Open Settings' : 'Allow Camera Access'}
          </Text>
        </TouchableOpacity>

        {manualEntryBlock}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanError ? undefined : handleBarcodeScanned}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <Text style={styles.iconButtonText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setTorchOn((t) => !t)}
            accessibilityRole="button"
            accessibilityLabel={torchOn ? 'Turn torch off' : 'Turn torch on'}
            accessibilityState={{ selected: torchOn }}
          >
            <Text style={styles.iconButtonText}>{torchOn ? 'Torch On' : 'Torch Off'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.frameRow}>
          <View style={styles.frameSide} />
          <View style={styles.scanFrame} />
          <View style={styles.frameSide} />
        </View>

        <View style={styles.bottomBar}>
          {scanError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{scanError}</Text>
              <TouchableOpacity
                style={styles.scanAgainButton}
                onPress={handleScanAgain}
                accessibilityRole="button"
                accessibilityLabel="Scan again"
              >
                <Text style={styles.scanAgainButtonText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.hintText}>Align a QR code within the frame</Text>
          )}
          {manualEntryBlock}
        </View>
      </SafeAreaView>
    </View>
  );
}

export default QRScannerScreen;

const FRAME_SIZE = 240;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centeredContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  iconButton: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  iconButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  closeButtonStandalone: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    padding: spacing.sm,
  },
  closeButtonText: { fontSize: 20, color: colors.textSecondary },
  frameRow: { flexDirection: 'row', height: FRAME_SIZE },
  frameSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: borderRadius.lg,
    backgroundColor: 'transparent',
  },
  bottomBar: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  hintText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 13,
  },
  errorBanner: {
    backgroundColor: colors.errorBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorBannerText: { color: colors.errorText, fontSize: 13, textAlign: 'center' },
  scanAgainButton: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error,
  },
  scanAgainButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  rationaleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  rationaleText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  manualEntryBlock: { marginTop: spacing.lg, width: '100%', gap: spacing.sm },
  manualEntryLink: {
    color: colors.info,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  manualInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  manualSubmitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  manualSubmitButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
