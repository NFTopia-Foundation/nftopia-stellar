# NFTopia Mobile App

The **NFTopia Mobile App** is the React Native implementation of the NFTopia platform, providing native mobile access to NFT minting, trading, and management. Built with TypeScript and Expo, it delivers a premium mobile experience for collectors and creators.

---

## 📱 App Screenshots  
[View Figma Designs](https://www.figma.com/design/Cg75Fx3YzfP2KzyiYa0vLU/NFTopia?node-id=0-1&t=6ky2MmrZqKyqspAB-1)

---

## ✨ Mobile Features  
- **Cross-Platform Support**:  
  - iOS and Android compatibility  
  - Responsive layout for all devices  
- **Wallet Integration**:  
  - ArgentX/Braavos wallet connectivity  
  - Secure key management  
- **NFT Management**:  
  - Minting interface optimized for mobile  
  - Collection browsing with gesture controls  
- **Marketplace**:  
  - Real-time bidding notifications  
  - QR code scanning for NFT transfers  

---

## 🛠️ Tech Stack  
| Component           | Technology                                                                 |
|---------------------|---------------------------------------------------------------------------|
| Framework           | [React Native 0.72](https://reactnative.dev/) + [Expo](https://expo.dev/) |
| Language           | TypeScript 5.0                                                           |
| State Management   | [Zustand](https://zustand-demo.pmnd.rs/)                                 |
| UI Components      | [NativeWind](https://www.nativewind.dev/) (Tailwind for RN)              |
| Blockchain         | [Starknet.js](https://www.starknetjs.com/)                               |

---

## 🚀 Quick Start  

### Prerequisites  
- Node.js v18+  
- Yarn or pnpm  
- iOS: Xcode 15+  
- Android: Android Studio 2023+  

### Installation  
1. **Clone the repo**:  
   ```bash
   git clone https://github.com/NFTopia-Foundation/nftopia.git
   cd nftopia-mobile-app
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Configure environment:
   ```bash
   cp .env.example .env
   ```
4. Run the app:
   ```bash
   pnpm start  # Starts Metro bundler
   ```
   - Then scan QR code with Expo Go app or:
     ```bash
     pnpm android  # For Android
     pnpm ios      # For iOS (requires Xcode)
     ```
## 🤝 Contributing

1. Fork the repository
2. Create your feature branch:
```bash
git checkout -b feat/your-feature
```
3. Commit changes following Conventional Commits
4. Push to the branch
5. Open a Pull Request
