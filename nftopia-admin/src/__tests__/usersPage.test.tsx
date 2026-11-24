// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { DataTable, type Column } from '../components/DataTable'
import { BanUserDialog } from '../components/BanUserDialog'
import { UserDetailModal, type UserDetailData } from '../components/UserDetailModal'

afterEach(() => {
  cleanup()
})

describe('DataTable Component', () => {
  interface TestRow {
    id: string
    name: string
    role: string
  }

  const columns: Column<TestRow>[] = [
    { key: 'name', header: 'User Name' },
    { key: 'role', header: 'Account Role' },
  ]

  const sampleData: TestRow[] = [
    { id: '1', name: 'Alice', role: 'Admin' },
    { id: '2', name: 'Bob', role: 'User' },
  ]

  it('renders table headers and rows correctly', () => {
    render(
      <DataTable<TestRow>
        columns={columns}
        data={sampleData}
        keyExtractor={(item) => item.id}
      />,
    )

    expect(screen.getByText('User Name')).toBeDefined()
    expect(screen.getByText('Account Role')).toBeDefined()
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
  })

  it('displays loading indicator when loading is true', () => {
    render(
      <DataTable<TestRow>
        columns={columns}
        data={[]}
        loading={true}
        keyExtractor={(item) => item.id}
      />,
    )

    expect(screen.getByText('Loading data…')).toBeDefined()
  })

  it('displays empty message when data is empty', () => {
    render(
      <DataTable<TestRow>
        columns={columns}
        data={[]}
        emptyMessage="No users found."
        keyExtractor={(item) => item.id}
      />,
    )

    expect(screen.getByText('No users found.')).toBeDefined()
  })

  it('triggers onRowClick when a row is clicked', () => {
    const onRowClick = vi.fn()
    render(
      <DataTable<TestRow>
        columns={columns}
        data={sampleData}
        keyExtractor={(item) => item.id}
        onRowClick={onRowClick}
      />,
    )

    fireEvent.click(screen.getByText('Alice'))
    expect(onRowClick).toHaveBeenCalledWith(sampleData[0])
  })

  it('renders pagination controls and triggers page change', () => {
    const onPageChange = vi.fn()
    render(
      <DataTable<TestRow>
        columns={columns}
        data={sampleData}
        keyExtractor={(item) => item.id}
        pagination={{
          page: 1,
          pageSize: 2,
          total: 10,
          onPageChange,
        }}
      />,
    )

    expect(screen.getByText('1 / 5')).toBeDefined()
    const nextBtn = screen.getByLabelText('Next page')
    fireEvent.click(nextBtn)
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})

describe('BanUserDialog Component', () => {
  const sampleUser = {
    id: 'user-123',
    username: 'cryptocreator',
    email: 'creator@example.com',
  }

  it('renders user display name and inputs', () => {
    render(
      <BanUserDialog
        open={true}
        user={sampleUser}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByText('Ban User Account')).toBeDefined()
    expect(screen.getByText('cryptocreator')).toBeDefined()
  })

  it('requires a reason before proceeding to confirmation', async () => {
    render(
      <BanUserDialog
        open={true}
        user={sampleUser}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    const continueBtn = screen.getByText('Continue to Confirmation')
    fireEvent.click(continueBtn)

    expect(screen.getByText('A reason is required to ban a user.')).toBeDefined()
  })

  it('transitions to confirmation step when a valid reason is entered', () => {
    render(
      <BanUserDialog
        open={true}
        user={sampleUser}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    const textarea = screen.getByPlaceholderText(/Malicious auction activity/i)
    fireEvent.change(textarea, { target: { value: 'Spamming fake collections' } })

    const continueBtn = screen.getByText('Continue to Confirmation')
    fireEvent.click(continueBtn)

    expect(screen.getByText(/Warning: Immediate Account Suspension/i)).toBeDefined()
    expect(screen.getByText('Confirm Ban')).toBeDefined()
  })

  it('calls onSubmit with the trimmed reason upon confirmation', async () => {
    const onSubmit = vi.fn()
    render(
      <BanUserDialog
        open={true}
        user={sampleUser}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    const textarea = screen.getByPlaceholderText(/Malicious auction activity/i)
    fireEvent.change(textarea, { target: { value: '  Repeated TOS violations  ' } })

    fireEvent.click(screen.getByText('Continue to Confirmation'))
    fireEvent.click(screen.getByText('Confirm Ban'))

    expect(onSubmit).toHaveBeenCalledWith('Repeated TOS violations')
  })
})

describe('UserDetailModal Component', () => {
  const sampleDetail: UserDetailData = {
    user: {
      id: 'usr-999',
      username: 'artmaster',
      email: 'art@nftopia.io',
      role: 'CREATOR',
      isBanned: false,
      isEmailVerified: true,
      twoFactorEnabled: true,
      walletAddress: 'GBTYZX24756QJ2KGLRQLA725PQ2FUV3I54P67B46Z3W3R3Q5B6N7T8S9',
      walletProvider: 'Freighter',
      createdAt: '2026-03-01T12:00:00.000Z',
    },
    wallets: [
      {
        walletAddress: 'GBTYZX24756QJ2KGLRQLA725PQ2FUV3I54P67B46Z3W3R3Q5B6N7T8S9',
        walletProvider: 'Freighter',
        isPrimary: true,
        balance: '1234.5678900',
      },
    ],
    activitySummary: {
      collectionsCount: 4,
      nftsOwned: 18,
      nftsCreated: 42,
    },
    auditTrail: [
      {
        id: 'audit-1',
        action: 'BAN_USER',
        adminId: 'admin-alpha',
        createdAt: '2026-04-10T14:30:00.000Z',
        afterState: { isBanned: true, reason: 'Suspicious bid automation' },
      },
      {
        id: 'audit-2',
        action: 'UNBAN_USER',
        adminId: 'admin-beta',
        createdAt: '2026-04-11T09:00:00.000Z',
        afterState: { isBanned: false },
      },
    ],
  }

  it('renders profile information correctly', () => {
    render(
      <UserDetailModal
        open={true}
        userId="usr-999"
        detail={sampleDetail}
        onClose={vi.fn()}
        onBanClick={vi.fn()}
        onUnbanClick={vi.fn()}
      />,
    )

    // Username renders both in the always-visible header and in the
    // (default-active) Profile tab body, so more than one match is expected.
    expect(screen.getAllByText('artmaster').length).toBeGreaterThan(0)
    expect(screen.getByText('art@nftopia.io')).toBeDefined()
    expect(screen.getByText('Email Verified')).toBeDefined()
    expect(screen.getByText('2FA Enabled')).toBeDefined()
    expect(screen.getByText('Active')).toBeDefined()
  })

  it('renders Stellar wallet information and explorer link', () => {
    render(
      <UserDetailModal
        open={true}
        userId="usr-999"
        detail={sampleDetail}
        onClose={vi.fn()}
        onBanClick={vi.fn()}
        onUnbanClick={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText(/Stellar Wallet/i))
    // The address renders in both the "Primary Stellar Wallet" card and the
    // linked-wallets list below it (this fixture's one wallet is the primary),
    // so more than one match is expected.
    expect(screen.getAllByText(sampleDetail.user.walletAddress!).length).toBeGreaterThan(0)
    expect(screen.getByText('View on Stellar.expert')).toBeDefined()
    // The balance (#695) shows once in the primary-wallet card and once in
    // the linked-wallets row below it, same dual-render as the address.
    expect(screen.getAllByText('1234.5679 XLM').length).toBeGreaterThan(0)
  })

  it('shows "Balance unavailable" when a wallet has no resolvable balance', () => {
    const detailWithoutBalance: UserDetailData = {
      ...sampleDetail,
      wallets: [{ ...sampleDetail.wallets[0], balance: null }],
    }
    render(
      <UserDetailModal
        open={true}
        userId="usr-999"
        detail={detailWithoutBalance}
        onClose={vi.fn()}
        onBanClick={vi.fn()}
        onUnbanClick={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText(/Stellar Wallet/i))
    expect(screen.getAllByText('Balance unavailable').length).toBeGreaterThan(0)
  })

  it('renders activity summary counters', () => {
    render(
      <UserDetailModal
        open={true}
        userId="usr-999"
        detail={sampleDetail}
        onClose={vi.fn()}
        onBanClick={vi.fn()}
        onUnbanClick={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText(/Activity Summary/i))
    expect(screen.getByText('4')).toBeDefined() // collections
    expect(screen.getByText('18')).toBeDefined() // nfts owned
    expect(screen.getByText('42')).toBeDefined() // nfts created
  })

  it('renders moderation history with ban and unban audit events', () => {
    render(
      <UserDetailModal
        open={true}
        userId="usr-999"
        detail={sampleDetail}
        onClose={vi.fn()}
        onBanClick={vi.fn()}
        onUnbanClick={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText(/Moderation History/i))
    expect(screen.getByText('BAN_USER')).toBeDefined()
    expect(screen.getByText('UNBAN_USER')).toBeDefined()
    expect(screen.getByText('Suspicious bid automation')).toBeDefined()
  })

  it('triggers onBanClick when ban button is clicked', () => {
    const onBanClick = vi.fn()
    render(
      <UserDetailModal
        open={true}
        userId="usr-999"
        detail={sampleDetail}
        onClose={vi.fn()}
        onBanClick={onBanClick}
        onUnbanClick={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Ban Account'))
    expect(onBanClick).toHaveBeenCalledWith(sampleDetail.user)
  })
})
