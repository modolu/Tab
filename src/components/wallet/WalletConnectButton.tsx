type WalletConnectButtonProps = {
  onConnect: () => void
  disabled?: boolean
  connectedAddress?: string
}

function abbreviate(address: string): string {
  const compact = address.replace(/\s/g, '')
  return compact.length < 14 ? address : `${compact.slice(0, 8)}…${compact.slice(-6)}`
}

export default function WalletConnectButton({ onConnect, disabled, connectedAddress }: WalletConnectButtonProps) {
  return (
    <button className="button button-primary button-large" type="button" onClick={onConnect} disabled={disabled}>
      {connectedAddress ? `Connected · ${abbreviate(connectedAddress)}` : 'Connect Nimiq wallet'}
    </button>
  )
}
