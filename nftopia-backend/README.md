# NFTopia Backend API

NFTopia Backend API is a **Nest.js** application that powers the NFTopia platform's server-side operations. It provides RESTful endpoints for NFT management, user authentication, and blockchain interactions with Starknet.

---

## 🔗 API Documentation  
[View Swagger Docs](http://localhost:9000/api) (Available when running locally)

---

## ✨ Backend Features  
- **JWT Authentication**: Secure user login and session management  
- **NFT Metadata Processing**: IPFS upload and metadata generation  
- **Starknet Integration**: Interact with Cairo smart contracts  
- **Database ORM**: TypeORM with PostgreSQL for data persistence  
- **Queue System**: BullMQ for background jobs (minting, notifications)  
- **API Rate Limiting**: Protect against abuse  

---

## 🛠️ Tech Stack  
| Component           | Technology                                                                 |
|---------------------|---------------------------------------------------------------------------|
| Framework           | [Nest.js](https://nestjs.com/)                                           |
| Language           | TypeScript                                                               |
| Database           | PostgreSQL + [TypeORM](https://typeorm.io/)                              |
| Blockchain         | [Starknet.js](https://www.starknetjs.com/)                              |
| Queue              | [BullMQ](https://docs.bullmq.io/)                                       |
| API Docs           | [Swagger](https://swagger.io/)                                          |

---

## 🚀 Quick Start  

### Prerequisites  
- Node.js v18+  
- PostgreSQL 14+  
- Redis (for queues)  
- pnpm  

### Installation  
1. **Clone the repo**:  
   ```bash
   git clone https://github.com/NFTopia-Foundation/nftopia.git
   cd apps/backend
   ```
2. **Install dependencies**:
   ```bash
   pnpm install
   ```
3. Setup environment:
   ```bash
   cp .env.example .env
   ```
## 🤝 Contributing

1. Fork the repository
2. Create your feature branch:
```bash
git checkout -b feat/your-feature
```
3. Commit changes following Conventional Commits
4. Push to the branch:
   ```bash
   ```
5. Open a Pull Request
