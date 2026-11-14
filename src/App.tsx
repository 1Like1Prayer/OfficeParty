import { Arena } from './components/Arena/index.ts'
import { NetworkProvider } from './network/index.ts'

export default function App() {
  return (
    <NetworkProvider>
      <Arena />
    </NetworkProvider>
  )
}
