# Lukman Cloud

**A modern, high-performance web cloud storage system.**

Lukman Cloud is an advanced cloud storage application providing a seamless and highly responsive virtual file system (VFS). It empowers users with real-time storage management, elegant file hierarchy visualization, and deep integration with cloud backend providers.

## Key Features

- **Multi-User Authentication**: Securely support both Google OAuth users and instant Guest sessions via Better Auth.
- **Telegram-Backed Chunked Uploads**: Experience ultra-fast, chunked file uploads utilizing GramJS for robust cloud storage via Telegram channels.
- **Deep Subfolder Hierarchy**: Effortlessly navigate complex folder structures using the Supabase-powered VFS graph, complete with intuitive breadcrumbs.
- **Dynamic File Size Formatting**: Intelligently renders file sizes in KB, MB, and GB based on precise threshold calculations for pristine readability.
- **Modern Responsive Design**: Fully optimized for both Desktop and Mobile experiences with a premium glassmorphism interface, powered by Tailwind CSS and Radix UI primitives.
- **Self-Healing State**: Rigorous React state isolation and synchronization mechanisms ensure your UI reflects exact database truth instantly.

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Radix UI.
- **Backend/VFS**: Supabase (PostgreSQL), Supabase RPC, Better Auth (Google OAuth).
- **Storage Backend**: GramJS (Telegram Cloud).

## Local Development Setup

1. **Clone and Install dependencies**
   ```bash
   git clone https://github.com/lukmannurh/Lukman-Cloud.git
   cd Lukman-Cloud
   npm install
   ```

2. **Configure Environment Variables**
   Create a `.env` file based on `.env.example` (or configure locally):
   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_TELEGRAM_API_ID=your-api-id
   VITE_TELEGRAM_API_HASH=your-api-hash
   VITE_TELEGRAM_BOT_TOKEN=your-bot-token
   VITE_TELEGRAM_CHANNEL_ID=your-channel-id
   ```

3. **Run the Development Server**
   ```bash
   npm run dev
   ```

## Deployment

Lukman Cloud is fully optimized for Vercel. 
1. Connect your GitHub repository to Vercel.
2. Add your `VITE_...` environment variables in the Vercel project settings.
3. Deploy! The Vercel build pipeline will automatically execute `npm run build` using the Vite production config.
