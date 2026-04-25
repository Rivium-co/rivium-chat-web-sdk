import { DemoUser, DemoUsers } from '../models/types';
import styles from './LoginScreen.module.css';

interface LoginScreenProps {
  onLogin: (user: DemoUser) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.logo}>💬</span>
          <h1 className={styles.title}>RiviumChat</h1>
          <p className={styles.subtitle}>E-commerce Demo</p>
        </div>

        <div className={styles.description}>
          <p className={styles.descriptionText}>
            Select a role to explore the buyer-seller chat experience
          </p>
        </div>

        <div className={styles.userCards}>
          <div
            className={styles.userCard}
            onClick={() => onLogin(DemoUsers.buyer)}
          >
            <div className={`${styles.avatar} ${styles.buyerAvatar}`}>
              {DemoUsers.buyer.avatarUrl ? (
                <img
                  src={DemoUsers.buyer.avatarUrl}
                  alt={DemoUsers.buyer.name}
                  className={styles.avatarImage}
                />
              ) : (
                <span className={styles.avatarEmoji}>🛒</span>
              )}
            </div>
            <h3 className={styles.userName}>{DemoUsers.buyer.name}</h3>
            <span className={styles.userRole}>Buyer</span>
            <p className={styles.userDescription}>
              Browse orders and chat with sellers about your purchases
            </p>
            <button className={`${styles.loginButton} ${styles.buyerButton}`}>
              Continue as Buyer
            </button>
          </div>

          <div
            className={styles.userCard}
            onClick={() => onLogin(DemoUsers.seller)}
          >
            <div className={`${styles.avatar} ${styles.sellerAvatar}`}>
              {DemoUsers.seller.avatarUrl ? (
                <img
                  src={DemoUsers.seller.avatarUrl}
                  alt={DemoUsers.seller.name}
                  className={styles.avatarImage}
                />
              ) : (
                <span className={styles.avatarEmoji}>🏪</span>
              )}
            </div>
            <h3 className={styles.userName}>{DemoUsers.seller.name}</h3>
            <span className={styles.userRole}>Seller</span>
            <p className={styles.userDescription}>
              Manage orders and provide customer support via chat
            </p>
            <button className={`${styles.loginButton} ${styles.sellerButton}`}>
              Continue as Seller
            </button>
          </div>
        </div>

        <div className={styles.footer}>
          <span className={styles.footerText}>Powered by RiviumChat SDK</span>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
