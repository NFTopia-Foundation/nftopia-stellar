import React from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { RecipientPicker } from '../RecipientPicker';
import { isValidStellarAddress } from '@/stores/addressBookStore';

const onClose = jest.fn();
const onSelect = jest.fn();

const savedEntries = [
  {
    id: 'contact-1',
    label: 'Alice',
    address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'contact-2',
    label: 'Bob',
    address: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

let addressBookState = {
  entries: savedEntries,
  recentRecipients: [],
  getRecentRecipients: jest.fn(() => []),
};

jest.mock('@/stores/addressBookStore', () => ({
  ...jest.requireActual('@/stores/addressBookStore'),
  useAddressBookStore: () => addressBookState,
}));

function findTextInput(root: ReactTestInstance, label: string) {
  return root.find((node) => String(node.type) === 'RNTextInput' && node.props.accessibilityLabel === label);
}

function savedList(root: ReactTestInstance) {
  return root.find((node) => String(node.type) === 'RNFlatList');
}

describe('RecipientPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    addressBookState = {
      entries: savedEntries,
      recentRecipients: [],
      getRecentRecipients: jest.fn(() => []),
    };
  });

  it('renders saved address-book entries', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<RecipientPicker visible onClose={onClose} onSelect={onSelect} />);
    });

    expect(savedList(renderer.root).props.data.map((entry: (typeof savedEntries)[number]) => entry.label)).toEqual([
      'Alice',
      'Bob',
    ]);
    expect(savedList(renderer.root).props.data.map((entry: (typeof savedEntries)[number]) => entry.address)).toEqual([
      savedEntries[0].address,
      savedEntries[1].address,
    ]);
  });

  it('filters saved entries by label and address', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<RecipientPicker visible onClose={onClose} onSelect={onSelect} />);
    });

    act(() => {
      findTextInput(renderer.root, 'Search address book').props.onChangeText('bob');
    });
    expect(savedList(renderer.root).props.data.map((entry: (typeof savedEntries)[number]) => entry.label)).toEqual([
      'Bob',
    ]);

    act(() => {
      findTextInput(renderer.root, 'Search address book').props.onChangeText(savedEntries[0].address.slice(0, 8));
    });
    expect(savedList(renderer.root).props.data.map((entry: (typeof savedEntries)[number]) => entry.label)).toEqual([
      'Alice',
    ]);
  });

  it('emits the exact selected address', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<RecipientPicker visible onClose={onClose} onSelect={onSelect} />);
    });

    const row = savedList(renderer.root).props.renderItem({ item: savedEntries[0], index: 0 });
    act(() => row.props.onPress());
    expect(onSelect).toHaveBeenCalledWith(savedEntries[0].address);
  });

  it('shows the empty address-book state', () => {
    addressBookState = {
      entries: [],
      recentRecipients: [],
      getRecentRecipients: jest.fn(() => []),
    };
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<RecipientPicker visible onClose={onClose} onSelect={onSelect} />);
    });

    expect(savedList(renderer.root).props.ListEmptyComponent.props.children).toBe('No saved contacts');
  });

  it('accepts valid G... public keys and rejects malformed, federated, and muxed addresses', () => {
    expect(isValidStellarAddress('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')).toBe(true);
    expect(isValidStellarAddress('not-a-stellar-address')).toBe(false);
    expect(isValidStellarAddress('alice*stellar.org')).toBe(false);
    expect(isValidStellarAddress('MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBe(false);
  });
});
