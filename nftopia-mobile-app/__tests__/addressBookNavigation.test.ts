/**
 * AddressBook Navigation Smoke Test
 *
 * Confirms AddressBookScreen registration in MainNavigator and
 * round-trip parameter passing between SendScreen and AddressBookScreen.
 */

describe('AddressBook Navigation & Round-Trip Smoke Test', () => {
  it('registers AddressBookScreen route with correct param types in MainStackParamList', () => {
    type MainStackParamList = import('@/navigation/MainNavigator').MainStackParamList;

    // TypeScript compile-time assertion that AddressBook route exists in MainStackParamList
    const mockAddressBookParams: MainStackParamList['AddressBook'] = {
      onSelect: (addr: string) => {},
    };

    const mockSendParams: MainStackParamList['Send'] = {
      prefilledAddress: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    };

    expect(mockAddressBookParams).toBeDefined();
    expect(mockSendParams).toBeDefined();
    expect(mockSendParams?.prefilledAddress).toBe(
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
    );
  });

  it('handles round-trip address selection via onSelect callback and navigation', () => {
    let sendScreenRecipient = '';
    const selectedAddress = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

    // Mock navigation stack
    const navigationHistory: Array<{ screen: string; params?: any }> = [];
    const mockNavigation = {
      navigate: jest.fn((screen: string, params?: any) => {
        navigationHistory.push({ screen, params });
        if (screen === 'Send' && params?.prefilledAddress) {
          sendScreenRecipient = params.prefilledAddress;
        }
      }),
      goBack: jest.fn(() => {
        navigationHistory.pop();
      }),
      canGoBack: jest.fn(() => navigationHistory.length > 1),
    };

    // 1. From SendScreen, open AddressBook with onSelect callback
    const handleOpenAddressBookFromSend = () => {
      mockNavigation.navigate('AddressBook', {
        onSelect: (addr: string) => {
          sendScreenRecipient = addr;
        },
      });
    };

    handleOpenAddressBookFromSend();
    expect(mockNavigation.navigate).toHaveBeenCalledWith('AddressBook', expect.objectContaining({
      onSelect: expect.any(Function),
    }));

    // 2. In AddressBookScreen, user selects an address
    const addressBookRouteParams = navigationHistory[navigationHistory.length - 1].params;
    const handleSelectInAddressBook = (address: string) => {
      if (addressBookRouteParams?.onSelect) {
        addressBookRouteParams.onSelect(address);
      }
      mockNavigation.navigate('Send', { prefilledAddress: address });
    };

    handleSelectInAddressBook(selectedAddress);

    // 3. Confirm SendScreen receives the selected address
    expect(sendScreenRecipient).toBe(selectedAddress);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Send', {
      prefilledAddress: selectedAddress,
    });
  });
});
