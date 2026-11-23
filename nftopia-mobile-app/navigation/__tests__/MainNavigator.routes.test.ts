/**
 * Smoke tests: param-list routes required by #668, #670, #671 are registered.
 */
import fs from 'fs';
import path from 'path';

const navPath = path.join(__dirname, '..', 'MainNavigator.tsx');
const source = fs.readFileSync(navPath, 'utf8');

describe('MainNavigator route registration', () => {
  it('registers CollectionDetail (#671)', () => {
    expect(source).toMatch(/name=["']CollectionDetail["']/);
    expect(source).toMatch(/CollectionDetailScreen/);
    expect(source).toMatch(/CollectionDetail:\s*\{\s*collectionId:\s*string\s*\}/);
  });

  it('registers CreatorProfile (#670)', () => {
    expect(source).toMatch(/name=["']CreatorProfile["']/);
    expect(source).toMatch(/CreatorProfileScreen/);
    expect(source).toMatch(/CreatorProfile:\s*\{\s*userId:\s*string\s*\}/);
  });

  it('registers Transactions → TransactionHistoryScreen (#668)', () => {
    expect(source).toMatch(/name=["']Transactions["']/);
    expect(source).toMatch(/TransactionHistoryScreen/);
  });

  it('Profile links to CreatorProfile and Wallet links to Transactions', () => {
    const profile = fs.readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'Profile', 'ProfileScreen.tsx'),
      'utf8',
    );
    const wallet = fs.readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'Profile', 'WalletManagementScreen.tsx'),
      'utf8',
    );
    expect(profile).toMatch(/navigate\(\s*['"]CreatorProfile['"]/);
    expect(wallet).toMatch(/navigate\(\s*['"]Transactions['"]/);
  });
});
