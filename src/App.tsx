import { Arena } from './components/Arena/index.ts'
import { SocketProvider } from './socket/index.ts'

export default function App() {
  return (
    <SocketProvider>
      <Arena />
    </SocketProvider>
  )
}
