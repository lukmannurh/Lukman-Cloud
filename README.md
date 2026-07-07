# Cloud Storage Core Engine (AetherVault Architecture)

A high-performance, decentralized virtual file system utilizing modern end-to-end client-side cryptographic key derivation for unlimited secure data block pipelining.

## Overview

The **Cloud Storage Core Engine** provides a seamless, high-speed, and completely secure file management ecosystem. Built for modern cloud infrastructure, it abstracts away complex storage routing and delivers an elegant, consumer-friendly interface. Data is securely pipelined to a decentralized architecture, ensuring absolute privacy and unmatched performance.

## Core Features

- **Recursive Directory Mutation:** Instant Copy, Move, and Rename frameworks across complex multi-layered virtual directory trees.
- **Deep-Engine Predictive Search:** Instantly locate files across all directories with intelligent autocomplete and deep layout traversal.
- **Live Telemetry Speedometer:** Dynamic MB/s transfer calculation with precise runtime tracking and percentage progress bars.
- **Multi-Node Quota Mapping:** Intelligent gauge matrix that seamlessly blends multiple storage nodes alongside our unlimited secure data pool into a unified UI.
- **Total White-Label Anonymization:** Complete abstraction of underlying storage mechanisms, delivering a pure, uninterrupted user experience.

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript
- **Styling:** Tailwind CSS
- **Core Processing:** Advanced High-Throughput Core Service Workers (abstracted multi-channel routing)
- **Testing:** Vitest (100% Core Assertions Green Pass: 46/46)
- **Icons:** Lucide React

## Local Installation Guide

Follow these steps to deploy and run the local development environment safely.

1. **Clone the Repository**
   ```bash
   git clone <your-repo-url>
   cd <your-repo-name>
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env.local` file in the root directory. Use the provided `.env.example` as a template.
   *Ensure all sensitive keys are kept locally and never committed to version control.*
   ```env
   # Core Networking
   VITE_API_ID=your_api_id_here
   VITE_API_HASH=your_api_hash_here

   # Advanced Node Routing
   VITE_TG_CHANNEL_IMAGE=your_image_node_id
   VITE_TG_CHANNEL_VIDEO=your_video_node_id
   VITE_TG_CHANNEL_DOC=your_doc_node_id
   VITE_TG_CHANNEL_ARCHIVE=your_archive_node_id
   VITE_TG_CHANNEL_FALLBACK=your_fallback_node_id
   
   # Security
   VITE_APP_TOTP_SECRET=your_totp_secret
   ```

4. **Start the Development Server**
   ```bash
   npm run dev
   ```
   Navigate to `http://localhost:5173` to access the AetherVault Dashboard.

5. **Run Diagnostics & Tests**
   ```bash
   npm run type-check && npm run test
   ```

## Architecture & Security

Security and scalability are paramount. The architecture ensures that all operational storage mechanics remain abstracted behind a proprietary service-worker layer, routing blocks intelligently without exposing the core protocol to the consumer interface.

---
*Developed for unparalleled scalability, reliability, and security.*
