'use client'

import { StarknetConfig, publicProvider } from '@starknet-react/core'
import { mainnet, sepolia } from '@starknet-react/chains'
import { InjectedConnector } from 'starknetkit/injected'
import { ArgentMobileConnector } from 'starknetkit/argentMobile'
import { WebWalletConnector } from 'starknetkit/webwallet'

const chains = [mainnet, sepolia]

// Only include this if you specifically need to configure connectors
const connectors = [
  new InjectedConnector({ options: { id: 'braavos' } }),
  new InjectedConnector({ options: { id: 'argentX' } }),
  new ArgentMobileConnector(),
  new WebWalletConnector({ url: 'https://web.argent.xyz' })
]

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  return (
    <StarknetConfig
      chains={chains}
      provider={publicProvider()}
      connectors={connectors as any}
      autoConnect
    >
      {children}
    </StarknetConfig>
  )
}