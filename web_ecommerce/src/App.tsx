import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { RiviumChatClient, RiviumChatConfig } from '@rivium/web-chat';
import RiviumPush from '@rivium/push-web';
import { DemoUser, Order, getOrderById } from './models/types';
import { LoginScreen } from './screens/LoginScreen';
import { OrdersScreen } from './screens/OrdersScreen';
import { OrderChatScreen } from './screens/OrderChatScreen';

let riviumPush: RiviumPush | null = null;

function AppContent() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null);
  const [riviumChatClient, setRiviumChatClient] = useState<RiviumChatClient | null>(null);

  const handleLogin = (user: DemoUser) => {
    setCurrentUser(user);

    // Initialize RiviumChat client
    const config: RiviumChatConfig = {
      apiKey: 'rv_live_64e0ada5eeb66e3adf6136337802a5a34713ce4966372854',
      userId: user.id,
      userInfo: {
        displayName: user.name,
        role: user.role,
      },
    };

    const client = new RiviumChatClient(config);
    client.connect();
    setRiviumChatClient(client);

    riviumPush = new RiviumPush({
      apiKey: 'rv_live_64e0ada5eeb66e3adf6136337802a5a34713ce4966372854',
    });
    riviumPush.register({ userId: user.id });

    navigate('/orders');
  };

  const handleLogout = () => {
    riviumChatClient?.disconnect();
    setRiviumChatClient(null);
    riviumPush?.unregister();
    riviumPush = null;
    setCurrentUser(null);
    navigate('/');
  };

  const handleOrderClick = (order: Order) => {
    navigate(`/orders/${order.id}/chat`);
  };

  const handleBackToOrders = () => {
    navigate('/orders');
  };

  if (!currentUser || !riviumChatClient) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<LoginScreen onLogin={handleLogin} />}
      />
      <Route
        path="/orders"
        element={
          <OrdersScreen
            currentUser={currentUser}
            client={riviumChatClient}
            onOrderClick={handleOrderClick}
            onLogout={handleLogout}
          />
        }
      />
      <Route
        path="/orders/:orderId/chat"
        element={
          <OrderChatRoute
            currentUser={currentUser}
            client={riviumChatClient}
            onBack={handleBackToOrders}
          />
        }
      />
    </Routes>
  );
}

interface OrderChatRouteProps {
  currentUser: DemoUser;
  client: RiviumChatClient;
  onBack: () => void;
}

function OrderChatRoute({ currentUser, client, onBack }: OrderChatRouteProps) {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const order = orderId ? getOrderById(orderId) : undefined;

  if (!order) {
    navigate('/orders');
    return null;
  }

  return (
    <OrderChatScreen
      order={order}
      currentUser={currentUser}
      client={client}
      onBack={onBack}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
