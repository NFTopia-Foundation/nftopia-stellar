import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FavoriteButton } from '@/components/ui/FavoriteButton';
import { useFavoritesStore } from '@/stores/favoritesStore';

const impactAsync = Haptics.impactAsync as jest.Mock;

function render(ui: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui as never);
  });
  return renderer;
}

describe('FavoriteButton haptics (#467)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useFavoritesStore.setState({ favorites: [], favoriteCollections: [] } as never);
    });
  });

  it('fires a medium (toggleOn) impact when favoriting', () => {
    const renderer = render(<FavoriteButton id="nft-1" />);
    const button = renderer.root.findByType(TouchableOpacity as never);
    act(() => {
      (button.props as { onPress: () => void }).onPress();
    });
    expect(impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it('fires a light (toggleOff) impact when unfavoriting', () => {
    act(() => {
      useFavoritesStore.setState({ favorites: ['nft-1'], favoriteCollections: [] } as never);
    });
    const renderer = render(<FavoriteButton id="nft-1" />);
    const button = renderer.root.findByType(TouchableOpacity as never);
    act(() => {
      (button.props as { onPress: () => void }).onPress();
    });
    expect(impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });
});
