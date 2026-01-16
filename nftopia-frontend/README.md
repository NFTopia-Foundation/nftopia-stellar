# NFTopia Frontend Web

NFTopia Frontend Web is the **user interface** for the NFTopia platform, built with **Next.js**. It provides a seamless experience for creators and collectors to interact with NFTs on the Starknet blockchain.

## 🔗 Figma Design

[View UI/UX Design](https://www.figma.com/design/Cg75Fx3YzfP2KzyiYa0vLU/NFTopia?node-id=0-1&t=6ky2MmrZqKyqspAB-1)

## ✨ Features

- **NFT Minting Interface**
- **Gallery View with Filters**
- **Starknet Wallet Integration** (ArgentX, Braavos)
- **Marketplace Preview**
- **Responsive Design**

## 🛠️ Tech Stack

| Component        | Technology               |
| ---------------- | ------------------------ |
| Framework        | Next.js 14               |
| Styling          | Tailwind CSS + shadcn/ui |
| State Management | Zustand                  |
| Blockchain       | Starknet.js              |

## 🚀 Quick Start

### Prerequisites

- Node.js v18+
- pnpm
- Starknet wallet

### Installation

```bash
git clone https://github.com/NFTopia-Foundation/nftopia.git
cd apps/frontend
pnpm install
cp .env.example .env.local
pnpm dev
```

## 📂 Project Structure

```text
src/
├── app/
├── components/
├── lib/
└── stores/
```

## 📝 QA & Responsiveness Checklist

For a comprehensive checklist covering responsive design, accessibility, and cross-device QA, see:

[QA-RESPONSIVENESS-CHECKLIST.md](./QA-RESPONSIVENESS-CHECKLIST.md)

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature
   ```
3. Submit PR

- Ensure your code passes all tests
- Include relevant documentation updates
- Reference any related issues

## ClientBody Component

A flexible layout wrapper for client-side apps, supporting theme switching, responsive design, global state, accessibility, and smooth transitions.

### Usage

```tsx
import { ClientBody } from "@/components/layout/ClientBody";

<ClientBody
  header={<Header />}
  footer={<Footer />}
  sidebar={<Sidebar />}
  showSidebar={true}
  loading={false}
>
  <MainContent />
</ClientBody>;
```

### Features

- Theme switching (dark/light, Zustand integration)
- Responsive (Tailwind breakpoints, mobile-first)
- Smooth transitions (sidebar, layout)
- Global state (sidebar, loading, etc.)
- Accessibility (focus, ARIA, keyboard nav)
- Header/footer/children composition
- Scroll lock when sidebar is open
- Loading state and skeleton screens

### Testing

- Jest + React Testing Library for logic, state, and user interactions
- axe-core for accessibility (100% score)
- Storybook stories for all variants
- Chromatic for visual regression

### Performance

- Render time < 16ms (React Profiler)
- Theme switch animation < 300ms
- Bundle size < 5KB gzipped (see `npm run analyze`)

---
