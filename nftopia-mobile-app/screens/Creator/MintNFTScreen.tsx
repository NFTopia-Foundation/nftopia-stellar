import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useCreatorStore } from '@/stores/creatorStore';
import { useOfflineStore } from '@/stores/offlineStore';
import apiClient from '@/lib/api/sample';
import { haptics } from '@/lib/haptics';
import { MintFormData, NFTAttribute } from '@/types';
import { OptimizedImage } from '@/src/components/OptimizedImage';

export default function MintNFTScreen({ navigation }: any) {
  const { collections, fetchMyCollections } = useCreatorStore();
  const { addToQueue, isOnline } = useOfflineStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('XLM');
  const [collectionId, setCollectionId] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<NFTAttribute[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);

  useEffect(() => {
    fetchMyCollections();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'NFT name is required';
    }
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!price.trim() || isNaN(Number(price)) || Number(price) <= 0) {
      newErrors.price = 'Valid price is required';
    }
    if (!contractAddress.trim()) {
      newErrors.contractAddress = 'Contract address is required';
    } else if (!contractAddress.startsWith('C') || contractAddress.length !== 56) {
      newErrors.contractAddress = 'Invalid Stellar contract address';
    }
    if (!image) {
      newErrors.image = 'Please select an image';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImagePick = async () => {
    Alert.alert(
      'Select Image',
      'Choose image source',
      [
        { text: 'Camera', onPress: () => simulateImagePick() },
        { text: 'Gallery', onPress: () => simulateImagePick() },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const simulateImagePick = () => {
    setImage('https://via.placeholder.com/800x800/6C5CE7/FFFFFF?text=NFT+Preview');
  };

  const addAttribute = () => {
    setAttributes([...attributes, { trait_type: '', value: '' }]);
  };

  const updateAttribute = (index: number, field: 'trait_type' | 'value', value: string) => {
    const updated = [...attributes];
    updated[index] = { ...updated[index], [field]: value };
    setAttributes(updated);
  };

  const removeAttribute = (index: number) => {
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleMint = async () => {
    if (!validateForm()) {
      haptics.error();
      return;
    }

    const formData: MintFormData = {
      name: name.trim(),
      description: description.trim(),
      price: price.trim(),
      currency,
      collectionId: collectionId || undefined,
      contractAddress: contractAddress.trim(),
      image,
      attributes: attributes.filter((a) => a.trait_type && a.value),
    };

    setLoading(true);
    setUploading(true);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 500);

    try {
      if (isOnline) {
        await apiClient.mintNFT(formData);
      } else {
        addToQueue({
          action: 'mint_nft',
          payload: formData,
        });
      }

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploading(false);
      setLoading(false);

      apiClient.trackEvent('nft_minted', {
        name: formData.name,
        collectionId: formData.collectionId,
        hasAttributes: formData.attributes && formData.attributes.length > 0,
      });

      haptics.success();
      Alert.alert(
        'Success!',
        isOnline
          ? 'Your NFT has been minted successfully!'
          : 'Your NFT will be minted when you\'re back online.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      clearInterval(progressInterval);
      setUploading(false);
      setLoading(false);
      haptics.error();
      setErrors({ submit: error.message || 'Failed to mint NFT' });
    }
  };

  const currencies = ['XLM', 'USDC', 'ETH'];

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mint NFT</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Image Upload */}
      <View style={styles.section}>
        <Text style={styles.label}>NFT Image *</Text>
        <TouchableOpacity style={styles.imageUpload} onPress={handleImagePick}>
          {image ? (
            <View style={styles.imagePreviewContainer}>
              <OptimizedImage
                source={image}
                size="medium"
                width="100%"
                height={200}
                resizeMode="cover"
                cacheKey={`mint-preview-${Date.now()}`}
                showSkeleton={true}
                quality="medium"
              />
              <Text style={styles.changeImageText}>Tap to change</Text>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.uploadIcon}>📸</Text>
              <Text style={styles.uploadText}>Tap to upload image</Text>
              <Text style={styles.uploadHint}>PNG, JPG, GIF up to 10MB</Text>
            </View>
          )}
        </TouchableOpacity>
        {errors.image && <Text style={styles.errorText}>{errors.image}</Text>}
      </View>

      {/* Upload Progress */}
      {uploading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>Uploading... {uploadProgress}%</Text>
        </View>
      )}

      {/* Name */}
      <View style={styles.section}>
        <Text style={styles.label}>NFT Name *</Text>
        <TextInput
          style={[styles.input, errors.name ? styles.inputError : null]}
          value={name}
          onChangeText={setName}
          placeholder="Enter NFT name"
          placeholderTextColor="#999"
          maxLength={100}
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea, errors.description ? styles.inputError : null]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe your NFT"
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          maxLength={500}
        />
        {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
      </View>

      {/* Price & Currency */}
      <View style={styles.section}>
        <Text style={styles.label}>Price *</Text>
        <View style={styles.priceRow}>
          <TextInput
            style={[styles.input, styles.priceInput, errors.price ? styles.inputError : null]}
            value={price}
            onChangeText={setPrice}
            placeholder="0.00"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
          />
          <View style={styles.currencySelector}>
            {currencies.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.currencyOption, currency === c && styles.currencyOptionActive]}
                onPress={() => setCurrency(c)}
              >
                <Text style={[styles.currencyText, currency === c && styles.currencyTextActive]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
      </View>

      {/* Collection */}
      <View style={styles.section}>
        <Text style={styles.label}>Collection (Optional)</Text>
        <TouchableOpacity
          style={styles.collectionSelector}
          onPress={() => setShowCollectionPicker(!showCollectionPicker)}
        >
          <Text style={collectionId ? styles.collectionText : styles.collectionPlaceholder}>
            {collectionId
              ? collections.find((c) => c.id === collectionId)?.name || 'Unknown Collection'
              : 'Select a collection'}
          </Text>
          <Text style={styles.dropdownArrow}>{showCollectionPicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {showCollectionPicker && (
          <View style={styles.collectionPicker}>
            <TouchableOpacity
              style={styles.collectionOption}
              onPress={() => {
                setCollectionId('');
                setShowCollectionPicker(false);
              }}
            >
              <Text style={styles.collectionOptionText}>None</Text>
            </TouchableOpacity>
            {collections.map((col) => (
              <TouchableOpacity
                key={col.id}
                style={styles.collectionOption}
                onPress={() => {
                  setCollectionId(col.id);
                  setShowCollectionPicker(false);
                }}
              >
                <Text style={styles.collectionOptionText}>{col.name}</Text>
                <Text style={styles.collectionOptionCount}>{col.nftCount} NFTs</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Contract Address */}
      <View style={styles.section}>
        <Text style={styles.label}>Contract Address *</Text>
        <TextInput
          style={[styles.input, errors.contractAddress ? styles.inputError : null]}
          value={contractAddress}
          onChangeText={setContractAddress}
          placeholder="Stellar contract address (starts with C)"
          placeholderTextColor="#999"
          autoCapitalize="characters"
          maxLength={56}
        />
        {errors.contractAddress && <Text style={styles.errorText}>{errors.contractAddress}</Text>}
      </View>

      {/* Attributes */}
      <View style={styles.section}>
        <View style={styles.attributeHeader}>
          <Text style={styles.label}>Attributes (Optional)</Text>
          <TouchableOpacity style={styles.addAttributeButton} onPress={addAttribute}>
            <Text style={styles.addAttributeText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {attributes.map((attr, index) => (
          <View key={index} style={styles.attributeRow}>
            <TextInput
              style={[styles.input, styles.attributeInput]}
              value={attr.trait_type}
              onChangeText={(v) => updateAttribute(index, 'trait_type', v)}
              placeholder="Trait type"
              placeholderTextColor="#999"
            />
            <TextInput
              style={[styles.input, styles.attributeInput]}
              value={attr.value}
              onChangeText={(v) => updateAttribute(index, 'value', v)}
              placeholder="Value"
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={styles.removeAttributeButton}
              onPress={() => removeAttribute(index)}
            >
              <Text style={styles.removeAttributeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Submit Error */}
      {errors.submit && (
        <View style={styles.submitError}>
          <Text style={styles.submitErrorText}>{errors.submit}</Text>
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.mintButton, loading && styles.mintButtonDisabled]}
        onPress={handleMint}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.mintButtonText}>
            {isOnline ? 'Mint NFT' : 'Queue for Minting'}
          </Text>
        )}
      </TouchableOpacity>

      {!isOnline && (
        <View style={styles.offlineNotice}>
          <Text style={styles.offlineNoticeText}>
            You're offline. Your mint will be queued and processed when you reconnect.
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    fontSize: 16,
    color: '#6C5CE7',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  section: {
    padding: 20,
    paddingBottom: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#1A1A1A',
  },
  inputError: {
    borderColor: '#E17055',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: '#E17055',
    marginTop: 4,
  },
  imageUpload: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    alignItems: 'center',
    padding: 40,
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  uploadHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  imagePreviewContainer: {
    position: 'relative',
  },
  changeImageText: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
  },
  progressContainer: {
    padding: 20,
    paddingTop: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E8E8E8',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6C5CE7',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priceInput: {
    flex: 1,
  },
  currencySelector: {
    flexDirection: 'row',
    gap: 4,
  },
  currencyOption: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  currencyOptionActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  currencyText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  currencyTextActive: {
    color: '#FFFFFF',
  },
  collectionSelector: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collectionText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  collectionPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
  },
  collectionPicker: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  collectionOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  collectionOptionText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  collectionOptionCount: {
    fontSize: 12,
    color: '#999',
  },
  attributeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addAttributeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#6C5CE7',
    borderRadius: 6,
  },
  addAttributeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  attributeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  attributeInput: {
    flex: 1,
  },
  removeAttributeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAttributeText: {
    color: '#E17055',
    fontSize: 14,
    fontWeight: '600',
  },
  submitError: {
    margin: 20,
    padding: 12,
    backgroundColor: '#FFE0E0',
    borderRadius: 8,
  },
  submitErrorText: {
    color: '#E17055',
    fontSize: 14,
    textAlign: 'center',
  },
  mintButton: {
    margin: 20,
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  mintButtonDisabled: {
    opacity: 0.6,
  },
  mintButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  offlineNotice: {
    marginHorizontal: 20,
    padding: 12,
    backgroundColor: '#FFEAA7',
    borderRadius: 8,
  },
  offlineNoticeText: {
    color: '#D68910',
    fontSize: 13,
    textAlign: 'center',
  },
});